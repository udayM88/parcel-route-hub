import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const MANUAL_STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed / Manifested" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "DELAYED", label: "Delayed" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "RTO", label: "RTO / Returned" },
];

const LOCKED = ["CANCELLED", "CANCELED", "FAILED", "PAYMENT_ABANDONED", "PENDING_PAYMENT"];
export const canManuallyUpdateStatus = (status?: string | null) =>
  !LOCKED.includes(String(status || "").toUpperCase());

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookingId: string;
  currentStatus: string | null;
  onUpdated: (status: string) => void;
}

export default function UpdateStatusDialog({ open, onOpenChange, bookingId, currentStatus, onUpdated }: Props) {
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-update-booking-status", {
      body: { booking_id: bookingId, status, reason, notify_customer: notify },
    });
    setSaving(false);
    const msg = (data as any)?.error || error?.message;
    if (error || !(data as any)?.success) {
      toast({ title: "Status not updated", description: typeof msg === "string" ? msg : "Please check the inputs", variant: "destructive" });
      return;
    }
    toast({ title: "Status updated", description: `Shipment is now ${status.replace(/_/g, " ")}` });
    onUpdated(status);
    setStatus(""); setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change shipment status</DialogTitle>
          <DialogDescription>
            Current: {currentStatus || "—"}. To cancel with a refund, use Cancel Order instead. The next courier update may overwrite this.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>New status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {MANUAL_STATUS_OPTIONS.filter(o => o.value !== String(currentStatus || "").toUpperCase()).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason (saved in audit log)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} placeholder="e.g. Courier confirmed delivery by phone" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={notify} onCheckedChange={v => setNotify(v === true)} />
            Send customer SMS for this status (if template enabled)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={submit} disabled={saving || !status || reason.trim().length < 3}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
