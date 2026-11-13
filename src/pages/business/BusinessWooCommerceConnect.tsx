import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, PlugZap, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";

import viasetuLogo from "@/assets/merchant-console/viasetu.png";
import PageSeo from "@/components/PageSeo";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";

type ConnectionRequest = {
  siteUrl: string;
  redirectUri: string;
  webhookUrl: string;
  codeChallenge: string;
  state: string;
  storeName: string;
  environment: "live" | "sandbox";
  pluginVersion: string;
  hostname: string;
};

function readConnectionRequest(params: URLSearchParams): ConnectionRequest | null {
  try {
    const site = new URL(params.get("site_url") || "");
    const redirect = new URL(params.get("redirect_uri") || "");
    const webhook = new URL(params.get("webhook_url") || "");
    const codeChallenge = params.get("code_challenge") || "";
    const state = params.get("state") || "";
    const pluginVersion = (params.get("plugin_version") || "").replace(/[^0-9A-Za-z._-]/g, "").slice(0, 30);
    const environment = params.get("environment") === "sandbox" ? "sandbox" : "live";
    const callbackOk = /\/wp-admin\/admin-post\.php$/i.test(redirect.pathname)
      && redirect.searchParams.get("action") === "viasetu_connect_callback";
    const webhookOk = /\/wp-json\/viasetu\/v1\/webhook\/?$/i.test(webhook.pathname)
      || webhook.searchParams.get("rest_route") === "/viasetu/v1/webhook";
    if (site.protocol !== "https:" || redirect.protocol !== "https:" || webhook.protocol !== "https:") return null;
    if (site.username || site.password || redirect.username || redirect.password || webhook.username || webhook.password) return null;
    if (site.origin !== redirect.origin || site.origin !== webhook.origin || !callbackOk || !webhookOk) return null;
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) || !/^[A-Za-z0-9_-]{32,128}$/.test(state) || !pluginVersion) return null;
    const requestedStoreName = (params.get("store_name") || "").trim().slice(0, 100);
    return {
      siteUrl: site.toString().replace(/\/$/, ""),
      redirectUri: redirect.toString(),
      webhookUrl: webhook.toString(),
      codeChallenge,
      state,
      storeName: requestedStoreName.length >= 2 ? requestedStoreName : site.hostname,
      environment,
      pluginVersion,
      hostname: site.hostname,
    };
  } catch {
    return null;
  }
}

