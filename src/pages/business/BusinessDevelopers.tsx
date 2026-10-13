import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, KeyRound, Loader2, Trash2 } from "lucide-react";
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

const ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || "tksfdvnogzsweteetjjw"}.supabase.co/functions/v1/merchant-api`;

type ApiKey = { id: string; name: string; key_prefix: string; environment: string; last_used_at: string | null; revoked_at: string | null; created_at: string };

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
  const navigate = useNavigate();
  const { business } = useBusinessAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [env, setEnv] = useState("live");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!business) return;
    const { data } = await supabase.from("business_api_keys")
      .select("id,name,key_prefix,environment,last_used_at,revoked_at,created_at")
      .eq("business_account_id", business.id).order("created_at", { ascending: false });
    setKeys((data ?? []) as ApiKey[]);
    setLoading(false);
  }, [business]);
  useEffect(() => { load(); }, [load]);

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast({ title: "Copied" }); };

  const create = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("business-api-keys", { body: { action: "create", name, environment: env } });
    setCreating(false);
    if (error || !data?.key) { toast({ title: "Could not create key", description: data?.error || error?.message, variant: "destructive" }); return; }
    setNewKey(data.key); setName(""); load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? Websites using it will stop working immediately.")) return;
    const { data, error } = await supabase.functions.invoke("business-api-keys", { body: { action: "revoke", id } });
    if (error || !data?.success) toast({ title: "Could not revoke", description: data?.error || error?.message, variant: "destructive" });
    else { toast({ title: "Key revoked" }); load(); }
  };

  const curl = (body: string, idem?: boolean) =>
    `curl -X POST '${ENDPOINT}' \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -H 'Content-Type: application/json' \\\n${idem ? "  -H 'Idempotency-Key: ORDER-12345' \\\n" : ""}  -d '${body}'`;

  return (
    <div className="min-h-screen bg-muted/30">
      <PageSeo title="API & Integrations | ViaSetu for Businesses" description="API keys and shipping API docs." path="/viasetuforbusinesses/developers" />
      <header className="bg-background border-b">
        <div className="max-w-5xl mx-auto flex items-center gap-3 p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/viasetuforbusinesses/dashboard")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="font-bold">API & Integrations</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <Tabs defaultValue="keys" className="space-y-4">
          <TabsList><TabsTrigger value="keys">API Keys</TabsTrigger><TabsTrigger value="docs">Documentation</TabsTrigger></TabsList>

          <TabsContent value="keys" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" />Create a key</CardTitle>
                <CardDescription>Give one key to each website or system. Live keys charge your wallet and book real shipments; sandbox keys use courier test systems.</CardDescription></CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shopify store" maxLength={60} /></div>
                <div className="space-y-1 sm:w-40"><Label>Environment</Label>
                  <Select value={env} onValueChange={setEnv}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="sandbox">Sandbox</SelectItem></SelectContent></Select></div>
                <Button onClick={create} disabled={creating || name.trim().length < 2}>{creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create key</Button>
              </CardContent>
            </Card>
            <Card>
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
                        <p className="text-xs text-muted-foreground">Created {fmt(k.created_at)} · Last used {fmt(k.last_used_at)}</p>
                      </div>
                      {!k.revoked_at && <Button size="sm" variant="outline" onClick={() => revoke(k.id)}><Trash2 className="h-4 w-4 mr-1" />Revoke</Button>}
                    </div>
                  ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Getting started</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>All requests are <b>POST</b> to one address, with your key in the <code>Authorization</code> header and an <code>action</code> in the JSON body.</p>
                <div className="flex gap-2 items-center"><code className="text-xs bg-muted p-2 rounded break-all flex-1">{ENDPOINT}</code>
                  <Button size="sm" variant="outline" onClick={() => copy(ENDPOINT)}><Copy className="h-4 w-4" /></Button></div>
                <p className="text-muted-foreground">Keep your wallet topped up — shipments are refused with error <code>insufficient_balance</code> (HTTP 402) when the balance can't cover the price. Failed or cancelled shipments are refunded to the wallet automatically.</p>
                <p className="text-muted-foreground">Errors look like <code>{`{"success":false,"error":{"code":"...","message":"..."}}`}</code>.</p>
              </CardContent>
            </Card>
            {EXAMPLES.map((ex) => (
              <Card key={ex.title}>
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
            <DialogDescription>For security it won't be shown again. Store it safely and never put it in browser code.</DialogDescription></DialogHeader>
          <code className="text-xs bg-muted p-3 rounded break-all">{newKey}</code>
          <Button onClick={() => newKey && copy(newKey)}><Copy className="h-4 w-4 mr-1" />Copy key</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BusinessDevelopers;
