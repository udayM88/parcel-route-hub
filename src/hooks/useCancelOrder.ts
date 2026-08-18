import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CURRENT_ENV } from "@/config/environment";
import { useToast } from "@/hooks/use-toast";
import { resolvePartnerKey } from "@/lib/partner-functions";


const CANCELLABLE_STATUSES = [
  "pending", "booked", "created", "confirmed", "new", "assigned",
  "order_confirmed", "order received",
];

export const isCancellable = (status: string | null | undefined): boolean => {
  if (!status) return false;
  return CANCELLABLE_STATUSES.includes(status.toLowerCase());
};

export const CANCEL_REASONS = [
  "Cancelled By Customer",
  "Incorrect/ Incomplete contact info",
  "Payment Issue",
] as const;

export type CancelReason = typeof CANCEL_REASONS[number];

/**
 * Map raw partner cancellation errors (e.g. "...status is READY_FOR_DISPATCH")
 * to friendly, customer-facing copy. Patterns cover lifecycle states used
 * across Delhivery, XpressBees, UrbaneBolt, Shadowfax, and Shree Maruti.
 */
const friendlyCancelError = (raw: string): string => {
  const upper = String(raw || "").toUpperCase();
  if (
    upper.includes("READY_FOR_DISPATCH") ||
    upper.includes("MANIFESTED") ||
    upper.includes("READY TO SHIP")
  ) {
    return "This order is already ready for dispatch and can no longer be cancelled online. Please contact support if you need to stop the shipment.";
  }
  if (
    upper.includes("PICKED_UP") || upper.includes("PICKED UP") ||
    upper.includes("IN_TRANSIT") || upper.includes("IN TRANSIT") ||
    upper.includes("OUT_FOR_DELIVERY") || upper.includes("OUT FOR DELIVERY") ||
    upper.includes("REACHED_HUB")
  ) {
    return "This order has already been picked up and cannot be cancelled. Please contact support.";
  }
  if (upper.includes("DELIVERED")) {
    return "This order has already been delivered and cannot be cancelled.";
  }
  if (upper.includes("RTO") || upper.includes("RETURN")) {
    return "This order is in return/RTO flow and cannot be cancelled. Please contact support.";
  }
  if (upper.includes("CANCELLED") || upper.includes("CANCELED")) {
    return "This order is already cancelled.";
  }
  return raw || "Failed to cancel order";
};

const extractCancelError = (data: any, error: any): string =>
  data?.error ||
  data?.details?.message ||
  (error as any)?.context?.error ||
  (error as any)?.context?.details?.message ||
  error?.message ||
  "Failed to cancel order";

const PARTNER_REJECTION_PATTERNS = [
  "READY_FOR_DISPATCH", "MANIFESTED", "READY TO SHIP",
  "PICKED_UP", "PICKED UP", "IN_TRANSIT", "IN TRANSIT",
  "OUT_FOR_DELIVERY", "OUT FOR DELIVERY", "REACHED_HUB",
  "DELIVERED", "RTO", "RETURN",
];

const isPartnerRejection = (raw: string): boolean => {
  const upper = String(raw || "").toUpperCase();
  return PARTNER_REJECTION_PATTERNS.some((p) => upper.includes(p));
};

interface UseCancelOrderOptions {
  onSuccess?: () => void;
  onDisputeRaised?: () => void;
}

