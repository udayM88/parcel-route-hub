import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import {
  PARTNER_REGISTRY,
  SETTINGS_KEY,
  type PartnerToggleMap,
} from "@/lib/partnerSettings";

const PartnerManagement = () => {
  const [toggles, setToggles] = useState<PartnerToggleMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (error) toast.error("Failed to load partner settings");
    const stored = ((data?.value ?? {}) as PartnerToggleMap) || {};
    const merged: PartnerToggleMap = {};
    PARTNER_REGISTRY.forEach((p) => {
      merged[p.code] = {
        enabled: stored[p.code]?.enabled !== false,
        note: stored[p.code]?.note ?? "",
      };
    });
    setToggles(merged);
    setDirty(false);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setPartner = (code: string, patch: Partial<{ enabled: boolean; note: string }>) => {
    setToggles((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } as any }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("system_settings")
      .update({ value: toggles as any, updated_at: new Date().toISOString() })
      .eq("key", SETTINGS_KEY);
    setSaving(false);
    if (error) { toast.error(error.message || "Failed to save"); return; }
    toast.success("Courier partner settings saved");
    setDirty(false);
  };

  const enabledCount = PARTNER_REGISTRY.filter((p) => toggles[p.code]?.enabled !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Courier Partners</h2>
          <p className="text-muted-foreground">
            Turn a courier partner off to stop it appearing in consumer and business booking flows.
          </p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save changes"}
        </Button>
      </div>

      {enabledCount === 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            All partners are disabled — customers will see no available couriers at checkout.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Partner availability</CardTitle>
          <CardDescription>
            Disabling a partner applies everywhere: consumer booking, business booking and assisted booking.
            Shipments already placed with that partner keep tracking, labels and cancellation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            PARTNER_REGISTRY.map((p) => {
              const state = toggles[p.code] ?? { enabled: true, note: "" };
              return (
                <div key={p.code} className="flex flex-col md:flex-row md:items-center gap-3 border rounded-lg p-4">
                  <div className="flex items-center gap-3 md:w-64">
                    <Switch
                      checked={state.enabled !== false}
                      onCheckedChange={(v) => setPartner(p.code, { enabled: v })}
                    />
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.code}</p>
                    </div>
                  </div>
                  <Badge variant={state.enabled !== false ? "default" : "secondary"} className="w-fit">
                    {state.enabled !== false ? "Active" : "Disabled"}
                  </Badge>
                  <Input
                    className="flex-1"
                    placeholder="Internal note (e.g. paused due to pickup delays)"
                    value={state.note ?? ""}
                    onChange={(e) => setPartner(p.code, { note: e.target.value })}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PartnerManagement;
