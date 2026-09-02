import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmsTemplate {
  id: string;
  event_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  template_id: string;
  template_name: string;
  variables: string[];
}

const SmsNotificationsPanel = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_templates")
      .select("*")
      .order("event_key");
    if (error) {
      toast({ title: "Error loading SMS settings", description: error.message, variant: "destructive" });
    }
    setTemplates(((data as SmsTemplate[]) || []));
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
    </Card>
  );
};

export default SmsNotificationsPanel;
