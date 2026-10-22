import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Check, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CANCEL_REASONS, type CancelReason } from "@/hooks/useCancelOrder";
import { cn } from "@/lib/utils";

export interface CancellationQuote {
  stage: "grace" | "pre_pickup" | "pickup_attempted" | "not_allowed";
  stageLabel: string;
  amountPaid: number;
  courierCharge: number;
  platformFee: number;
  deduction: number;
  gstOnFee: number;
  refundAmount: number;
  waived: boolean;
  minutesSinceBooking: number;
  graceMinutes: number;
}

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: CancelReason, waiveFee: boolean) => void;
  cancelling: boolean;
  bookingId?: string | null;
  /** Admin screens may waive the charge (default: waived). */
  allowWaive?: boolean;
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const STEPS: { key: CancellationQuote["stage"]; label: string }[] = [
  { key: "grace", label: "Booked" },
  { key: "pre_pickup", label: "Awaiting pickup" },
  { key: "pickup_attempted", label: "Pickup attempted" },
];

const CancelOrderDialog = ({ open, onOpenChange, onConfirm, cancelling, bookingId, allowWaive }: CancelOrderDialogProps) => {
  const [reason, setReason] = useState<CancelReason>("Cancelled By Customer");
  const [showDetails, setShowDetails] = useState(false);
  const [waive, setWaive] = useState(true);
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !bookingId) return;
    let alive = true;
    setLoading(true);
    setShowDetails(false);
    supabase.functions
      .invoke("cancellation-quote", { body: { booking_id: bookingId, waive_cancellation_fee: false } })
      .then(({ data }) => { if (alive) setQuote((data as any)?.quote || null); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, bookingId]);

  const waived = Boolean(allowWaive && waive);
  const deduction = waived ? 0 : quote?.deduction || 0;
  const refund = quote ? (waived ? quote.amountPaid : quote.refundAmount) : 0;
  const activeIdx = quote ? STEPS.findIndex((s) => s.key === quote.stage) : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {deduction > 0 ? "Cancellation charges will apply" : "Cancel Order"}
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Your shipping label has already been generated with the courier.
          </DialogDescription>
        </DialogHeader>

        {bookingId && (
          <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
            {loading || !quote ? (
              <Skeleton className="h-16 w-full" />
            ) : quote.stage === "not_allowed" ? (
              <p className="text-sm">This parcel has already been picked up and can't be cancelled online. Please contact support.</p>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">You will get back</p>
                    <p className="text-3xl font-bold">{inr(refund)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Cancellation charge</p>
                    <p className="text-lg font-semibold text-destructive">{inr(deduction)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  {showDetails ? "Hide details" : "View details"}
                  {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDetails && (
                  <div className="space-y-4 pt-1">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Order stage</p>
                      <div className="flex items-start">
                        {STEPS.map((s, i) => (
                          <div key={s.key} className="flex-1 flex flex-col items-center text-center relative">
                            {i > 0 && (
                              <span className={cn("absolute top-3 right-1/2 w-full h-0.5", i <= activeIdx ? "bg-primary" : "bg-border")} />
                            )}
                            <span className={cn(
                              "relative z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs",
                              i < activeIdx && "bg-primary border-primary text-primary-foreground",
                              i === activeIdx && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/30",
                              i > activeIdx && "bg-background border-border text-muted-foreground",
                            )}>
                              {i < activeIdx ? <Check className="h-3 w-3" /> : i + 1}
                            </span>
                            <span className={cn("mt-1 text-[11px] leading-tight", i === activeIdx ? "font-semibold" : "text-muted-foreground")}>
                              {s.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{quote.stageLabel}</p>
                    </div>

                    <dl className="text-sm space-y-1.5">
                      <Row label="Amount paid" value={inr(quote.amountPaid)} />
                      <Row label="Courier charge (label & pickup)" value={`- ${inr(waived ? 0 : quote.courierCharge)}`} />
                      <Row label="ViaSetu cancellation fee" value={`- ${inr(waived ? 0 : quote.platformFee)}`} />
                      <Row label="Includes GST (18%) on charges" value={inr(waived ? 0 : quote.gstOnFee)} muted />
                      <div className="border-t pt-1.5">
                        <Row label="Refund amount" value={inr(refund)} bold />
                      </div>
                    </dl>

                    <p className="text-xs text-muted-foreground">
                      How this is calculated: within {quote.graceMinutes} minutes of booking only a small fee applies;
                      after that, the courier's label cost is added; once a pickup rider is assigned, the attempted-pickup
                      cost applies. Refunds reach the original payment method in 5–7 working days.{" "}
                      <Link to="/refund-policy" className="underline" target="_blank">Refund policy</Link>
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {allowWaive && quote && quote.deduction > 0 && (
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>Waive cancellation charges (full refund)</span>
            <Switch checked={waive} onCheckedChange={setWaive} />
          </label>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Cancellation Reason</label>
          <Select value={reason} onValueChange={(v) => setReason(v as CancelReason)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CANCEL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancelling}>Keep Order</Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason, waived)}
            disabled={cancelling || (Boolean(bookingId) && (loading || quote?.stage === "not_allowed"))}
          >
            {cancelling ? "Cancelling..." : quote ? `Cancel & refund ${inr(refund)}` : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) => (
  <div className={cn("flex justify-between gap-3", muted && "text-xs text-muted-foreground", bold && "font-semibold text-base")}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>
);

export default CancelOrderDialog;
