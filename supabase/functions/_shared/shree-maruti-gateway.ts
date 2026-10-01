import { getShreeMarutiConfig, type Environment } from "./environment.ts";

export const SHREE_MARUTI_CARRIER_ID = "dee69b40-c0f3-4a44-879a-8b6f6849efaa";
export const SHREE_MARUTI_CARRIER_NAME = "innofulfill_ecomm";

interface GatewaySession {
  token: string;
  refreshToken: string | null;
  tenantId: string;
  userId: string;
  expiresAt: number;
}

const sessions = new Map<Environment, GatewaySession>();

export function shreeMarutiGatewayBase(env: Environment): string {
  return env === "sandbox"
    ? "https://sandbox.apis.innofulfill.com"
    : "https://apis.innofulfill.com";
}

function apiKey(): string | null {
  return Deno.env.get("SHREE_MARUTI_INNO_API_KEY") || null;
}

function parseJson(text: string): any {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

function errorMessage(data: any, fallback: string): string {
  const details = data?.error?.details ?? data?.errors?.errors ?? data?.errors;
  if (Array.isArray(details) && details.length > 0) {
    return details.map((item: any) => `${item?.field || "request"}: ${item?.message || "invalid"}`).join("; ");
  }
  return String(data?.error?.message || data?.message || data?.error || fallback);
}

async function login(env: Environment): Promise<GatewaySession> {
  const config = getShreeMarutiConfig(env);
  if (!config.email || !config.password) {
    throw new Error(`Shree Maruti ${env} gateway credentials are not configured`);
  }
  const res = await fetch(`${shreeMarutiGatewayBase(env)}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: config.email, password: config.password, signinType: "EMAIL" }),
  });
  const text = await res.text();
  const data = parseJson(text);
  const token = data?.id_token || data?.data?.id_token;
  const tenantId = data?.tenant_id || data?.data?.tenant_id;
  const userId = data?.user_id || data?.data?.user_id;
  if (!res.ok || !token || !tenantId || !userId) {
    throw new Error(errorMessage(data, `Shree Maruti login failed (${res.status})`));
  }
  const expiresIn = Number(data?.expires_in || data?.data?.expires_in || 86400);
  const session = {
    token: String(token),
    refreshToken: data?.refresh_token || data?.data?.refresh_token || null,
    tenantId: String(tenantId),
    userId: String(userId),
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
  };
  sessions.set(env, session);
  return session;
}

async function refresh(env: Environment, current: GatewaySession): Promise<GatewaySession> {
  if (!current.refreshToken) return login(env);
  try {
    const res = await fetch(`${shreeMarutiGatewayBase(env)}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ userId: current.userId, refreshToken: current.refreshToken }),
    });
    const text = await res.text();
    const data = parseJson(text);
    const token = data?.id_token || data?.data?.id_token;
    if (!res.ok || !token) return login(env);
    const expiresIn = Number(data?.expires_in || data?.data?.expires_in || 86400);
    const next = {
      ...current,
      token: String(token),
      refreshToken: data?.refresh_token || data?.data?.refresh_token || current.refreshToken,
      expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
    };
    sessions.set(env, next);
    return next;
  } catch {
    return login(env);
  }
}

export async function getShreeMarutiGatewaySession(env: Environment): Promise<GatewaySession> {
  const current = sessions.get(env);
  if (!current) return login(env);
  if (current.expiresAt - 300_000 > Date.now()) return current;
  return refresh(env, current);
}

export interface GatewayFetchOptions {
  forceBearer?: boolean;
  retryTemporary?: boolean;
}

/** Uses API-key by default and Bearer auth when an endpoint needs tenant/user identity. */
export async function shreeMarutiGatewayFetch(
  env: Environment,
  path: string,
  init: RequestInit = {},
  options: GatewayFetchOptions = {},
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${shreeMarutiGatewayBase(env)}${path}`;
  const key = apiKey();
  let bearerSession: GatewaySession | null = null;

  const headersForCall = async (refreshAuth = false): Promise<Record<string, string>> => {
    if (key && !options.forceBearer) return { "api-key": key };
    bearerSession = refreshAuth
      ? await login(env)
      : await getShreeMarutiGatewaySession(env);
    return { Authorization: `Bearer ${bearerSession.token}`, tenantid: bearerSession.tenantId };
  };

  const execute = async (authHeaders: Record<string, string>) => fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
      ...(init.headers || {}),
    },
  });

  let response = await execute(await headersForCall());
  if ((response.status === 401 || response.status === 403) && (!key || options.forceBearer)) {
    sessions.delete(env);
    response = await execute(await headersForCall(true));
  }

  if (options.retryTemporary && (response.status === 429 || response.status >= 500)) {
    await new Promise((resolve) => setTimeout(resolve, response.status === 429 ? 750 : 300));
    response = await execute(await headersForCall());
  }
  return response;
}

export async function readGatewayError(response: Response): Promise<{ data: any; message: string; traceId: string | null }> {
  const text = await response.text();
  const data = parseJson(text);
  return {
    data,
    message: errorMessage(data, `Shree Maruti request failed (${response.status})`),
    traceId: data?.traceId || data?.trace_id || null,
  };
}