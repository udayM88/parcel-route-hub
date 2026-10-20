import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Home, Loader2, MapPin, Plus, RefreshCw, Trash2, Warehouse } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isBusinessDemoSession } from "@/lib/business-demo";
import { supabase } from "@/integrations/supabase/client";

type SavedAddress = {
  id: string;
  user_id: string;
  label: string | null;
  name: string;
  phone: string;
  flat_no: string | null;
  address: string;
  city: string;
  state: string;
  pincode: string;
  use_count: number | null;
  created_at: string;
};

const DEMO_ADDRESSES: SavedAddress[] = [{
  id: "demo-address-1",
  user_id: "demo-merchant",
  label: "Warehouse",
  name: "Sample Merchant Dispatch",
  phone: "9999999999",
  flat_no: "Unit 12",
  address: "Commerce Park, Baner Road",
  city: "Pune",
  state: "Maharashtra",
  pincode: "411045",
  use_count: 12,
  created_at: "2026-10-20T08:00:00.000Z",
}];

const initialForm = { label: "Warehouse", name: "", phone: "", flat_no: "", address: "", city: "", state: "", pincode: "" };

export default function BusinessAddressesPanel() {
  const isDemo = isBusinessDemoSession();
  const [addresses, setAddresses] = useState<SavedAddress[]>(isDemo ? DEMO_ADDRESSES : []);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(!isDemo);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (isDemo) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: queryError } = await supabase
        .from("saved_addresses")
        .select("id,user_id,label,name,phone,flat_no,address,city,state,pincode,use_count,created_at")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false });
      if (queryError) throw queryError;
      setAddresses((data as SavedAddress[]) || []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Addresses could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (field: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !/^\d{10}$/.test(form.phone) || !form.address.trim() || !form.city.trim() || !form.state.trim() || !/^\d{6}$/.test(form.pincode)) {
      setError("Enter a name, 10-digit phone, complete address and 6-digit pincode.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const now = new Date().toISOString();
      if (isDemo) {
        setAddresses((current) => [{ id: `demo-address-${current.length + 1}`, user_id: "demo-merchant", ...form, use_count: 0, created_at: now }, ...current]);
        setForm(initialForm);
        return;
      }
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
      const { data, error: insertError } = await supabase
        .from("saved_addresses")
        .insert({ user_id: authData.user.id, ...form })
        .select("id,user_id,label,name,phone,flat_no,address,city,state,pincode,use_count,created_at")
        .single();
      if (insertError) throw insertError;
      setAddresses((current) => [data as SavedAddress, ...current]);
      setForm(initialForm);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Address could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (address: SavedAddress) => {
    setDeleting(address.id);
    setError("");
    try {
      if (!isDemo) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error("Your session has expired. Please sign in again.");
        const { error: deleteError } = await supabase.from("saved_addresses").delete().eq("id", address.id).eq("user_id", authData.user.id);
        if (deleteError) throw deleteError;
      }
      setAddresses((current) => current.filter((item) => item.id !== address.id));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Address could not be removed.");
    } finally {
      setDeleting(null);
    }
  };

  const iconFor = (label: string | null) => label === "Warehouse" ? Warehouse : label === "Office" ? Building2 : Home;

  return (
    <div className="space-y-4">
      {isDemo ? <Alert className="border-amber-200 bg-amber-50/80 text-amber-950"><MapPin /><AlertTitle>Sample address book</AlertTitle><AlertDescription>Addresses added or removed here stay in this browser session and never reach Supabase.</AlertDescription></Alert> : null}
      {error ? <Alert variant="destructive"><MapPin /><AlertTitle>Address action could not be completed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="merchant-bordered-card">
          <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Saved pickup addresses</CardTitle><CardDescription>Only addresses owned by the signed-in account are shown.</CardDescription></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Refresh addresses"><RefreshCw className={loading ? "animate-spin" : ""} /></Button></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {!loading && addresses.length === 0 ? <div className="col-span-full grid min-h-64 place-items-center rounded-xl border border-dashed bg-muted/20 text-center"><div><MapPin className="mx-auto mb-3 size-9 text-primary/60" /><p className="font-bold">No saved addresses</p><p className="mt-1 text-sm text-muted-foreground">Add your first pickup or return location.</p></div></div> : null}
            {addresses.map((address) => {
              const Icon = iconFor(address.label);
              return <div key={address.id} className="rounded-xl border bg-card p-4 transition hover:border-primary/35"><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent text-primary"><Icon className="size-5" /></span><Button variant="ghost" size="icon" onClick={() => void remove(address)} disabled={deleting === address.id} aria-label={`Remove ${address.label || "address"}`}>{deleting === address.id ? <Loader2 className="animate-spin" /> : <Trash2 />}</Button></div><div className="mt-3 flex items-center gap-2"><p className="font-extrabold">{address.name}</p><Badge variant="secondary">{address.label || "Address"}</Badge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{[address.flat_no, address.address, address.city, address.state, address.pincode].filter(Boolean).join(", ")}</p><p className="mt-2 text-xs font-semibold">+91 {address.phone}</p></div>;
            })}
          </CardContent>
        </Card>

        <Card className="merchant-surface merchant-bordered-card">
          <form onSubmit={save}>
            <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" />Add an address</CardTitle><CardDescription>Use a dispatch-ready pickup or return location.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Address type</Label><Select value={form.label} onValueChange={(value) => update("label", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Warehouse">Warehouse</SelectItem><SelectItem value="Office">Office</SelectItem><SelectItem value="Home">Home</SelectItem><SelectItem value="Return">Return</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="address-contact">Contact name</Label><Input id="address-contact" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Dispatch contact" /></div></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="address-phone">Phone</Label><Input id="address-phone" inputMode="numeric" value={form.phone} onChange={(event) => update("phone", event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit number" /></div><div className="space-y-2"><Label htmlFor="address-flat">Unit / floor</Label><Input id="address-flat" value={form.flat_no} onChange={(event) => update("flat_no", event.target.value)} placeholder="Optional" /></div></div>
              <div className="space-y-2"><Label htmlFor="address-line">Address</Label><Input id="address-line" value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Building, road and locality" /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="address-city">City</Label><Input id="address-city" value={form.city} onChange={(event) => update("city", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="address-state">State</Label><Input id="address-state" value={form.state} onChange={(event) => update("state", event.target.value)} /></div></div>
              <div className="space-y-2"><Label htmlFor="address-pincode">Pincode</Label><Input id="address-pincode" inputMode="numeric" value={form.pincode} onChange={(event) => update("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" /></div>
            </CardContent>
            <CardFooter className="justify-end border-t pt-4"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}Save address</Button></CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