export const useCancelOrder = (options?: UseCancelOrderOptions) => {
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState(false);

  const cancelOrder = async ({
    orderId,
    bookingSource,
    bookingId,
    reason,
    awb,
    userId,
    currentStatus,
    partnerId,
    courierName,
  }: {
    orderId: string;
    bookingSource: string;
    bookingId?: string;
    reason: CancelReason;
    awb?: string | null;
    userId?: string | null;
    currentStatus?: string | null;
    partnerId?: string | null;
    courierName?: string | null;
  }) => {
    setCancelling(true);
    try {
      // Assisted / manually-attached bookings carry booking_source like
      // "admin_assisted", so never rely on booking_source alone.
      const partnerKey = resolvePartnerKey(
        partnerId,
        `${bookingSource || ""} ${courierName || ""}`,
      );

      if (partnerKey === "shadowfax") {
        const { data, error } = await supabase.functions.invoke("shadowfax-cancel-order", {
          body: {
            client_order_id: orderId,
            awb: awb || undefined,
            cancel_remarks: reason,
            booking_id: bookingId,
          },
          headers: { "x-environment": CURRENT_ENV },
        });

        if (error || !data?.success) {
          throw new Error(friendlyCancelError(extractCancelError(data, error)));
        }
      } else if (partnerKey === "shree_maruti") {
        const { data, error } = await supabase.functions.invoke("shree-maruti-cancel-order", {
          body: {
            waybill: awb || undefined,
            cancel_remarks: reason,
            booking_id: bookingId,
          },
          headers: { "x-environment": CURRENT_ENV },
        });

        if (error || !data?.success) {
          throw new Error(friendlyCancelError(extractCancelError(data, error)));
        }
      } else if (partnerKey) {
        // delhivery / urbanebolt / xpressbees — all need an AWB
        if (!awb) {
          throw new Error(`AWB number required to cancel this ${partnerKey} shipment`);
        }
        const fn = `${partnerKey.replace(/_/g, "-")}-cancel-order`;
        const { data, error } = await supabase.functions.invoke(fn, {
          body: {
            waybill: awb,
            cancel_remarks: reason,
            booking_id: bookingId,
          },
          headers: { "x-environment": CURRENT_ENV },
        });

        if (error || !data?.success) {
          throw new Error(friendlyCancelError(extractCancelError(data, error)));
        }
      } else if (bookingSource === "prayog" || bookingSource === "" || !bookingSource) {
        // Legacy / Prayog-routed bookings — cancel via Prayog gateway.
        const auth = JSON.parse(localStorage.getItem("auth_session") || localStorage.getItem("prayog_auth") || "{}");
        const { data, error } = await supabase.functions.invoke("prayog-cancel-order", {
          body: {
            order_id: orderId,
            auth_token: auth?.access_token || auth?.token || "",
            booking_id: bookingId,
          },
          headers: { "x-environment": CURRENT_ENV },
        });

        if (error || !data?.success) {
          throw new Error(friendlyCancelError(extractCancelError(data, error)));
        }
      } else {
        throw new Error(
          `This order was placed with a partner (${bookingSource}) that doesn't support online cancellation. Please contact support.`
        );
      }


      toast({
        title: "Order Cancelled",
        description: "Your order has been cancelled. Refund will be processed if applicable.",
      });
      options?.onSuccess?.();
      return true;
    } catch (err: any) {
      console.error("Cancel order error:", err);
      const rawMsg: string = err?.message || "Could not cancel the order. Please try again.";

      // If partner has already moved the shipment forward, raise an admin dispute
      // so the customer doesn't hit a dead end.
      if (isPartnerRejection(rawMsg) && bookingId && userId) {
        try {
          const authRaw = localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth');
          const { error: disputeFnErr } = await supabase.functions.invoke('raise-cancellation-dispute', {
            body: {
              booking_id: bookingId,
              reason,
              partner_error: rawMsg,
              partner_status_at_attempt: currentStatus || null,
              previous_booking_status: currentStatus || null,
            },
            headers: authRaw ? { 'x-prayog-auth': authRaw } : undefined,
          });
          if (disputeFnErr) throw disputeFnErr;
          toast({
            title: "Cancellation request received",
            description:
              "The courier has already accepted this shipment so we couldn't cancel it instantly. Our team will contact you shortly to help resolve.",
          });
          options?.onDisputeRaised?.();
          return false;
        } catch (disputeErr) {
          console.error("Failed to raise dispute:", disputeErr);
        }
      }

      toast({
        title: "Cancellation Failed",
        description: rawMsg,
        variant: "destructive",
      });
      return false;
    } finally {
      setCancelling(false);
    }
  };

  return { cancelOrder, cancelling };
};
