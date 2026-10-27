import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Activity, CheckCircle2, CircleDollarSign, Download, FileSpreadsheet, FileText, Globe2,
  Loader2, MapPinCheck, PackageOpen, Plus, RefreshCw, Save, Scale, Send, Settings2,
  ShieldCheck, Trash2, Truck, Upload, UserRound, Users, Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBusinessAuth } from "@/contexts/useBusinessAuth";
import { CURRENT_ENV } from "@/config/environment";
import { supabase } from "@/integrations/supabase/client";
import { isBusinessDemoSession } from "@/lib/business-demo";
import { PARTNER_REGISTRY } from "@/lib/partnerSettings";

type JsonMap = Record<string, unknown>;
type Booking = {
  id: string; created_at: string; tracking_id: string | null; prayog_awb: string | null;
  receiver_name: string; courier_name: string; status: string | null; courier_price: number;
  dead_weight_g: number | null; volumetric_weight_g: number | null; chargeable_weight_g: number | null;
  payment_status: string | null;
};
type WalletTransaction = { id: string; type: string; amount: number; balance_after: number; note: string | null; created_at: string };
type ActivityRow = { id: string; action: string; resource_type: string; resource_id: string | null; details: JsonMap; created_at: string };
type ImportRow = { id: string; file_name: string; row_count: number; valid_row_count: number; status: string; created_at: string };
type WebhookRow = { id: string; endpoint_url: string; event_types: string[]; signing_secret: string; is_active: boolean; last_tested_at: string | null; last_test_status: number | null; last_delivery_at?: string | null; last_delivery_status?: number | null; created_at: string };

