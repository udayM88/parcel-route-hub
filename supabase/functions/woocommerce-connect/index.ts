import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { merchantCan, resolveMerchantAccess } from "../_shared/merchant-access.ts";
import { isAllowedWebhookUrl } from "../_shared/webhook-security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const randomHex = (bytes: number) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomBase64Url = (bytes: number) => {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const sha256Bytes = async (value: string) => new Uint8Array(
  await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
);

const sha256Hex = async (value: string) => Array.from(await sha256Bytes(value))
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

const sha256Base64Url = async (value: string) => btoa(String.fromCharCode(...await sha256Bytes(value)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

type ConnectionUrls = {
  siteUrl: string;
  redirectUri: string;
  webhookUrl: string;
};

function validateConnectionUrls(body: Record<string, unknown>): ConnectionUrls | string {
  try {
    const site = new URL(String(body.site_url || ""));
    const redirect = new URL(String(body.redirect_uri || ""));
    const webhook = new URL(String(body.webhook_url || ""));

    if (site.protocol !== "https:" || site.username || site.password) return "The store URL must use HTTPS.";
    if (!isAllowedWebhookUrl(webhook.toString())) return "The webhook URL is not a public HTTPS address.";
    if (redirect.protocol !== "https:" || redirect.username || redirect.password) return "The callback URL must use HTTPS.";
    if (site.origin !== redirect.origin || site.origin !== webhook.origin) return "Store, callback and webhook URLs must use the same origin.";
    if (!/\/wp-admin\/admin-post\.php$/i.test(redirect.pathname) || redirect.searchParams.get("action") !== "viasetu_connect_callback") {
      return "The callback must be the ViaSetu WordPress admin handler.";
    }
    const webhookPathOk = /\/wp-json\/viasetu\/v1\/webhook\/?$/i.test(webhook.pathname)
      || webhook.searchParams.get("rest_route") === "/viasetu/v1/webhook";
    if (!webhookPathOk) return "The webhook must be the ViaSetu WordPress REST endpoint.";

    site.hash = "";
    site.search = "";
    site.pathname = site.pathname.replace(/\/$/, "") || "/";
    redirect.hash = "";
    webhook.hash = "";
    return {
      siteUrl: site.toString().replace(/\/$/, ""),
      redirectUri: redirect.toString(),
      webhookUrl: webhook.toString(),
    };
  } catch {
    return "Store connection URLs are invalid.";
  }
}

function configuredDemoStoreOrigins(): Set<string> {
  const configured = Deno.env.get("WOOCOMMERCE_DEMO_STORE_ORIGINS") || "";
  const origins = new Set<string>();
  for (const value of configured.split(",")) {
    try {
      const url = new URL(value.trim());
      if (url.protocol === "https:" && !url.username && !url.password) origins.add(url.origin);
    } catch {
      // Invalid entries remain closed instead of weakening the allowlist.
    }
  }
  return origins;
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

async function verifySandboxStoreProof(urls: ConnectionUrls, state: string, challenge: string): Promise<boolean> {
  const proofUrl = new URL(urls.webhookUrl);
  if (proofUrl.searchParams.get("rest_route") === "/viasetu/v1/webhook") {
    proofUrl.searchParams.set("rest_route", "/viasetu/v1/connect-proof");
  } else {
    proofUrl.pathname = proofUrl.pathname.replace(/\/webhook\/?$/i, "/connect-proof");
  }
  proofUrl.searchParams.set("state", state);
  proofUrl.searchParams.set("code_challenge", challenge);
  proofUrl.searchParams.set("environment", "sandbox");
  try {
    const response = await fetch(proofUrl, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json", "User-Agent": "ViaSetu-WooCommerce-Connect/1" },
    });
    const text = await response.text();
    if (!response.ok || text.length > 4096) return false;
    const payload = JSON.parse(text);
    return payload?.valid === true;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Use POST." }, 405);

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ success: false, error: "Body must be a JSON object." }, 400);
    const action = String(body.action || "");
    const urls = validateConnectionUrls(body);
    if (typeof urls === "string") return json({ success: false, error: urls }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "authorize" || action === "authorize_demo_sandbox") {
      const challenge = String(body.code_challenge || "");
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
        return json({ success: false, error: "The connection challenge is invalid." }, 400);
      }
      const environment = body.environment === "sandbox" ? "sandbox" : "live";
      const pluginVersion = String(body.plugin_version || "").replace(/[^0-9A-Za-z._-]/g, "").slice(0, 30);
      if (!pluginVersion) return json({ success: false, error: "Plugin version is required." }, 400);
      const storeName = String(body.store_name || new URL(urls.siteUrl).hostname).trim().replace(/[<>]/g, "").slice(0, 100);
      if (storeName.length < 2) return json({ success: false, error: "Store name is required." }, 400);

      let businessAccountId = "";
      let createdBy = "";

      if (action === "authorize_demo_sandbox") {
        if (environment !== "sandbox") {
          return json({ success: false, error: "Sample access is available only for a sandbox store." }, 403);
        }
        const demoBusinessId = (Deno.env.get("WOOCOMMERCE_DEMO_BUSINESS_ACCOUNT_ID") || "").trim();
        const allowedOrigins = configuredDemoStoreOrigins();
        if (!isUuid(demoBusinessId) || allowedOrigins.size === 0) {
          return json({ success: false, error: "The controlled WooCommerce sandbox is not configured yet." }, 503);
        }
        if (!allowedOrigins.has(new URL(urls.siteUrl).origin)) {
          return json({ success: false, error: "This store is not approved for the controlled WooCommerce sandbox." }, 403);
        }
        const state = String(body.state || "");
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(state) || !await verifySandboxStoreProof(urls, state, challenge)) {
          return json({ success: false, error: "The sandbox request could not be verified with this WordPress store. Start the connection again from WordPress." }, 403);
        }
        const { data: demoBusiness, error: demoBusinessError } = await admin.from("business_accounts")
          .select("id,user_id,status,is_active")
          .eq("id", demoBusinessId)
          .maybeSingle();
        if (demoBusinessError || !demoBusiness || !demoBusiness.is_active || demoBusiness.status !== "approved" || !isUuid(String(demoBusiness.user_id || ""))) {
          console.error("[woocommerce-connect] configured demo business is unavailable");
          return json({ success: false, error: "The controlled WooCommerce sandbox is not available." }, 503);
        }
        businessAccountId = demoBusiness.id;
        createdBy = demoBusiness.user_id;
      } else {
        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return json({ success: false, error: "Sign in to authorize this store." }, 401);
        const auth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userResult } = await auth.auth.getUser();
        if (!userResult.user) return json({ success: false, error: "Your merchant session is invalid or expired." }, 401);

        const access = await resolveMerchantAccess(admin, userResult.user);
        if (!merchantCan(access, "integrations:write")) {
          return json({ success: false, error: "Your merchant role cannot connect stores." }, 403);
        }
        businessAccountId = access!.business_account_id;
        createdBy = userResult.user.id;
      }

      const recentWindow = new Date(Date.now() - 10 * 60_000).toISOString();
      const { count: recentAttempts, error: attemptError } = await admin
        .from("merchant_integration_authorizations")
        .select("id", { count: "exact", head: true })
        .eq("business_account_id", businessAccountId)
        .is("used_at", null)
        .gte("created_at", recentWindow);
      if (attemptError) {
        console.error("[woocommerce-connect] authorization limit check failed", attemptError.message);
        return json({ success: false, error: "Could not prepare this connection." }, 500);
      }
      if ((recentAttempts || 0) >= 10) {
        return json({ success: false, error: "Too many connection attempts. Try again in a few minutes." }, 429);
      }

      const code = randomBase64Url(32);
      const { error } = await admin.from("merchant_integration_authorizations").insert({
        code_hash: await sha256Hex(code),
        business_account_id: businessAccountId,
        platform: "woocommerce",
        environment,
        store_name: storeName,
        site_url: urls.siteUrl,
        redirect_uri: urls.redirectUri,
        webhook_url: urls.webhookUrl,
        code_challenge: challenge,
        plugin_version: pluginVersion,
        created_by: createdBy,
        expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      if (error) {
        console.error("[woocommerce-connect] authorization insert failed", error.message);
        return json({ success: false, error: "Could not prepare this connection." }, 500);
      }
      return json({ success: true, code, expires_in: 300 });
    }

    if (action === "exchange") {
      const code = String(body.code || "");
      const verifier = String(body.code_verifier || "");
      if (!/^[A-Za-z0-9_-]{43,128}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
        return json({ success: false, error: "The connection code is invalid or expired." }, 400);
      }

      const codeHash = await sha256Hex(code);
      const { data: pendingAuthorization, error: pendingError } = await admin
        .from("merchant_integration_authorizations")
        .select("environment")
        .eq("code_hash", codeHash)
        .is("used_at", null)
        .maybeSingle();
      if (pendingError || !pendingAuthorization) {
        return json({ success: false, error: "The connection code is invalid, expired or already used." }, 400);
      }
      const keyEnvironment = pendingAuthorization.environment === "sandbox" ? "sandbox" : "live";
      const key = `vs_${keyEnvironment === "live" ? "live" : "test"}_${randomHex(24)}`;
      const signingSecret = randomHex(32);
      const { data: result, error: exchangeError } = await admin.rpc("exchange_woocommerce_authorization", {
        _code_hash: codeHash,
        _code_challenge: await sha256Base64Url(verifier),
        _site_url: urls.siteUrl,
        _redirect_uri: urls.redirectUri,
        _webhook_url: urls.webhookUrl,
        _key_prefix: key.slice(0, 12),
        _key_hash: await sha256Hex(key),
        _signing_secret: signingSecret,
      });
      if (exchangeError) {
        console.error("[woocommerce-connect] exchange failed", exchangeError.message);
        return json({ success: false, error: "Could not finish this connection." }, 500);
      }
      if (!result?.ok) {
        const message = result?.error === "active_key_limit"
          ? "This merchant account already has the maximum number of active API keys."
          : "The connection code is invalid, expired or already used.";
        return json({ success: false, error: message }, 400);
      }

      const { data: account } = await admin.from("business_accounts")
        .select("company_name,contact_person,email")
        .eq("id", result.business_account_id).maybeSingle();
      return json({
        success: true,
        api_key: key,
        webhook_secret: signingSecret,
        connection_id: result.connection_id,
        environment: result.environment,
        merchant: account || null,
      });
    }

    return json({ success: false, error: "Unknown connection action." }, 400);
  } catch (error) {
    console.error("[woocommerce-connect]", error);
    return json({ success: false, error: "Unexpected connection error." }, 500);
  }
});
