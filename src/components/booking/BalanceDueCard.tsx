import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IndianRupee, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";

export interface BookingBalance {
  id: string;
  booking_id: string;
  status: string;
  amount_due: number;
  previous_amount: number;
  new_amount: number;
  previous_courier_name?: string | null;
  new_courier_name?: string | null;
  reason?: string | null;
  razorpay_payment_link_url?: string | null;
}

interface Props {
  balance: BookingBalance;
  onPaid?: () => void;
}

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

/**
 * Shown on a customer's order when the shipment had to be re-booked with a
 * different courier at a higher price. Explains the difference in plain terms
 * and lets the customer settle it with the usual Razorpay flow.
 */
const BalanceDueCard = ({ balance, onPaid }: Props) => {
  const { toast } = useToast();
  const [paying, setPaying] = useState(false);

  if (balance.status === "paid") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-md border border-green-400/40 bg-green-500/15 px-3 py-2 text-sm text-green-100">
        <CheckCircle2 className="h-4 w-4" />
        Balance of ₹{Math.round(balance.amount_due)} paid
      </div>
    );
  }
  if (balance.status !== "pending") return null;

  const handlePay = async () => {
    const auth = getAuthSession();
    if (!auth) {
      toast({ title: "Please sign in again", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) throw new Error("Could not load the payment gateway");

      const { data, error } = await supabase.functions.invoke("booking-balance", {
        body: { action: "create-order", balance_id: balance.id },
        headers: { "x-prayog-auth": JSON.stringify(auth), "x-environment": CURRENT_ENV },
      });
      if (error || (data as any)?.error) {
        throw new Error((data as any)?.error || error?.message || "Could not start payment");
      }
      const order = data as any;

      const rz = new (window as any).Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "ViaSetu",
        description: "Shipment balance payment",
        order_id: order.orderId,
        handler: async (resp: any) => {
          const { data: vData, error: vErr } = await supabase.functions.invoke("booking-balance", {
            body: {
              action: "verify",
              balance_id: balance.id,
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            },
            headers: { "x-prayog-auth": JSON.stringify(auth), "x-environment": CURRENT_ENV },
          });
          if (vErr || (vData as any)?.error) {
            toast({
              title: "Payment received, confirmation pending",
              description: "Our team will confirm your shipment shortly.",
            });
          } else {
            toast({ title: "Balance paid", description: "Your shipment is confirmed." });
          }
          onPaid?.();
        },
        modal: { ondismiss: () => setPaying(false) },
        theme: { color: "#06b6d4" },
      });
      rz.open();
    } catch (e: any) {
      toast({ title: "Payment failed", description: e?.message, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  return (
    <Card className="mt-3 p-3 bg-amber-500/10 backdrop-blur-xl border-amber-500/30">
      <div className="flex items-center gap-2 mb-2">
        <IndianRupee className="h-4 w-4 text-amber-300" />
        <span className="font-semibold text-white">Balance due</span>
        <Badge className="bg-amber-500/30 text-amber-100 border-0 text-xs">
          ₹{Math.round(balance.amount_due)}
        </Badge>
      </div>
      <div className="space-y-1 text-sm text-white/80">
        {balance.previous_courier_name && (
          <div className="flex justify-between">
            <span>Original courier ({balance.previous_courier_name})</span>
            <span>₹{Math.round(balance.previous_amount)}</span>
          </div>
        )}
        {balance.new_courier_name && (
          <div className="flex justify-between">
            <span>Re-booked with {balance.new_courier_name}</span>
            <span>₹{Math.round(balance.new_amount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Already paid</span>
          <span>-₹{Math.round(balance.previous_amount)}</span>
        </div>
        <div className="flex justify-between font-semibold text-white border-t border-white/20 pt-1">
          <span>Balance to pay (incl. GST)</span>
          <span>₹{Math.round(balance.amount_due)}</span>
        </div>
      </div>
      <Button className="w-full mt-3" onClick={handlePay} disabled={paying}>
        {paying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</> : "Pay balance"}
      </Button>
    </Card>
  );
};

export default BalanceDueCard;
