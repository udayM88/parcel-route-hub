import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";

const PARTNERS = [
  { value: "delhivery", label: "Delhivery" },
  { value: "urbanebolt", label: "UrbaneBolt" },
  { value: "xpressbees", label: "XpressBees" },
  { value: "shadowfax", label: "Shadowfax" },
  { value: "shree_maruti", label: "Shree Maruti" },
];

interface ManualAwbDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: { id: string; courier_name?: string | null; partner_id?: string | null } | null;
  onSuccess?: () => void;
}

/**
 * Admin action: attach an AWB that was booked directly on a courier portal to
 * a stuck/pending order, so tracking, label download and cancellation start
 * working through the normal partner integrations.
 */
const ManualAwbDialog = ({ open, onOpenChange, booking, onSuccess }: ManualAwbDialogProps) => {
  const { toast } = useToast();
  const [partner, setPartner] = useState("");
  const [awb, setAwb] = useState("");
  const [orderId, setOrderId] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const guessPartner = () => {
    const s = `${booking?.partner_id || ""} ${booking?.courier_name || ""}`.toLowerCase();
    const hit = PARTNERS.find((p) => s.includes(p.value.split("_")[0]) || s.includes(p.label.toLowerCase()));
    return hit?.value || "";
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPartner(guessPartner());
      setAwb(""); setOrderId(""); setLabelUrl(""); setNote("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!booking) return;
    if (!partner) { toast({ title: "Select the courier partner", variant: "destructive" }); return; }
    if (awb.trim().length < 4) { toast({ title: "Enter a valid AWB number", variant: "destructive" }); return; }
    if (labelUrl.trim() && !/^https?:\/\//i.test(labelUrl.trim())) {
      toast({ title: "Label URL must start with http:// or https://", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-attach-manual-awb", {
        body: {
          booking_id: booking.id,
          partner,
          awb: awb.trim(),
          partner_order_id: orderId.trim() || undefined,
          label_url: labelUrl.trim() || undefined,
          note: note.trim() || undefined,
        },
        headers: { "x-environment": CURRENT_ENV },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Failed to attach AWB");
      }
      toast({ title: "AWB attached", description: `Tracking is now live for ${awb.trim()}` });
      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Could not attach AWB", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" /> Add AWB manually
          </DialogTitle>
          <DialogDescription>
            Use this when the shipment was booked directly on the courier's portal.
            Tracking, label download and cancellation will work as usual afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Courier partner</Label>
            <Select value={partner} onValueChange={setPartner}>
              <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
              <SelectContent>
                {PARTNERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>AWB / waybill number</Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label>Partner order ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label>Label URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={labelUrl} onChange={(e) => setLabelUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Internal note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !awb.trim() || !partner}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Attach AWB"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualAwbDialog;
