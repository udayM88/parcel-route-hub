import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmsLog {
  id: string;
  event_key: string;
  booking_id: string | null;
  awb: string | null;
  to_phone: string | null;
  template_id: string | null;
  status: string;
  reason: string | null;
  message_preview: string | null;
  created_at: string;
  courier_name: string | null;
  raw_status: string | null;
  normalized_status: string | null;
  attempt_count: number | null;
  next_retry_at: string | null;
}


interface SmsTemplate {
  id: string;
  event_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  template_id: string;
  template_name: string;
  variables: string[];
  recipients: string[];
  send_to_customer: boolean;
}

const SmsNotificationsPanel = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: logRows }] = await Promise.all([
      supabase.from("sms_templates").select("*").order("event_key"),
      supabase.from("sms_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    if (error) {
      toast({ title: "Error loading SMS settings", description: error.message, variant: "destructive" });
    }
    setTemplates(((data as SmsTemplate[]) || []));
    setLogs((logRows as SmsLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const patch = (key: string, changes: Partial<SmsTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.event_key === key ? { ...t, ...changes } : t)));

  const save = async (t: SmsTemplate) => {
    setSavingKey(t.event_key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from("sms_templates")
        .update({
          enabled: t.enabled,
          template_id: t.template_id.trim(),
          template_name: t.template_name.trim(),
          recipients: t.recipients,
          send_to_customer: t.send_to_customer,
          updated_by: session?.user?.id ?? null,
        })
        .eq("event_key", t.event_key);
      if (error) throw error;
      toast({ title: `${t.label} settings saved` });
    } catch (error: any) {
      toast({ title: "Error saving SMS settings", description: error.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />SMS Notifications
          </CardTitle>
          <CardDescription>
            Map your DLT-approved Fast2SMS templates to each order event. Sending is not active yet — this only stores the configuration.
          </CardDescription>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading templates…
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No SMS events configured.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {templates.map((t) => (
              <AccordionItem key={t.event_key} value={t.event_key}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3 text-left">
                    <span className="font-medium">{t.label}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{t.event_key}</Badge>
                    <Badge variant={t.enabled ? "default" : "secondary"}>
                      {t.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  {t.description && (
                    <p className="text-sm text-muted-foreground">{t.description}</p>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={t.enabled}
                      onCheckedChange={(v) => patch(t.event_key, { enabled: v })}
                    />
                    <Label>Enable SMS for this event</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fast2SMS Template ID (DLT Message ID)</Label>
                      <Input
                        value={t.template_id}
                        placeholder="e.g. 187123"
                        onChange={(e) => patch(t.event_key, { template_id: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input
                        value={t.template_name}
                        placeholder="e.g. ViaSetu Order Placed"
                        onChange={(e) => patch(t.event_key, { template_name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Internal recipients (10-digit numbers, comma separated)</Label>
                    <Input
                      value={(t.recipients || []).join(", ")}
                      placeholder="9013999909, 8830306901"
                      onChange={(e) =>
                        patch(t.event_key, {
                          recipients: e.target.value.split(",").map((v) => v.trim()).filter(Boolean),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      ViaSetu internal team numbers that receive this alert.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={t.send_to_customer}
                      onCheckedChange={(v) => patch(t.event_key, { send_to_customer: v })}
                    />
                    <Label>Also send to the customer (sender phone)</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Variables required by this template</Label>
                    <div className="flex flex-wrap gap-2">
                      {t.variables.length === 0 ? (
                        <span className="text-xs text-muted-foreground">None</span>
                      ) : (
                        t.variables.map((v, i) => (
                          <Badge key={v} variant="secondary" className="font-mono text-[11px]">
                            {i + 1}. {v}
                          </Badge>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Order matters — Fast2SMS fills DLT variables in this sequence.
                    </p>
                  </div>

                  <Button onClick={() => save(t)} disabled={savingKey === t.event_key}>
                    {savingKey === t.event_key ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save {t.label}
                  </Button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>

      <CardHeader className="pt-0">
        <CardTitle className="text-base">Recent SMS activity</CardTitle>
        <CardDescription>
          Every send, skip and failure with the reason — use this to see why a notification did or did not go out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No SMS activity yet.</p>
        ) : (
          <div className="max-h-96 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>AWB</TableHead>
                  <TableHead>Courier status</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{l.event_key}</TableCell>
                    <TableCell className="text-xs">{l.courier_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{l.awb || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {l.raw_status || "—"}
                      {l.normalized_status ? (
                        <span className="text-muted-foreground"> → {l.normalized_status}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{l.to_phone || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                        {l.status}
                      </Badge>
                      {l.attempt_count ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">×{l.attempt_count}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                      {l.reason || l.message_preview || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default SmsNotificationsPanel;