// These additive tables are present in the accompanying migration; the generated
// Supabase type file is refreshed after the migration is applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const inr = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
const when = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const human = (value: string | null) => (value || "created").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const downloadCsv = (name: string, rows: Array<Array<string | number | null | undefined>>) => {
  const escape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([rows.map((row) => row.map(escape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

function ModuleLoading() {
  return <Card><CardContent className="grid min-h-64 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></CardContent></Card>;
}

function EmptyState({ icon: Icon = PackageOpen, title, description }: { icon?: typeof PackageOpen; title: string; description: string }) {
  return <div className="grid min-h-64 place-items-center px-5 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-primary"><Icon className="size-7" /></span><p className="mt-4 font-extrabold">{title}</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p></div></div>;
}

function useBookings() {
  const { business } = useBusinessAuth();
  const isDemo = isBusinessDemoSession();
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(!isDemo);
  const load = useCallback(async () => {
    if (!business || isDemo) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("bookings")
      .select("id,created_at,tracking_id,prayog_awb,receiver_name,courier_name,status,courier_price,dead_weight_g,volumetric_weight_g,chargeable_weight_g,payment_status")
      .eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(500);
    if (error) toast.error(error.message);
    setRows((data as Booking[]) || []);
    setLoading(false);
  }, [business, isDemo]);
  useEffect(() => { void load(); }, [load]);
  return { rows, loading, load };
}

type SettingField = { key: string; label: string; description: string; type: "switch" | "text" | "select"; options?: string[] };
function SettingsEditor({ category, title, description, fields, defaults }: { category: string; title: string; description: string; fields: SettingField[]; defaults: JsonMap }) {
  const { business } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const initialDefaults = useRef(defaults).current;
  const [values, setValues] = useState<JsonMap>(initialDefaults);
  const [loading, setLoading] = useState(!demo);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!business || demo) { setLoading(false); return; }
    let active = true;
    void db.from("merchant_console_settings").select("settings").eq("business_account_id", business.id).eq("category", category).maybeSingle().then(({ data, error }: { data: { settings?: JsonMap } | null; error: { message: string } | null }) => {
      if (!active) return;
      if (error) toast.error(error.message);
      setValues({ ...initialDefaults, ...((data?.settings as JsonMap) || {}) });
      setLoading(false);
    });
    return () => { active = false; };
  }, [business, category, demo, initialDefaults]);
  const save = async () => {
    if (!business) return;
    if (demo) { toast.success("Sample preference updated for this preview"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("merchant_console_settings").upsert({ business_account_id: business.id, category, settings: values, updated_by: user?.id || null }, { onConflict: "business_account_id,category" });
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Settings saved");
  };
  if (loading) return <ModuleLoading />;
  return <Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" />{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="space-y-3">
    {fields.map((field) => <div key={field.key} className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center"><div><Label htmlFor={field.key} className="font-bold">{field.label}</Label><p className="mt-1 text-xs text-muted-foreground">{field.description}</p></div>{field.type === "switch" ? <Switch id={field.key} checked={Boolean(values[field.key])} onCheckedChange={(checked) => setValues((current) => ({ ...current, [field.key]: checked }))} /> : field.type === "select" ? <Select value={String(values[field.key] || "")} onValueChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}><SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger><SelectContent>{field.options?.map((option) => <SelectItem key={option} value={option}>{human(option)}</SelectItem>)}</SelectContent></Select> : <Input id={field.key} className="sm:w-80" value={String(values[field.key] || "")} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} />}</div>)}
    <div className="flex justify-end pt-2"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save changes</Button></div>
  </CardContent></Card>;
}

function BulkBookingPanel() {
  const { business } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!business || demo) return;
    const { data, error } = await db.from("merchant_bulk_imports").select("id,file_name,row_count,valid_row_count,status,created_at").eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(30);
    if (error) toast.error(error.message); else setImports((data as ImportRow[]) || []);
  }, [business, demo]);
  useEffect(() => { void load(); }, [load]);
  const template = () => downloadCsv("viasetu-bulk-booking-template.csv", [["reference_id", "pickup_pincode", "delivery_pincode", "weight_kg", "length_cm", "width_cm", "height_cm", "receiver_name", "receiver_phone", "receiver_address"], ["ORDER-1001", "411001", "560001", 0.5, 20, 15, 10, "Sample Receiver", "9999999999", "Sample address"]]);
  const stage = async (file?: File) => {
    if (!file || !business) return;
    setSaving(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }).slice(0, 100);
      const errors = rows.flatMap((row, index) => {
        const missing = ["pickup_pincode", "delivery_pincode", "weight_kg"].filter((key) => !String(row[key] ?? "").trim());
        const invalidPins = ["pickup_pincode", "delivery_pincode"].filter((key) => row[key] && !/^\d{6}$/.test(String(row[key])));
        return missing.length || invalidPins.length ? [{ row: index + 2, message: [...missing.map((key) => `${key} required`), ...invalidPins.map((key) => `${key} invalid`)].join(", ") }] : [];
      });
      const validCount = rows.length - errors.length;
      if (!rows.length) throw new Error("The selected sheet has no data rows.");
      if (demo) { setImports([{ id: crypto.randomUUID(), file_name: file.name, row_count: rows.length, valid_row_count: validCount, status: "validated", created_at: new Date().toISOString() }, ...imports]); toast.success("Sample import validated locally"); return; }
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await db.from("merchant_bulk_imports").insert({ business_account_id: business.id, file_name: file.name.slice(0, 180), row_count: rows.length, valid_row_count: validCount, status: "validated", rows, validation_errors: errors, created_by: user?.id || null });
      if (error) throw error;
      toast.success(`${validCount} of ${rows.length} rows validated and staged`);
      await load();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Could not read this spreadsheet"); }
    finally { setSaving(false); if (inputRef.current) inputRef.current.value = ""; }
  };
  return <div className="space-y-4"><Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-primary" />Validate a bulk file</CardTitle><CardDescription>CSV/XLS/XLSX, maximum 100 rows. Validation creates a private staged import; it does not charge the wallet or book couriers.</CardDescription></CardHeader><CardContent><button type="button" onClick={() => inputRef.current?.click()} className="grid min-h-52 w-full place-items-center rounded-2xl border-2 border-dashed border-primary/35 bg-accent/35 px-6 text-center transition hover:border-primary hover:bg-accent"><span><Upload className="mx-auto size-9 text-primary" /><strong className="mt-3 block">{saving ? "Validating file..." : "Choose spreadsheet"}</strong><span className="mt-1 block text-sm text-muted-foreground">Required: pickup_pincode, delivery_pincode and weight_kg</span></span></button><input ref={inputRef} className="hidden" type="file" accept=".csv,.xls,.xlsx" onChange={(event) => void stage(event.target.files?.[0])} /><div className="mt-3 flex justify-end"><Button variant="outline" onClick={template}><Download />Download template</Button></div></CardContent></Card>
    <Card className="merchant-bordered-card overflow-hidden"><CardHeader><CardTitle>Recent validated imports</CardTitle></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Date</TableHead><TableHead>Valid rows</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{imports.map((row) => <TableRow key={row.id}><TableCell className="font-semibold">{row.file_name}</TableCell><TableCell>{when(row.created_at)}</TableCell><TableCell>{row.valid_row_count}/{row.row_count}</TableCell><TableCell><Badge variant="secondary">{human(row.status)}</Badge></TableCell></TableRow>)}{!imports.length ? <TableRow><TableCell colSpan={4}><EmptyState icon={FileSpreadsheet} title="No imports staged" description="Upload the first spreadsheet to validate its structure." /></TableCell></TableRow> : null}</TableBody></Table></CardContent></Card></div>;
}

function CodPanel({ dashboard }: { dashboard: boolean }) {
  const { rows, loading, load } = useBookings();
  const codRows = rows.filter((row) => row.payment_status?.toLowerCase().includes("cod"));
  const expected = codRows.reduce((sum, row) => sum + Number(row.courier_price || 0), 0);
  if (loading) return <ModuleLoading />;
  return <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["COD orders", codRows.length], ["Expected", inr(expected)], ["Collected", inr(0)], ["Remitted", inr(0)]].map(([label, value]) => <Card key={String(label)} className="merchant-bordered-card"><CardContent className="p-5"><p className="text-sm font-semibold text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-extrabold">{value}</p></CardContent></Card>)}</div>{dashboard ? <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Collection health</CardTitle><CardDescription>Summary updates automatically as COD-tagged shipment records arrive.</CardDescription></CardHeader><CardContent><EmptyState icon={CircleDollarSign} title={codRows.length ? `${codRows.length} COD shipments` : "No COD exposure"} description={codRows.length ? `${inr(expected)} is currently associated with COD-tagged records.` : "The current merchant ledger contains no COD-tagged shipments."} /></CardContent></Card><Card><CardHeader><CardTitle>Settlement status</CardTitle></CardHeader><CardContent><EmptyState icon={CheckCircle2} title="No pending remittance" description="Collection and remittance amounts will appear after supported courier settlement data is received." /></CardContent></Card></div> : <Card className="overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>COD orders</CardTitle><CardDescription>Only records owned by this merchant are shown.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw />Refresh</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>AWB</TableHead><TableHead>Receiver</TableHead><TableHead>Courier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{codRows.map((row) => <TableRow key={row.id}><TableCell>{row.id.slice(0, 12)}</TableCell><TableCell>{row.tracking_id || row.prayog_awb || "Pending"}</TableCell><TableCell>{row.receiver_name}</TableCell><TableCell>{row.courier_name}</TableCell><TableCell><Badge variant="secondary">{human(row.status)}</Badge></TableCell><TableCell className="text-right font-bold">{inr(row.courier_price)}</TableCell></TableRow>)}{!codRows.length ? <TableRow><TableCell colSpan={6}><EmptyState icon={CircleDollarSign} title="No COD orders found" description="COD-tagged shipments will appear here automatically." /></TableCell></TableRow> : null}</TableBody></Table></CardContent></Card>}</div>;
}

function WeightPanel() {
  const { rows, loading, load } = useBookings();
  if (loading) return <ModuleLoading />;
  const weighted = rows.filter((row) => row.dead_weight_g || row.chargeable_weight_g || row.volumetric_weight_g);
  return <Card className="merchant-bordered-card overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Shipment weights</CardTitle><CardDescription>Declared, volumetric and chargeable weights from live merchant bookings.</CardDescription></div><Button variant="outline" onClick={() => void load()}><RefreshCw />Refresh</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Order / AWB</TableHead><TableHead>Courier</TableHead><TableHead>Declared</TableHead><TableHead>Volumetric</TableHead><TableHead>Chargeable</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{weighted.map((row) => <TableRow key={row.id}><TableCell><p className="font-semibold">{row.id.slice(0, 12)}</p><p className="text-xs text-muted-foreground">{row.tracking_id || row.prayog_awb || "AWB pending"}</p></TableCell><TableCell>{row.courier_name}</TableCell><TableCell>{((row.dead_weight_g || 0) / 1000).toFixed(2)} kg</TableCell><TableCell>{((row.volumetric_weight_g || 0) / 1000).toFixed(2)} kg</TableCell><TableCell className="font-bold">{((row.chargeable_weight_g || 0) / 1000).toFixed(2)} kg</TableCell><TableCell><Badge variant="outline">{human(row.status)}</Badge></TableCell></TableRow>)}{!weighted.length ? <TableRow><TableCell colSpan={6}><EmptyState icon={Scale} title="No weighted shipments" description="Weight records will appear after the merchant creates shipments." /></TableCell></TableRow> : null}</TableBody></Table></CardContent></Card>;
}

function UsersPanel() {
  const { business } = useBusinessAuth();
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"><Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5 text-primary" />Merchant access</CardTitle><CardDescription>The current account owner is the active merchant administrator.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"><span className="grid size-11 place-items-center rounded-full bg-accent text-primary"><UserRound /></span><div className="min-w-0 flex-1"><p className="font-extrabold">{business?.contact_person || "Merchant owner"}</p><p className="truncate text-sm text-muted-foreground">{business?.email}</p></div><Badge>Owner · Active</Badge></div></CardContent></Card><Card className="merchant-surface merchant-bordered-card"><CardHeader><CardTitle>Access model</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />Tenant-isolated merchant account</p><p className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-600" />Authenticated owner access</p><p className="text-muted-foreground">Additional role-based team invitations will require an explicit user invitation and acceptance workflow.</p></CardContent></Card></div>;
}

function InvoicePanel() {
  const { business } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(!demo);
  const load = useCallback(async () => {
    if (!business || demo) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from("wallet_transactions").select("id,type,amount,balance_after,note,created_at").eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(1000);
    if (error) toast.error(error.message); else setRows((data as WalletTransaction[]) || []);
    setLoading(false);
  }, [business, demo]);
  useEffect(() => { void load(); }, [load]);
  const filtered = rows.filter((row) => row.created_at.startsWith(month));
  const exportInvoice = () => downloadCsv(`viasetu-statement-${month}.csv`, [["Merchant", business?.company_name], ["Period", month], [], ["Transaction ID", "Date", "Type", "Description", "Amount", "Balance"], ...filtered.map((row) => [row.id, row.created_at, row.type, row.note, row.amount, row.balance_after])]);
  if (loading) return <ModuleLoading />;
  return <Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-primary" />Monthly invoice statement</CardTitle><CardDescription>Generate a merchant-scoped CSV statement from the immutable wallet ledger.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row"><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="sm:w-56" /><Button onClick={exportInvoice} disabled={!filtered.length}><Download />Download statement</Button></div><div className="grid gap-3 sm:grid-cols-3">{[["Transactions", filtered.length], ["Credits", inr(filtered.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0))], ["Charges", inr(Math.abs(filtered.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0)))]].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-extrabold">{value}</p></div>)}</div>{!filtered.length ? <EmptyState icon={FileText} title="No invoice activity" description="Choose another month or create a shipment transaction first." /> : null}</CardContent></Card>;
}

