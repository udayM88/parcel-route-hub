import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, RefreshCw, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  id: string;
  event_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  to_recipients: string[];
  cc_recipients: string[];
  reply_to: string | null;
  subject: string;
  body_html: string;
}

interface EmailLog {
  id: string;
  event_key: string;
  booking_id: string | null;
  to_email: string;
  cc_emails: string[];
  subject: string | null;
  status: string;
  error: string | null;
  is_test: boolean;
  created_at: string;
}

const VARIABLES = [
  "order_id", "order_short_id", "awb", "courier", "status", "amount", "delivery_time",
  "sender_name", "sender_phone", "sender_pincode", "receiver_name", "receiver_phone",
  "receiver_pincode", "goods_type", "weight", "failure_reason", "refund_reason",
  "payment_id", "created_at",
  "company_name", "contact_person", "email", "setup_link", "portal_link",
];

const RecipientChips = ({
  values, onChange, placeholder,
}: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) => {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
};

export const EmailNotificationsPanel = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [testEvent, setTestEvent] = useState<string>("");
  const [testRecipient, setTestRecipient] = useState("");
  const [testBookingId, setTestBookingId] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from("email_templates").select("*").order("event_key"),
      supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTemplates((t as EmailTemplate[]) || []);
    setLogs((l as EmailLog[]) || []);
    if (!testEvent && t?.length) setTestEvent((t[0] as EmailTemplate).event_key);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const patch = (key: string, changes: Partial<EmailTemplate>) =>
    setTemplates((prev) => prev.map((t) => (t.event_key === key ? { ...t, ...changes } : t)));

  const save = async (t: EmailTemplate) => {
    setSavingKey(t.event_key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("email_templates").update({
        enabled: t.enabled,
        to_recipients: t.to_recipients,
        cc_recipients: t.cc_recipients,
        reply_to: t.reply_to,
        subject: t.subject,
        body_html: t.body_html,
        updated_by: session?.user?.id ?? null,
      }).eq("id", t.id);
      if (error) throw error;
      toast({ title: `${t.label} saved` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  const sendTest = async () => {
    if (!testEvent || !testRecipient) {
      toast({ title: "Select an event and enter a recipient", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-notification-email", {
        body: {
          event: testEvent,
          is_test: true,
          override_to: testRecipient.trim(),
          booking_id: testBookingId.trim() || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.skipped) {
        toast({ title: `Skipped: ${(data as any).skipped}`, variant: "destructive" });
      } else {
        toast({ title: "Test email sent", description: `Delivered to ${testRecipient}` });
      }
    } catch (e: any) {
      toast({ title: "Test email failed", description: e.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
      load();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Event Notifications</CardTitle>
            <CardDescription>
              Enable each event and manage its recipients, subject and content. SMTP credentials stay
              server-side and are never shown here.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {templates.map((t) => (
              <AccordionItem key={t.id} value={t.event_key}>
                <AccordionTrigger>
                  <span className="flex items-center gap-3">
                    <Badge variant={t.enabled ? "default" : "secondary"}>{t.enabled ? "On" : "Off"}</Badge>
                    {t.label}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <div className="flex items-center gap-2">
                    <Switch checked={t.enabled} onCheckedChange={(v) => patch(t.event_key, { enabled: v })} />
                    <Label>Enable this notification</Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>To recipients</Label>
                      <RecipientChips
                        values={t.to_recipients || []}
                        onChange={(v) => patch(t.event_key, { to_recipients: v })}
                        placeholder="ops@viasetu.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CC recipients</Label>
                      <RecipientChips
                        values={t.cc_recipients || []}
                        onChange={(v) => patch(t.event_key, { cc_recipients: v })}
                        placeholder="accounts@viasetu.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reply-To</Label>
                    <Input
                      value={t.reply_to || ""}
                      placeholder="support@viasetu.com"
                      onChange={(e) => patch(t.event_key, { reply_to: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={t.subject} onChange={(e) => patch(t.event_key, { subject: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Body (HTML)</Label>
                    <Textarea
                      rows={8}
                      value={t.body_html}
                      onChange={(e) => patch(t.event_key, { body_html: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variables: {VARIABLES.map((v) => `{{${v}}}`).join(", ")}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Send Test Email</CardTitle>
          <CardDescription>
            Sends a one-off test to any address using the selected template. Tests are marked in the logs and
            never counted as a real notification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Event / Template</Label>
              <Select value={testEvent} onValueChange={setTestEvent}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.event_key} value={t.event_key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Test recipient *</Label>
              <Input type="email" value={testRecipient} placeholder="you@viasetu.com"
                onChange={(e) => setTestRecipient(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Booking ID (optional)</Label>
              <Input value={testBookingId} placeholder="Leave blank for sample data"
                onChange={(e) => setTestBookingId(e.target.value)} />
            </div>
          </div>
          <Button onClick={sendTest} disabled={sendingTest}>
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send Test Email
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Email Logs</CardTitle>
            <CardDescription>Last 100 send attempts with status and error details.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No emails sent yet
                  </TableCell></TableRow>
                )}
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.created_at).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.event_key}{l.is_test && <Badge variant="outline" className="ml-2">test</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{l.to_email}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate">{l.subject}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate text-destructive">{l.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailNotificationsPanel;
