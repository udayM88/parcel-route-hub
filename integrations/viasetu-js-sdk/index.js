const DEFAULT_ENDPOINT = "https://tksfdvnogzsweteetjjw.supabase.co/functions/v1/merchant-api";

export class ViaSetuApiError extends Error {
  constructor(message, { status = 0, code = "request_failed", details, retryAfter } = {}) {
    super(message);
    this.name = "ViaSetuApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class ViaSetuClient {
  constructor({ apiKey, endpoint = DEFAULT_ENDPOINT, timeoutMs = 15000, maxRetries = 2, fetch: fetchImpl = globalThis.fetch } = {}) {
    if (!apiKey || typeof apiKey !== "string") throw new TypeError("apiKey is required");
    if (!fetchImpl) throw new TypeError("A fetch implementation is required");
    this.apiKey = apiKey;
    this.endpoint = String(endpoint).replace(/\/$/, "");
    this.timeoutMs = Math.max(1000, Number(timeoutMs) || 15000);
    this.maxRetries = Math.max(0, Math.min(5, Number(maxRetries) || 0));
    this.fetch = fetchImpl;
  }

  async request(action, input = {}, { idempotencyKey, retry = true } = {}) {
    const attempts = retry ? this.maxRetries + 1 : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers = {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "ViaSetu-JS-SDK/0.1.0",
        };
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        const response = await this.fetch(this.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ action, ...input }),
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.success !== false) return data;

        const retryAfter = Number(response.headers.get("Retry-After") || 0) || undefined;
        const error = new ViaSetuApiError(data?.error?.message || `ViaSetu request failed with HTTP ${response.status}`, {
          status: response.status,
          code: data?.error?.code || "request_failed",
          details: data?.error,
          retryAfter,
        });
        const retryable = retry && (response.status === 429 || response.status >= 500);
        if (!retryable || attempt === attempts - 1) throw error;
        lastError = error;
        await wait(Math.min((retryAfter || 2 ** attempt) * 1000, 10000));
        continue;
      } catch (error) {
        const normalized = error?.name === "AbortError"
          ? new ViaSetuApiError("ViaSetu request timed out", { code: "timeout" })
          : error;
        if (normalized instanceof ViaSetuApiError && normalized.status > 0) throw normalized;
        lastError = normalized;
        if (attempt === attempts - 1) {
          throw normalized instanceof Error
            ? normalized
            : new ViaSetuApiError("ViaSetu request failed", { details: normalized });
        }
        await wait(Math.min(2 ** attempt * 1000, 10000));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError;
  }

  rates(input) {
    return this.request("rates", input);
  }

  createShipment(input, { idempotencyKey } = {}) {
    if (!idempotencyKey || String(idempotencyKey).length < 8) {
      throw new TypeError("createShipment requires an idempotencyKey of at least 8 characters");
    }
    return this.request("create_shipment", input, { idempotencyKey, retry: false });
  }

  track(input) {
    return this.request("track", input);
  }

  label(input) {
    return this.request("label", input);
  }

  cancel(input) {
    return this.request("cancel", input, { retry: false });
  }

  wallet() {
    return this.request("wallet");
  }
}

export const createViaSetuClient = (options) => new ViaSetuClient(options);
export { DEFAULT_ENDPOINT };