function WebhooksPanel() {
  const { business } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!business || demo) return;
    const { data, error } = await db.from("merchant_webhook_subscriptions").select("*").eq("business_account_id", business.id).order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setRows((data as WebhookRow[]) || []);
  }, [business, demo]);
  useEffect(() => { void load(); }, [load]);
  const add = async () => {
    if (!business || !/^https:\/\//i.test(url)) { toast.error("Enter a valid HTTPS endpoint"); return; }
    const secret = `whsec_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    if (demo) { setRows([{ id: crypto.randomUUID(), endpoint_url: url, event_types: ["shipment.status_changed"], signing_secret: secret, is_active: true, last_tested_at: null, last_test_status: null, last_delivery_at: null, last_delivery_status: null, created_at: new Date().toISOString() }, ...rows]); setUrl(""); toast.success("Sample endpoint added"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await db.from("merchant_webhook_subscriptions").insert({ business_account_id: business.id, endpoint_url: url, event_types: ["shipment.status_changed"], signing_secret: secret, created_by: user?.id || null });
    setBusy(false);
    if (error) toast.error(error.message); else { setUrl(""); toast.success("Webhook endpoint added"); await load(); }
  };
  const update = async (row: WebhookRow, changes: Partial<WebhookRow>) => { if (demo) { setRows((current) => current.map((item) => item.id === row.id ? { ...item, ...changes } : item)); return; } const { error } = await db.from("merchant_webhook_subscriptions").update(changes).eq("id", row.id).eq("business_account_id", business?.id); if (error) toast.error(error.message); else await load(); };
  const remove = async (row: WebhookRow) => { if (demo) { setRows((current) => current.filter((item) => item.id !== row.id)); return; } const { error } = await db.from("merchant_webhook_subscriptions").delete().eq("id", row.id).eq("business_account_id", business?.id); if (error) toast.error(error.message); else { toast.success("Webhook removed"); await load(); } };
  const test = async (row: WebhookRow) => { if (demo) { toast.success("Sample webhook test accepted"); return; } setBusy(true); const { data, error } = await supabase.functions.invoke("business-webhook-test", { body: { subscription_id: row.id } }); setBusy(false); if (error || !data?.success) toast.error(data?.error || error?.message || "Test delivery failed"); else { toast.success(`Endpoint returned HTTP ${data.status}`); await load(); } };
  return <div className="space-y-4"><Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="size-5 text-primary" />Add webhook endpoint</CardTitle><CardDescription>Shipment status events are signed with HMAC SHA-256 in the X-ViaSetu-Signature header.</CardDescription></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://store.example.com/webhooks/viasetu" /><Button onClick={add} disabled={busy}><Plus />Add endpoint</Button></CardContent></Card>{rows.map((row) => <Card key={row.id} className="merchant-bordered-card"><CardContent className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><Globe2 className="size-4 text-primary" /><p className="truncate font-bold">{row.endpoint_url}</p></div><p className="mt-2 break-all font-mono text-xs text-muted-foreground">Secret: {row.signing_secret}</p><p className="mt-1 text-xs text-muted-foreground">{row.last_tested_at ? `Last test ${when(row.last_tested_at)} · HTTP ${row.last_test_status}` : "Not tested yet"}{row.last_delivery_at ? ` · Last live delivery HTTP ${row.last_delivery_status}` : ""}</p></div><div className="flex items-center gap-2"><Switch checked={row.is_active} onCheckedChange={(checked) => void update(row, { is_active: checked })} /><Button variant="outline" size="sm" onClick={() => void test(row)} disabled={busy}><Send />Test</Button><Button variant="ghost" size="icon" onClick={() => void remove(row)} aria-label="Delete webhook"><Trash2 /></Button></div></CardContent></Card>)}{!rows.length ? <Card><EmptyState icon={Webhook} title="No webhook endpoints" description="Add an HTTPS endpoint to receive signed shipment status events." /></Card> : null}</div>;
}

function PincodePanel() {
  const demo = isBusinessDemoSession();
  const [pickup, setPickup] = useState("");
  const [delivery, setDelivery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ partner: string; serviceable: boolean }>>([]);
  const check = async () => {
    if (!/^\d{6}$/.test(pickup) || !/^\d{6}$/.test(delivery)) { toast.error("Enter two valid 6-digit pincodes"); return; }
    setBusy(true);
    if (demo) {
      setResults(PARTNER_REGISTRY.map((partner, index) => ({ partner: partner.name, serviceable: index < 3 })));
      setBusy(false);
      toast.success("Sample coverage loaded without contacting courier services");
      return;
    }
    const functions: Record<string, string> = { shadowfax: "shadowfax-serviceability", delhivery: "delhivery-serviceability", urbanebolt: "urbanebolt-serviceability", xpressbees: "xpressbees-serviceability", shree_maruti: "shree-maruti-serviceability" };
    const settled = await Promise.allSettled(PARTNER_REGISTRY.map(async (partner) => { const { data, error } = await supabase.functions.invoke(functions[partner.code], { body: { pickup_pincode: pickup, delivery_pincode: delivery, weight_kg: 0.5, length_cm: 10, width_cm: 10, height_cm: 10 }, headers: { "x-environment": CURRENT_ENV } }); return { partner: partner.name, serviceable: !error && data?.is_serviceable === true }; }));
    setResults(settled.map((result, index) => result.status === "fulfilled" ? result.value : { partner: PARTNER_REGISTRY[index].name, serviceable: false }));
    setBusy(false);
  };
  return <Card className="merchant-bordered-card"><CardHeader><CardTitle className="flex items-center gap-2"><MapPinCheck className="size-5 text-primary" />{demo ? "Sample pincode serviceability" : "Live pincode serviceability"}</CardTitle><CardDescription>{demo ? "Uses local sample coverage and never contacts a courier service." : "Checks the configured courier endpoints without creating an order."}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row"><Input value={pickup} onChange={(event) => setPickup(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Pickup pincode" /><Input value={delivery} onChange={(event) => setDelivery(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Delivery pincode" /><Button onClick={check} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <MapPinCheck />}Check</Button></div>{results.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{results.map((result) => <div key={result.partner} className="flex items-center justify-between rounded-xl border p-4"><span className="font-bold">{result.partner}</span><Badge variant={result.serviceable ? "default" : "secondary"}>{result.serviceable ? "Serviceable" : "Unavailable"}</Badge></div>)}</div> : <EmptyState icon={MapPinCheck} title="Check a route" description={demo ? "Enter pickup and delivery pincodes to preview sample coverage." : "Enter pickup and delivery pincodes to query live courier coverage."} />}</CardContent></Card>;
}

function ActivityPanel() {
  const { business } = useBusinessAuth();
  const demo = isBusinessDemoSession();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(!demo);
  const load = useCallback(async () => {
    if (!business || demo) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await db.from("merchant_console_activity_logs").select("id,action,resource_type,resource_id,details,created_at").eq("business_account_id", business.id).order("created_at", { ascending: false }).limit(250);
    if (error) toast.error(error.message); else setRows((data as ActivityRow[]) || []);
    setLoading(false);
  }, [business, demo]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <ModuleLoading />;
  return <Card className="merchant-bordered-card overflow-hidden"><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Console activity</CardTitle><CardDescription>Configuration, import and webhook changes for this merchant.</CardDescription></div><Button variant="outline" onClick={() => void load()}><RefreshCw />Refresh</Button></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Action</TableHead><TableHead>Resource</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="whitespace-nowrap">{when(row.created_at)}</TableCell><TableCell><Badge variant="outline">{human(row.action)}</Badge></TableCell><TableCell className="font-semibold">{human(row.resource_type)}</TableCell><TableCell className="max-w-md truncate text-xs text-muted-foreground">{JSON.stringify(row.details)}</TableCell></TableRow>)}{!rows.length ? <TableRow><TableCell colSpan={4}><EmptyState icon={Activity} title="No console changes yet" description="Saved settings, validated imports and webhook changes will be recorded here." /></TableCell></TableRow> : null}</TableBody></Table></CardContent></Card>;
}

function ActiveSessionsPanel() {
  const demo = isBusinessDemoSession();
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  useEffect(() => {
    if (demo) {
      setEmail("demo@viasetu.local");
      setCreatedAt(new Date().toISOString());
      return;
    }
    void supabase.auth.getSession().then(({ data }) => { setEmail(data.session?.user.email || ""); setCreatedAt(data.session?.user.last_sign_in_at || data.session?.user.created_at || ""); });
  }, [demo]);
  return <Card className="merchant-bordered-card overflow-hidden"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />Current authenticated session</CardTitle><CardDescription>{demo ? "This sample session exists only in the current browser tab." : "Supabase securely stores only the active browser session available to this merchant."}</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Device</TableHead><TableHead>Browser</TableHead><TableHead>Status</TableHead><TableHead>Signed in</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="font-semibold">{email || "Merchant account"}</TableCell><TableCell>{navigator.platform || "Current device"}</TableCell><TableCell>{navigator.userAgent.includes("Chrome") ? "Chrome" : "Web browser"}</TableCell><TableCell><Badge>Current · Active</Badge></TableCell><TableCell>{createdAt ? when(createdAt) : "Current session"}</TableCell></TableRow></TableBody></Table></CardContent></Card>;
}

export default function BusinessActivatedModule({ module }: { module: string }) {
  if (module === "bulk-booking") return <BulkBookingPanel />;
  if (module === "cod-orders") return <CodPanel dashboard={false} />;
  if (module === "cod-dashboard") return <CodPanel dashboard />;
  if (module === "weight-reconciliation") return <WeightPanel />;
  if (module === "users") return <UsersPanel />;
  if (module === "invoices") return <InvoicePanel />;
  if (module === "webhooks") return <WebhooksPanel />;
  if (module === "pincodes") return <PincodePanel />;
  if (module === "activity-logs") return <ActivityPanel />;
  if (module === "active-sessions") return <ActiveSessionsPanel />;
  if (module === "carrier-selection") return <SettingsEditor category="carrier_selection" title="Available courier partners" description="Disabled partners are removed from merchant rate calculations and booking choices." defaults={Object.fromEntries(PARTNER_REGISTRY.map((partner) => [partner.code, true]))} fields={PARTNER_REGISTRY.map((partner) => ({ key: partner.code, label: partner.name, description: `Allow ${partner.name} quotes for this merchant`, type: "switch" }))} />;
  if (module === "carrier-rules") return <SettingsEditor category="carrier_rules" title="Courier routing preferences" description="Save merchant defaults used to order eligible courier choices." defaults={{ sort_by: "lowest_price", preferred_partner: "none", max_delivery_days: "7" }} fields={[{ key: "sort_by", label: "Sort quotes by", description: "Default ranking on rate results", type: "select", options: ["lowest_price", "fastest_delivery"] }, { key: "preferred_partner", label: "Preferred courier", description: "Shown first when available", type: "select", options: ["none", ...PARTNER_REGISTRY.map((partner) => partner.code)] }, { key: "max_delivery_days", label: "Maximum delivery days", description: "Routing preference for estimated transit time", type: "text" }]} />;
  if (module === "notifications") return <SettingsEditor category="notifications" title="Shipment notification events" description="Choose which operational events should notify this merchant account." defaults={{ order_created: true, ready_for_dispatch: true, in_transit: true, delivered: true, failed_attempt: true, email_destination: "" }} fields={[{ key: "order_created", label: "Order created", description: "Notify after a shipment is accepted", type: "switch" }, { key: "ready_for_dispatch", label: "Ready for dispatch", description: "Notify when pickup is prepared", type: "switch" }, { key: "in_transit", label: "In transit", description: "Notify when the courier moves the parcel", type: "switch" }, { key: "delivered", label: "Delivered", description: "Notify after successful delivery", type: "switch" }, { key: "failed_attempt", label: "Failed delivery attempt", description: "Notify when delivery needs attention", type: "switch" }, { key: "email_destination", label: "Notification email", description: "Optional override; blank uses the merchant email", type: "text" }]} />;
  if (module === "label-configuration") return <SettingsEditor category="label_configuration" title="Shipping label defaults" description="Saved defaults are available to the merchant label workflow." defaults={{ paper_size: "a4", include_logo: true, include_order_value: false, footer_note: "" }} fields={[{ key: "paper_size", label: "Paper size", description: "Default PDF label sheet", type: "select", options: ["a4", "a6", "4x6"] }, { key: "include_logo", label: "Show ViaSetu logo", description: "Include branding on generated labels", type: "switch" }, { key: "include_order_value", label: "Show declared value", description: "Print shipment value on labels", type: "switch" }, { key: "footer_note", label: "Footer note", description: "Optional warehouse instruction", type: "text" }]} />;
  if (module === "invoice-configuration") return <SettingsEditor category="invoice_configuration" title="Invoice defaults" description="Configure the merchant identity used on exported billing documents." defaults={{ invoice_prefix: "VS", gst_enabled: true, billing_email: "", purchase_order_required: false }} fields={[{ key: "invoice_prefix", label: "Invoice prefix", description: "Prefix for merchant invoice references", type: "text" }, { key: "gst_enabled", label: "Show GST breakup", description: "Include tax columns on generated statements", type: "switch" }, { key: "billing_email", label: "Billing email", description: "Destination for billing documents", type: "text" }, { key: "purchase_order_required", label: "Require purchase order reference", description: "Enforce PO reference during billing review", type: "switch" }]} />;
  if (module === "rate-cards") return <div className="space-y-4"><Alert className="border-emerald-200 bg-emerald-50/70"><Truck /><AlertTitle>Live merchant pricing</AlertTitle><AlertDescription>Rate cards are calculated from enabled courier services and the current ViaSetu business pricing policy. Use Rate Calculator for a route-specific quote.</AlertDescription></Alert><Card className="merchant-bordered-card"><CardHeader><CardTitle>Enabled courier network</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{PARTNER_REGISTRY.map((partner) => <div key={partner.code} className="flex items-center justify-between rounded-xl border p-4"><span className="font-bold">{partner.name}</span><Badge variant="secondary">Route based</Badge></div>)}</CardContent></Card></div>;
  return <Alert><ShieldCheck /><AlertTitle>Module connected</AlertTitle><AlertDescription>This merchant module is protected by authenticated, tenant-scoped access.</AlertDescription></Alert>;
}
