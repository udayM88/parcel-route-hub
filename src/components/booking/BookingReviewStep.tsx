import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, IndianRupee, Truck, CreditCard, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { computeChargeableKg, extractGst } from "@/lib/pricing";

interface BookingReviewStepProps {
  senderData: {
    name: string;
    phone: string;
    flatNo?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  receiverData: {
    name: string;
    phone: string;
    flatNo?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  packageDetails: {
    goodsType: string;
    weight: string;
    dimensions: { length: string; width: string; height: string };
    shipmentValue: string;
    urgency: string;
  };
  courierDetails: {
    name: string;
    baseFare: number; // Courier price + platform fee (hidden from user)
    deliveryTime: string;
  };
  selectedDate?: Date;
  onConfirm: () => void;
  onBack: () => void;
  /** Admin-assisted booking: swaps the CTA and exposes the no-payment path. */
  isAssisted?: boolean;
  onBookWithoutPayment?: () => void;
}

const BookingReviewStep = ({
  senderData,
  receiverData,
  packageDetails,
  courierDetails,
  selectedDate,
  onConfirm,
  onBack,
  isAssisted = false,
  onBookWithoutPayment,
}: BookingReviewStepProps) => {
  const [submitting] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);

  // Calculate GST at 18% on the base fare (which includes hidden platform fee)
  const totalAmount = Math.round(courierDetails.baseFare);
  const gstAmount = extractGst(totalAmount);
  const baseFareRounded = totalAmount - gstAmount;

  return (
    <Card className="mt-4 md:mt-6">
      <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
        <CardTitle className="text-lg md:text-xl font-bold">Review Your Booking</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Please review all details before confirming your order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 md:space-y-6 p-4 md:p-6 pt-0">
        {/* Sender Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Pickup Details</h3>
          </div>
          <div className="ml-0 sm:ml-7 space-y-1 text-sm">
            <p className="font-semibold">{senderData.name}</p>
            <p className="text-muted-foreground">{senderData.phone}</p>
            <p className="text-muted-foreground">
              {[senderData.flatNo, senderData.address].filter(Boolean).join(', ')}, {senderData.city}, {senderData.state} - {senderData.pincode}
            </p>
          </div>
        </div>

        <Separator />

        {/* Receiver Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-secondary" />
            <h3 className="font-bold">Delivery Details</h3>
          </div>
          <div className="ml-0 sm:ml-7 space-y-1 text-sm">
            <p className="font-semibold">{receiverData.name}</p>
            <p className="text-muted-foreground">{receiverData.phone}</p>
            <p className="text-muted-foreground">
              {[receiverData.flatNo, receiverData.address].filter(Boolean).join(', ')}, {receiverData.city}, {receiverData.state} - {receiverData.pincode}
            </p>
          </div>
        </div>

        <Separator />

        {/* Package Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-accent" />
            <h3 className="font-bold">Package Information</h3>
          </div>
          <div className="ml-0 sm:ml-7 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold capitalize">{packageDetails.goodsType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Weight (entered)</p>
              <p className="font-semibold">{packageDetails.weight} g</p>
            </div>
            <div>
              <p className="text-muted-foreground">Dimensions (L×W×H)</p>
              <p className="font-semibold">
                {packageDetails.dimensions.length} × {packageDetails.dimensions.width} × {packageDetails.dimensions.height} cm
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Declared Value</p>
              <p className="font-semibold">₹{packageDetails.shipmentValue}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Priority</p>
              <Badge variant="outline" className="capitalize">{packageDetails.urgency}</Badge>
            </div>
          </div>

          {/* Chargeable weight — single source of truth for billing.
              Dead/volumetric breakdown intentionally hidden from the user. */}
          {(() => {
            const isDocuments = packageDetails.goodsType === 'documents';
            const deadKg = (parseFloat(packageDetails.weight) || 0) / 1000;
            const { chargeableKg } = computeChargeableKg(
              deadKg,
              packageDetails.dimensions.length,
              packageDetails.dimensions.width,
              packageDetails.dimensions.height,
              { isDocument: isDocuments },
            );
            if (deadKg <= 0) return null;
            const fmt = (kg: number) => `${Math.round(kg * 1000).toLocaleString()} g`;
            return (
              <div className="ml-0 sm:ml-7 mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 flex justify-between items-center text-xs">
                <span className="font-semibold">Chargeable weight (billed)</span>
                <span className="font-bold text-primary">{fmt(chargeableKg)}</span>
              </div>
            );
          })()}
        </div>


        <Separator />

        {/* Courier & Delivery */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-bold">Courier & Schedule</h3>
          </div>
          <div className="ml-0 sm:ml-7 space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Courier Service</span>
              <span className="font-semibold">{courierDetails.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Estimated Delivery</span>
              <span className="font-semibold">{courierDetails.deliveryTime}</span>
            </div>
            {selectedDate && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pickup Date</span>
                <span className="font-semibold">{selectedDate.toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Pricing */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-green-600" />
            <h3 className="font-bold">Payment Summary</h3>
          </div>
          <div className="ml-0 sm:ml-7 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Base Fare</span>
              <span>₹{baseFareRounded}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-foreground font-medium">GST (18%, included)</span>
              <span>₹{gstAmount}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>Total Amount</span>
              <span className="text-primary">₹{totalAmount}</span>
            </div>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-xs text-muted-foreground">
            By confirming this booking, you agree to our terms of service and shipping policies. 
            Your package will be picked up on the selected date.
          </p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
          <p className="text-xs text-foreground">
            <strong>Pickup ETA:</strong> Once your order is placed, it will be picked up within
            the next 24–48 hours. Sit back and relax — we'll keep you posted.
          </p>
        </div>

        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-foreground">
            <strong>No cancellation after booking:</strong> Once you pay and place this order,
            it cannot be cancelled from the app. If you absolutely need to cancel afterwards,
            please email{' '}
            <a href="mailto:support@viasetu.com" className="font-semibold underline">
              support@viasetu.com
            </a>{' '}
            and our team will try to help — cancellation is not guaranteed once the courier
            has accepted the shipment.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={() => (isAssisted ? onConfirm() : setShowCancelWarning(true))}
            className="w-full"
            disabled={submitting}
          >
            <CreditCard className="h-4 w-4" />
            {isAssisted ? `Send payment link (₹${totalAmount})` : `Pay Now (₹${totalAmount})`}
          </Button>
          {isAssisted && onBookWithoutPayment && (
            <Button
              variant="outline"
              onClick={onBookWithoutPayment}
              className="w-full"
              disabled={submitting}
            >
              Book without payment
            </Button>
          )}
          <Button variant="ghost" onClick={onBack} className="w-full" disabled={submitting}>
            Back to Edit
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={showCancelWarning} onOpenChange={setShowCancelWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Orders cannot be cancelled once placed
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm all details are correct. Once you proceed to pay and the order is
              placed, it cannot be cancelled from the app. If you need to cancel after booking,
              email <span className="font-semibold">support@viasetu.com</span> — our team will
              try to help, but cancellation is not guaranteed once the courier accepts the
              shipment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCancelWarning(false);
                onConfirm();
              }}
            >
              Yes, place order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default BookingReviewStep;
