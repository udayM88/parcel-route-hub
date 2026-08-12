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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Loader2, PackagePlus, Upload, AlertTriangle } from "lucide-react";
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
  booking: {
    id: string;
    courier_name?: string | null;
    partner_id?: string | null;
    prayog_awb?: string | null;
    tracking_id?: string | null;
    courier_price?: number | null;
  } | null;
  onSuccess?: () => void;
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Admin action: attach (or replace) an AWB booked directly on a courier portal,
 * optionally uploading the label file, so tracking, label download and
 * cancellation start working through the normal partner integrations.
 *
 * When the new partner costs more than the customer already paid, the admin
 * can send a Razorpay link for the difference, let the customer pay it from
 * their History screen, or waive it with a reason.
 */
const ManualAwbDialog = ({ open, onOpenChange, booking, onSuccess }: ManualAwbDialogProps) => {
  const { toast } = useToast();
  const [partner, setPartner] = useState("");
  const [awb, setAwb] = useState("");
  const [orderId, setOrderId] = useState("");
  const [labelUrl, setLabelUrl] = useState("");
  const [labelFile, setLabelFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [differenceAction, setDifferenceAction] = useState<"link" | "in_app" | "waive">("in_app");
  const [waiveReason, setWaiveReason] = useState("");
  const [bookAfterPayment, setBookAfterPayment] = useState(false);

  const existingAwb = booking?.prayog_awb || booking?.tracking_id || null;
  const paidAmount = Number(booking?.courier_price) || 0;
  const parsedNewPrice = newPrice.trim() === "" ? null : Number(newPrice);
  const difference = parsedNewPrice != null && !Number.isNaN(parsedNewPrice)
    ? Math.round((parsedNewPrice - paidAmount) * 100) / 100
    : 0;
  const hasShortfall = difference > 0.5;

  const guessPartner = () => {
    const s = `${booking?.partner_id || ""} ${booking?.courier_name || ""}`.toLowerCase();
    const hit = PARTNERS.find((p) => s.includes(p.value.split("_")[0]) || s.includes(p.label.toLowerCase()));
    return hit?.value || "";
  };

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPartner(guessPartner());
      setAwb(""); setOrderId(""); setLabelUrl(""); setNote(""); setLabelFile(null);
      setNewPrice(""); setDifferenceAction("in_app"); setWaiveReason(""); setBookAfterPayment(false);
    }
    onOpenChange(next);
  };

  const holdShipment = hasShortfall && bookAfterPayment && differenceAction !== "waive";

  const handleSubmit = async () => {
    if (!booking) return;
    if (!partner) { toast({ title: "Select the courier partner", variant: "destructive" }); return; }
    if (!holdShipment && awb.trim().length < 4) {
      toast({ title: "Enter a valid AWB number", variant: "destructive" });
      return;
    }
    if (labelUrl.trim() && !/^https?:\/\//i.test(labelUrl.trim())) {
      toast({ title: "Label URL must start with http:// or https://", variant: "destructive" });
      return;
    }
    if (labelFile && labelFile.size > 5 * 1024 * 1024) {
      toast({ title: "Label file must be under 5 MB", variant: "destructive" });
      return;
    }
    if (hasShortfall && differenceAction === "waive" && waiveReason.trim().length < 3) {
      toast({ title: "Add a reason for waiving the difference", variant: "destructive" });
      return;
    }


    setSaving(true);
    try {
      const label_file = labelFile
        ? {
            name: labelFile.name,
            content_type: labelFile.type || "application/pdf",
            data: await fileToBase64(labelFile),
          }
        : undefined;

      const { data, error } = await supabase.functions.invoke("admin-attach-manual-awb", {
        body: {
          booking_id: booking.id,
          partner,
          awb: awb.trim(),
          partner_order_id: orderId.trim() || undefined,
          label_url: labelUrl.trim() || undefined,
          label_file,
          note: note.trim() || undefined,
          replace: Boolean(existingAwb),
          new_price: parsedNewPrice != null && !Number.isNaN(parsedNewPrice) ? parsedNewPrice : undefined,
          difference_action: hasShortfall ? differenceAction : undefined,
          waive_reason: hasShortfall && differenceAction === "waive" ? waiveReason.trim() : undefined,
          book_after_payment: holdShipment,
        },
        headers: { "x-environment": CURRENT_ENV },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Failed to attach AWB");
      }
      const balanceLink = (data as any)?.balance?.razorpay_payment_link_url;
      toast({
        title: holdShipment
          ? "Balance requested — shipment on hold"
          : existingAwb ? "Shipment updated" : "AWB attached",
        description: hasShortfall
          ? differenceAction === "waive"
            ? `Difference of ₹${difference} waived.`
            : balanceLink
              ? `Payment link for ₹${difference}: ${balanceLink}`
              : `₹${difference} balance is now payable by the customer in their History.`
          : `Tracking is now live for ${awb.trim()}`,
      });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5" />
            {existingAwb ? "Update AWB / courier" : "Add AWB manually"}
          </DialogTitle>
          <DialogDescription>
            Use this when the shipment was booked directly on the courier's portal.
            Tracking, label download and cancellation will work as usual afterwards,
            and the customer sees it in their History.
          </DialogDescription>
        </DialogHeader>

        {existingAwb && (
          <div className="flex gap-2 items-start rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
            <span>
              This order already has AWB <strong>{existingAwb}</strong>. Saving will replace it
              with the new courier and tracking number.
            </span>
          </div>
        )}

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
            <Label>
              AWB / waybill number
              {holdShipment && <span className="text-muted-foreground"> (optional — shipment held until paid)</span>}
            </Label>
            <Input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" maxLength={64} />
          </div>
          <div className="space-y-1.5">
            <Label>Partner order ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} maxLength={64} />
          </div>

          {/* ── Price difference ─────────────────────────────────── */}
          <div className="rounded-md border p-3 space-y-3">
            <div className="space-y-1.5">
              <Label>New partner price (₹, incl. GST) <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                inputMode="decimal"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder={`Customer paid ₹${Math.round(paidAmount)}`}
              />
            </div>

            {parsedNewPrice != null && !Number.isNaN(parsedNewPrice) && (
              difference > 0.5 ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    Customer paid <strong>₹{Math.round(paidAmount)}</strong>, new price is{" "}
                    <strong>₹{Math.round(parsedNewPrice)}</strong> — shortfall{" "}
                    <strong className="text-destructive">₹{difference}</strong>.
                  </p>
                  <RadioGroup
                    value={differenceAction}
                    onValueChange={(v) => setDifferenceAction(v as typeof differenceAction)}
                    className="space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="link" id="diff-link" />
                      <Label htmlFor="diff-link" className="font-normal">Send Razorpay payment link (SMS)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="in_app" id="diff-app" />
                      <Label htmlFor="diff-app" className="font-normal">Let customer pay from History</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="waive" id="diff-waive" />
                      <Label htmlFor="diff-waive" className="font-normal">Waive — ViaSetu absorbs it</Label>
                    </div>
                  </RadioGroup>

                  {differenceAction === "waive" ? (
                    <div className="space-y-1.5">
                      <Label>Reason for waiver</Label>
                      <Input
                        value={waiveReason}
                        onChange={(e) => setWaiveReason(e.target.value)}
                        placeholder="e.g. partner failure, goodwill"
                        maxLength={300}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="hold-shipment"
                        checked={bookAfterPayment}
                        onCheckedChange={setBookAfterPayment}
                      />
                      <Label htmlFor="hold-shipment" className="font-normal">
                        Book with the new partner only after the balance is paid
                      </Label>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  New price is the same or lower — nothing to collect, no refund is issued.
                </p>
              )
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Upload label file <span className="text-muted-foreground">(PDF / PNG / JPG, optional)</span>
            </Label>
            <Input
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setLabelFile(e.target.files?.[0] || null)}
            />
            {labelFile && (
              <p className="text-xs text-muted-foreground">
                {labelFile.name} · {(labelFile.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Label URL <span className="text-muted-foreground">(optional, if hosted elsewhere)</span></Label>
            <Input value={labelUrl} onChange={(e) => setLabelUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="space-y-1.5">
            <Label>Internal note <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !partner || (!holdShipment && !awb.trim())}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</>
              : holdShipment ? "Save & request balance" : existingAwb ? "Replace AWB" : "Attach AWB"}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default ManualAwbDialog;