export default function BusinessWooCommerceConnect() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { business, can } = useBusinessAuth();
  const [connecting, setConnecting] = useState(false);
  const request = useMemo(() => readConnectionRequest(params), [params]);
  const isDemo = isBusinessDemoSession();

  const authorize = async () => {
    if (!request || !business || isDemo || !can("integrations:write")) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("woocommerce-connect", {
        body: {
          action: "authorize",
          site_url: request.siteUrl,
          redirect_uri: request.redirectUri,
          webhook_url: request.webhookUrl,
          code_challenge: request.codeChallenge,
          store_name: request.storeName,
          environment: request.environment,
          plugin_version: request.pluginVersion,
        },
      });
      if (error || !data?.success || !data?.code) throw new Error(data?.error || error?.message || "Connection authorization failed.");
      const callback = new URL(request.redirectUri);
      callback.searchParams.set("code", data.code);
      callback.searchParams.set("state", request.state);
      window.location.assign(callback.toString());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection authorization failed.");
      setConnecting(false);
    }
  };

  if (!request) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#eef3f6] p-5">
        <PageSeo title="Invalid store connection | ViaSetu" description="The WooCommerce connection request is invalid." path="/viasetuforbusinesses/connect/woocommerce" />
        <Card className="w-full max-w-xl border-red-200 shadow-xl">
          <CardHeader><CardTitle>Connection link is invalid</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Return to WordPress and start the ViaSetu connection again. Connection links are bound to one HTTPS store and expire quickly.</p></CardContent>
          <CardFooter><Button onClick={() => navigate("/viasetuforbusinesses/dashboard")}>Open merchant dashboard</Button></CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#e9f1f4_0%,#f8fafb_45%,#e2f3f2_100%)] px-4 py-8 text-[#152330] sm:px-6">
      <PageSeo title="Connect WooCommerce | ViaSetu Merchant" description="Approve a secure WooCommerce store connection." path="/viasetuforbusinesses/connect/woocommerce" />
      <div className="mx-auto w-full max-w-3xl">
        <button type="button" onClick={() => navigate("/viasetuforbusinesses/integrations?tab=plugins")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#365064] hover:text-[#0e8f8a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0e8f8a]">
          <ArrowLeft className="size-4" />Back to integrations
        </button>

        <Card className="overflow-hidden border-[#bfd4d9] bg-white shadow-[0_28px_70px_rgba(11,31,51,0.16)]">
          <div className="grid gap-5 bg-[#0b1f33] p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <img src={viasetuLogo} alt="ViaSetu" className="mb-6 h-9 w-auto rounded bg-white px-2 py-1" />
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Connect this WooCommerce store</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#c9d8e3]">Approve a dedicated, revocable bridge between this store and your ViaSetu merchant account.</p>
            </div>
            <div className="grid size-16 place-items-center rounded-2xl border border-white/15 bg-white/10"><PlugZap className="size-8 text-[#53d3cd]" /></div>
          </div>

          <CardContent className="space-y-6 p-6 sm:p-8">
            <section className="grid gap-4 rounded-xl border border-[#d5e2e6] bg-[#f7fafb] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="grid size-11 place-items-center rounded-lg bg-[#dff4f2] text-[#0e8f8a]"><Store className="size-5" /></div>
              <div className="min-w-0"><p className="font-bold">{request.storeName}</p><p className="truncate text-sm text-muted-foreground">{request.hostname}</p></div>
              <Badge variant={request.environment === "live" ? "default" : "secondary"}>{request.environment === "live" ? "Live store" : "Sandbox"}</Badge>
            </section>

            <section>
              <h2 className="text-base font-extrabold">This store will be able to</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {["Read live courier rates", "Create and manage shipments", "Read wallet and billing activity", "Receive signed tracking updates", "Fetch AWBs and shipping labels", "Cancel eligible shipments"].map((permission) => (
                  <div key={permission} className="flex items-start gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0e8f8a]" /><span>{permission}</span></div>
                ))}
              </div>
            </section>

            <Alert className="border-[#b9dedb] bg-[#effaf9]">
              <ShieldCheck className="text-[#0e8f8a]" />
              <AlertTitle>Secure store-scoped access</AlertTitle>
              <AlertDescription>ViaSetu never sends your password to WordPress. A dedicated API key is returned once to this HTTPS store, stored encrypted there, rate-limited, and revocable from your merchant account.</AlertDescription>
            </Alert>

            {isDemo ? <Alert className="border-amber-300 bg-amber-50"><LockKeyhole /><AlertTitle>Sample sessions cannot connect a live store</AlertTitle><AlertDescription>Sign out of the sample workspace and use an approved merchant account.</AlertDescription></Alert> : null}
            {!can("integrations:write") ? <Alert className="border-amber-300 bg-amber-50"><LockKeyhole /><AlertTitle>Permission required</AlertTitle><AlertDescription>Your merchant role does not allow store connections. Ask the owner or an administrator.</AlertDescription></Alert> : null}
          </CardContent>

          <CardFooter className="flex flex-col-reverse gap-3 border-t bg-[#f7fafb] p-6 sm:flex-row sm:justify-end sm:p-8">
            <Button variant="outline" onClick={() => navigate("/viasetuforbusinesses/integrations?tab=plugins")} disabled={connecting}>Cancel</Button>
            <Button className="bg-[#0e8f8a] hover:bg-[#0b7672]" onClick={() => void authorize()}
              disabled={connecting || isDemo || !can("integrations:write")}>
              {connecting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}Approve and connect
            </Button>
          </CardFooter>
        </Card>
        <p className="mt-4 text-center text-xs text-[#607586]">Plugin {request.pluginVersion} · Authorization expires in five minutes · You can disconnect at any time.</p>
      </div>
    </main>
  );
}
