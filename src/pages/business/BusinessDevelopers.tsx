import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { useToast } from "@/hooks/use-toast";
import PageSeo from "@/components/PageSeo";
import { isBusinessDemoSession } from "@/lib/business-demo";

const ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "tksfdvnogzsweteetjjw"}.supabase.co/functions/v1/merchant-api`;

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  environment: string;
  scopes: string[];
  expires_at: string | null;
  rate_limit_per_minute: number;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const FULL_SCOPES = ["rates:read", "shipments:read", "shipments:write", "shipments:cancel", "wallet:read"];
const READ_SCOPES = ["rates:read", "shipments:read", "wallet:read"];

const DEMO_KEYS: ApiKey[] = [
  { id: "demo-key-1", name: "Sample WooCommerce store", key_prefix: "vs_test_demo", environment: "sandbox", scopes: FULL_SCOPES, expires_at: "2027-01-18T06:30:00.000Z", rate_limit_per_minute: 120, last_used_at: "2026-10-20T08:42:00.000Z", revoked_at: null, created_at: "2026-10-18T06:30:00.000Z" },
];

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "Never");

const EXAMPLES: { title: string; desc: string; body: string; idem?: boolean }[] = [
  { title: "Check rates", desc: "Returns every courier that serves the route, cheapest first. Prices include 18% GST.",
    body: `{"action":"rates","pickup_pincode":"411001","delivery_pincode":"560001","boxes":[{"weight_kg":0.5,"length_cm":20,"width_cm":15,"height_cm":10}]}` },
  { title: "Create shipment", desc: "Charged from your wallet. Omit partner_code to pick the cheapest. Send a unique Idempotency-Key per order so retries never double-book.", idem: true,
    body: `{"action":"create_shipment","partner_code":"delhivery","pickup":{"name":"My Store","phone":"9876543210","address":"12 MG Road","city":"Pune","state":"Maharashtra","pincode":"411001"},"delivery":{"name":"Customer","phone":"9123456780","address":"5 Brigade Rd","city":"Bengaluru","state":"Karnataka","pincode":"560001"},"boxes":[{"weight_kg":0.5,"length_cm":20,"width_cm":15,"height_cm":10}],"goods_type":"Apparel","declared_value":999}` },
  { title: "Track", desc: "By booking_id or awb.", body: `{"action":"track","awb":"AWB_NUMBER"}` },
  { title: "Get label", desc: "Returns a label link. Add box_index for multi-box shipments.", body: `{"action":"label","booking_id":"BOOKING_ID"}` },
  { title: "Cancel", desc: "Before pickup only. Amount is credited back to the wallet.", body: `{"action":"cancel","booking_id":"BOOKING_ID","reason":"Customer cancelled"}` },
  { title: "Wallet balance", desc: "", body: `{"action":"wallet"}` },
];

const BusinessDevelopers = () => {
  const { business } = useBusinessAuth();
  const { toast } = useToast();
  const isDemo = isBusinessDemoSession();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [env, setEnv] = useState(isDemo ? "sandbox" : "live");
  const [access, setAccess] = useState("full");
  const [expiry, setExpiry] = useState("90");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    if (isDemo) {
      setKeys((current) => current.length ? current : DEMO_KEYS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("business_api_keys")
      .select("id,name,key_prefix,environment,scopes,expires_at,rate_limit_per_minute,last_used_at,revoked_at,created_at")
      .eq("business_account_id", business.id).order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load API keys", description: error.message, variant: "destructive" });
    setKeys((data ?? []) as ApiKey[]);
    setLoading(false);
  }, [business, isDemo, toast]);
  useEffect(() => { load(); }, [load]);

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast({ title: "Copied" }); };

  const create = async () => {
    if (isDemo) {
      const createdAt = new Date().toISOString();
      const sampleKey = `vs_test_sample_only_${crypto.randomUUID().replace(/-/g, "")}`;
      const expiresAt = expiry === "never" ? null : new Date(Date.now() + Number(expiry) * 86_400_000).toISOString();
      setKeys((current) => [{ id: crypto.randomUUID(), name: name.trim(), key_prefix: sampleKey.slice(0, 12), environment: "sandbox", scopes: access === "read" ? READ_SCOPES : FULL_SCOPES, expires_at: expiresAt, rate_limit_per_minute: 120, last_used_at: null, revoked_at: null, created_at: createdAt }, ...current]);
      setNewKey(sampleKey);
      setName("");
      setEnv("sandbox");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("business-api-keys", {
      body: {
        action: "create",
        name,
        environment: env,
        scopes: access === "read" ? READ_SCOPES : FULL_SCOPES,
        expires_in_days: expiry === "never" ? "never" : Number(expiry),
        rate_limit_per_minute: 120,
      },
    });
    setCreating(false);
    if (error || !data?.key) { toast({ title: "Could not create key", description: data?.error || error?.message, variant: "destructive" }); return; }
    setNewKey(data.key); setName(""); load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Websites using it will stop working immediately.")) return;
    if (isDemo) {
      setKeys((current) => current.map((key) => key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key));
      toast({ title: "Sample key revoked", description: "Only local demo state changed." });
      return;
    }
    const { data, error } = await supabase.functions.invoke("business-api-keys", { body: { action: "revoke", id } });
    if (error || !data?.success) toast({ title: "Could not revoke", description: data?.error || error?.message, variant: "destructive" });
    else { toast({ title: "Key revoked" }); load(); }
  };

  const curl = (body: string, idem?: boolean) =>
    `curl -X POST '${ENDPOINT}' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -H 'Content-Type: application/json' \\\n${idem ? "  -H 'Idempotency-Key: ORDER-12345' \\\n" : ""}  -d '${body}'`;

  return (
    <div className="min-h-screen bg-transparent">
      <PageSeo title="API & Integrations | ViaSetu for Businesses" description="API keys and shipping API docs." path="/viasetuforbusinesses/developers" />
      <main className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">API & Webhooks</h1>{isDemo ? <Badge variant="secondary">Sandbox preview</Badge> : null}</div>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Create account-scoped server keys and connect a trusted website, WooCommerce plugin or backend service.</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-cyan-200/70 bg-cyan-50/70 p-4 text-sm text-cyan-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div><p className="font-bold">Server-side credentials only</p><p className="mt-0.5 text-xs leading-5 text-cyan-900/75">Keys are stored as hashes and the full value is shown once. Never expose a key in React browser code or a public repository.</p></div>
        </div>
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList><TabsTrigger value="keys">API Keys</TabsTrigger><TabsTrigger value="docs">Documentation</TabsTrigger></TabsList>

          <TabsContent value="keys" className="space-y-4">
            <Card className="merchant-surface merchant-bordered-card">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" />Create a key</CardTitle>
                <CardDescription>Use a separate, limited key for each website or backend. Shipment creation remains in controlled rollout until wallet refund verification is approved.</CardDescription></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_180px_150px_auto] xl:items-end">
                <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shopify store" maxLength={60} /></div>
                <div className="space-y-1"><Label htmlFor="api-key-environment">Environment</Label>
                  <Select value={env} onValueChange={setEnv}><SelectTrigger id="api-key-environment"><SelectValue /></SelectTrigger>
                    <SelectContent>{!isDemo ? <SelectItem value="live">Live</SelectItem> : null}<SelectItem value="sandbox">Sandbox</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="api-key-access">Access</Label>
                  <Select value={access} onValueChange={setAccess}><SelectTrigger id="api-key-access"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="full">Shipping + read</SelectItem><SelectItem value="read">Read only</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label htmlFor="api-key-expiry">Expires</Label>
                  <Select value={expiry} onValueChange={setExpiry}><SelectTrigger id="api-key-expiry"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent></Select></div>
                <Button onClick={create} disabled={creating || name.trim().length < 2}>{creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create key</Button>
              </CardContent>
            </Card>
            <Card className="merchant-bordered-card">
              <CardHeader><CardTitle className="text-base">Your keys</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : keys.length === 0 ? <p className="text-sm text-muted-foreground">No keys yet.</p> :
                  keys.map((k) => (
                    <div key={k.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-lg p-3">
                      <div className="min-w-0">
                        <p className="font-medium flex items-center gap-2">{k.name}
                          <Badge variant={k.environment === "live" ? "default" : "secondary"}>{k.environment}</Badge>
                          {k.revoked_at && <Badge variant="destructive">Revoked</Badge>}</p>
                        <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</p>
                        <p className="text-xs text-muted-foreground">{k.scopes?.length ?? 0} scopes · {k.rate_limit_per_minute ?? 120} requests/min · Expires {k.expires_at ? fmt(k.expires_at) : "never"}</p>
                        <p className="text-xs text-muted-foreground">Created {fmt(k.created_at)} · Last used {fmt(k.last_used_at)}</p>
                      </div>
                      {!k.revoked_at && <Button size="sm" variant="outline" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4 mr-1" />Revoke</Button>}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            <Card className="merchant-bordered-card">
              <CardHeader><CardTitle className="text-base">Getting started</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>All requests are <b>POST</b> to one address, with your key in the <code>Authorization</code> header and an <code>action</code> in the JSON body.</p>
                <div className="flex gap-2 items-center"><code className="text-xs bg-muted p-2 rounded break-all flex-1">{ENDPOINT}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(ENDPOINT)}><Copy className="h-4 w-4" /></Button></div>
                <p className="text-muted-foreground">Keys are limited to 120 requests per minute. HTTP 429 responses include a <code>Retry-After</code> header. Rotate expiring keys before their deadline.</p>
                <p className="text-muted-foreground">Shipment creation is currently a controlled rollout. When enabled for your account, keep your wallet topped up; insufficient balances return HTTP 402 and failed or cancelled shipments are refunded automatically.</p>
                <p className="text-muted-foreground">Errors look like <code>{`{"success":false,"error":{"code":"...","message":"..."}}`}</code>.</p>
              </CardContent>
            </Card>
            {EXAMPLES.map((ex) => (
              <Card key={ex.title} className="merchant-bordered-card">
                <CardHeader className="pb-2"><CardTitle className="text-base">{ex.title}</CardTitle>{ex.desc && <CardDescription>{ex.desc}</CardDescription>}</CardHeader>
                <CardContent>
                  <div className="relative">
                    <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre">{curl(ex.body, ex.idem)}</pre>
                    <Button size="sm" variant="ghost" className="absolute top-1 right-1" onClick={() => copy(curl(ex.body, ex.idem))}><Copy className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!newKey} onOpenChange={(o) => !o && setNewKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copy your new key now</DialogTitle>
            <DialogDescription>{isDemo ? "This is a local sample token and cannot call the ViaSetu API." : "For security it won't be shown again. Store it safely and never put it in browser code."}</DialogDescription></DialogHeader>
          <code className="text-xs bg-muted p-3 rounded break-all">{newKey}</code>
          <Button onClick={() => newKey && copy(newKey)}><Copy className="h-4 w-4 mr-1" />Copy key</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessDevelopers;
