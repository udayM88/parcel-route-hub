import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_CANCELLATION_SETTINGS, mergeSettings, type CancellationFeeSettings } from "../../../supabase/functions/_shared/cancellation-fee";

const STAGES: { key: keyof CancellationFeeSettings["stages"]; label: string }[] = [
  { key: "grace", label: "Stage 1 — within grace window" },
  { key: "pre_pickup", label: "Stage 2 — awaiting pickup" },
  { key: "pickup_attempted", label: "Stage 3 — rider assigned / pickup attempted" },
];

export default function CancellationFeeSettingsCard() {
  const { toast } = useToast();
  const [s, setS] = useState<CancellationFeeSettings>(DEFAULT_CANCELLATION_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("system_settings").select("value").eq("key", "cancellation_fees").maybeSingle()
      .then(({ data }) => data && setS(mergeSettings(data.value)));
  }, []);

  const setFee = (k: keyof CancellationFeeSettings["stages"], part: "courier" | "platform", v: string) =>
    setS((p) => ({ ...p, stages: { ...p.stages, [k]: { ...p.stages[k], [part]: Number(v) || 0 } } }));

  const save = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("system_settings")
      .update({ value: s as any, updated_by: session?.user?.id }).eq("key", "cancellation_fees");
    setSaving(false);
    toast(error ? { title: "Could not save", description: error.message, variant: "destructive" } : { title: "Cancellation charges saved" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Cancellation Charges</CardTitle>
        <CardDescription>Amounts include GST. Charged once per order; never more than the amount paid.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Apply cancellation charges</Label>
          <Switch checked={s.enabled} onCheckedChange={(v) => setS((p) => ({ ...p, enabled: v }))} />
        </div>
        <div className="space-y-1 max-w-xs">
          <Label>Grace window (minutes)</Label>
          <Input type="number" min={0} value={s.grace_minutes} onChange={(e) => setS((p) => ({ ...p, grace_minutes: Number(e.target.value) || 0 }))} />
        </div>
        {STAGES.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <p className="text-sm font-medium">{label}</p>
            <div className="space-y-1"><Label className="text-xs">Courier charge ₹</Label>
              <Input type="number" min={0} value={s.stages[key].courier} onChange={(e) => setFee(key, "courier", e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">ViaSetu fee ₹</Label>
              <Input type="number" min={0} value={s.stages[key].platform} onChange={(e) => setFee(key, "platform", e.target.value)} /></div>
          </div>
        ))}
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save charges"}</Button>
      </CardContent>
    </Card>
  );
}
