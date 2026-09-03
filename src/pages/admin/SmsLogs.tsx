import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageSquare, RefreshCw, Search, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmsLogRow {
  id: string;
  event_key: string;
  booking_id: string | null;
  status_event_id: string | null;
  awb: string | null;
  to_phone: string | null;
  template_id: string | null;
  variables: string[] | null;
  message_preview: string | null;
  status: string;
  reason: string | null;
  provider_response: any;
  is_test: boolean;
  courier_name: string | null;
  raw_status: string | null;
  normalized_status: string | null;
  dedupe_key: string | null;
  attempt_count: number | null;
  next_retry_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface BookingLite {
  id: string;
  sender_name: string | null;
  sender_phone: string | null;
  courier_name: string | null;
  status: string | null;
  prayog_awb: string | null;
  tracking_id: string | null;
}

const STATUS_OPTIONS = ["all", "sent", "failed", "skipped", "duplicate", "pending"] as const;

const displayStatus = (row: SmsLogRow): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
  const s = String(row.status || "").toLowerCase();
  if (s === "sent") return { label: "SENT", variant: "default" };
  if (s === "failed") return { label: "FAILED", variant: "destructive" };
  if (s === "duplicate") return { label: "DUPLICATE", variant: "outline" };
  if (s === "sending" || s === "pending" || s === "queued") return { label: "PENDING", variant: "secondary" };
  if (s === "skipped") {
    if (/duplicate/i.test(row.reason || "")) return { label: "DUPLICATE", variant: "outline" };
    return { label: "SKIPPED", variant: "secondary" };
  }
  return { label: s.toUpperCase() || "UNKNOWN", variant: "outline" };
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "—";

const shortId = (id?: string | null) => (id ? String(id).slice(0, 8).toUpperCase() : "—");

const SmsLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SmsLogRow[]>([]);
  const [bookings, setBookings] = useState<Record<string, BookingLite>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SmsLogRow | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");

  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [courier, setCourier] = useState("all");
  const [event, setEvent] = useState("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("sms_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (from) query = query.gte("created_at", new Date(`${from}T00:00:00`).toISOString());
    if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());
    if (courier !== "all") query = query.eq("courier_name", courier);
    if (event !== "all") query = query.eq("event_key", event);

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error loading SMS logs", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const rows = (data as unknown as SmsLogRow[]) || [];
    setLogs(rows);

    const ids = Array.from(new Set(rows.map((r) => r.booking_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: bks } = await supabase
        .from("bookings")
        .select("id, sender_name, sender_phone, courier_name, status, prayog_awb, tracking_id")
        .in("id", ids.slice(0, 300));
      const map: Record<string, BookingLite> = {};
      for (const b of (bks as BookingLite[]) || []) map[b.id] = b;
      setBookings(map);
    } else {
      setBookings({});
    }
    setLoading(false);
  }, [from, to, courier, event, toast]);

  useEffect(() => { load(); }, [load]);

  const courierOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.courier_name).filter(Boolean))) as string[],
    [logs],
  );
  const eventOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.event_key).filter(Boolean))),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (status !== "all" && displayStatus(l).label !== status.toUpperCase()) return false;
      if (!q) return true;
      return (
        String(l.booking_id || "").toLowerCase().includes(q) ||
        shortId(l.booking_id).toLowerCase().includes(q) ||
        String(l.awb || "").toLowerCase().includes(q)
      );
    });
  }, [logs, status, search]);

  const sendTest = async (row: SmsLogRow) => {
    const phone = (testPhone || "").replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(phone)) {
      toast({ title: "Enter a valid 10-digit test number", variant: "destructive" });
      return;
    }
    setTestingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-sms", {
        body: {
          event: row.event_key,
          booking_id: row.booking_id,
          to: phone,
          test: true,
          normalized_status: row.normalized_status,
          vars: row.raw_status ? { courier_status: row.raw_status } : {},
        },
      });
      if (error) throw error;
      const decision = (data as any)?.decision || "unknown";
      toast({
        title: `Test SMS ${decision}`,
        description: (data as any)?.reason || `Sent to ${phone}`,
        variant: decision === "sent" ? undefined : "destructive",
      });
      load();
    } catch (e: any) {
      toast({ title: "Test SMS failed", description: e.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const retryNow = async (row: SmsLogRow) => {
    setRetryingId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-order-sms", {
        body: { mode: "manual_retry", log_id: row.id },
      });
      if (error) throw error;
      const decision = (data as any)?.decision || "unknown";
      toast({
        title: `Retry ${decision}`,
        description: decision === "duplicate"
          ? "Already delivered — duplicate protection blocked a second send."
          : (data as any)?.reason || "Retry processed.",
        variant: decision === "sent" || decision === "duplicate" ? undefined : "destructive",
      });
      await load();
      setSelected(null);
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
    } finally {
      setRetryingId(null);
    }
  };

  const clearFilters = () => {
    setFrom(""); setTo(""); setCourier("all"); setEvent("all"); setStatus("all"); setSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />SMS Notification Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            Order-status notifications only. OTP/login SMS is handled by a separate system and never appears here.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Trace: Courier Status → ViaSetu Status → Rule → Template → Recipient → Fast2SMS result.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Courier partner</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All couriers</SelectItem>
                {courierOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notification event</Label>
            <Select value={event} onValueChange={setEvent}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventOptions.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notification status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Search Order ID / AWB</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="e.g. 4655451… or A1B2C3D4" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="md:col-span-3 lg:col-span-6 flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Test number (10-digit) for “Send test”</Label>
              <Input className="w-56" placeholder="9013999909" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
            </div>
            <Button variant="ghost" onClick={clearFilters}><X className="h-4 w-4 mr-2" />Clear filters</Button>
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} record(s)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent / Logged</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>AWB</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Courier status</TableHead>
                  <TableHead>ViaSetu status</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Template ID</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading logs…
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                    No notification logs match these filters.
                  </TableCell></TableRow>
                ) : filtered.map((l) => {
                  const b = l.booking_id ? bookings[l.booking_id] : undefined;
                  const st = displayStatus(l);
                  return (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l)}>
                      <TableCell className="whitespace-nowrap text-xs">{fmt(l.sent_at || l.created_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{shortId(l.booking_id)}</TableCell>
                      <TableCell className="font-mono text-xs">{l.awb || "—"}</TableCell>
                      <TableCell className="text-xs">{b?.sender_name || "—"}</TableCell>
                      <TableCell className="text-xs">{l.courier_name || b?.courier_name || "—"}</TableCell>
                      <TableCell className="text-xs">{l.raw_status || "—"}</TableCell>
                      <TableCell className="text-xs">
                        {l.normalized_status ? <Badge variant="outline" className="font-mono text-[10px]">{l.normalized_status}</Badge> : "—"}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="font-mono text-[10px]">{l.event_key}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{l.template_id || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.to_phone || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant={st.variant}>{st.label}</Badge>
                          {l.is_test && <Badge variant="outline" className="text-[10px]">TEST</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={testingId === l.id}
                          onClick={(e) => { e.stopPropagation(); sendTest(l); }}
                        >
                          {testingId === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          <span className="ml-1">Test</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Notification detail</DialogTitle>
            <DialogDescription>
              Full trace of this order-status notification. API credentials are never stored or shown here.
            </DialogDescription>
          </DialogHeader>
          {selected && (() => {
            const b = selected.booking_id ? bookings[selected.booking_id] : undefined;
            const st = displayStatus(selected);
            const rows: [string, React.ReactNode][] = [
              ["Notification status", <Badge variant={st.variant}>{st.label}</Badge>],
              ["Event", selected.event_key],
              ["Order ID", shortId(selected.booking_id)],
              ["Order UUID", selected.booking_id || "—"],
              ["AWB", selected.awb || "—"],
              ["Customer", b?.sender_name || "—"],
              ["Customer phone", b?.sender_phone || "—"],
              ["Courier partner", selected.courier_name || b?.courier_name || "—"],
              ["Courier status received", selected.raw_status || "—"],
              ["Normalized ViaSetu status", selected.normalized_status || "—"],
              ["Fast2SMS template ID", selected.template_id || "—"],
              ["Recipient(s)", selected.to_phone || "—"],
              ["Test send", selected.is_test ? "Yes" : "No"],
              ["Reason / error", selected.reason || "—"],
              ["Attempts", String(selected.attempt_count ?? 0)],
              ["Next retry at", fmt(selected.next_retry_at)],
              ["Logged at", fmt(selected.created_at)],
              ["Sent at", fmt(selected.sent_at)],
              ["Last updated", fmt(selected.updated_at)],
              ["Dedupe key", selected.dedupe_key || "—"],
              ["Status event ID", selected.status_event_id || "—"],
            ];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {rows.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium text-right break-all">{v}</span>
                    </div>
                  ))}
                </div>

                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Template variables used</p>
                  <div className="flex flex-wrap gap-2">
                    {(selected.variables || []).length === 0
                      ? <span className="text-xs text-muted-foreground">None recorded</span>
                      : (selected.variables || []).map((v, i) => (
                        <Badge key={`${v}-${i}`} variant="secondary" className="font-mono text-[11px]">{i + 1}. {v}</Badge>
                      ))}
                  </div>
                  {selected.message_preview && (
                    <p className="mt-2 text-xs text-muted-foreground break-all">Preview: {selected.message_preview}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Fast2SMS response</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-56">
                    {selected.provider_response ? JSON.stringify(selected.provider_response, null, 2) : "No provider response recorded (message was skipped or never dispatched)."}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" disabled={testingId === selected.id} onClick={() => sendTest(selected)}>
                    {testingId === selected.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send test SMS
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmsLogs;
