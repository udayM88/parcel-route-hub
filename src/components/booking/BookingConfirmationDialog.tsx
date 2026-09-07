import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, Package, Printer, Truck, Loader2 } from "lucide-react";
import ParcelPhotoUpload from "@/components/booking/ParcelPhotoUpload";

interface BookingConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  awbNumber: string;
  labelUrl?: string | null;
  courierName?: string;
  isReversePickup?: boolean;
  bookingId?: string | null;
  processing?: boolean;
}

const BookingConfirmationDialog = ({
  isOpen,
  onClose,
  awbNumber,
  labelUrl,
  courierName,
  isReversePickup = false,
  bookingId,
  processing = false,
}: BookingConfirmationDialogProps) => {
  const handleDownloadLabel = () => {
    if (labelUrl) {
      window.open(labelUrl, "_blank");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${processing ? "bg-warning/20" : "bg-success/20"}`}>
            {processing ? (
              <Loader2 className="h-10 w-10 text-warning animate-spin" />
            ) : (
              <CheckCircle className="h-10 w-10 text-success" />
            )}
          </div>
          <DialogTitle className="text-xl font-bold text-center">
            {processing ? "Order Under Processing" : "Booking Confirmed!"}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {processing
              ? "Payment received. We're confirming your booking with the courier."
              : "Your shipment has been successfully booked"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* AWB Number */}
          {processing ? (
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-center space-y-1">
              <p className="text-sm font-semibold">We're confirming your booking with the courier.</p>
              <p className="text-xs text-muted-foreground">
                Your tracking number will appear in Order History shortly. No action is needed from you.
              </p>
            </div>
          ) : (
          <div className="rounded-lg bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">AWB Number</p>
            <p className="text-lg font-bold font-mono">{awbNumber}</p>
            {courierName && (
              <p className="text-xs text-muted-foreground mt-1">via {courierName}</p>
            )}
          </div>
          )}

          {processing ? null : isReversePickup ? (
            <>
              {/* Reverse Pickup — no print needed */}
              <div className="rounded-lg border border-success/30 bg-success/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-success" />
                  <h4 className="font-semibold text-sm">Reverse Pickup — No Printing Required</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  You <span className="font-medium text-foreground">don't need to print</span> the
                  shipping label. Our pickup executive will carry the label and paste it on your
                  parcel at the time of pickup.
                </p>
                <p className="text-sm text-muted-foreground">
                  Just keep your parcel <span className="font-medium text-foreground">securely packed</span> and
                  ready for handover.
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-3">
                <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Tip:</span> Please share the AWB number
                  above with the pickup executive for verification.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Forward — printing mandatory */}
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-warning" />
                  <h4 className="font-semibold text-sm">Important: Next Steps</h4>
                </div>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  <li>
                    <span className="font-medium text-foreground">Download</span> the shipping label using the button below
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Print</span> the label on an A4 or A6 paper
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Attach</span> the printed label securely on your shipment box
                  </li>
                </ol>
              </div>

              <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-3">
                <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Note:</span> The courier will only pick up your shipment if the shipping label is clearly visible and attached to the package.
                </p>
              </div>
            </>
          )}

          {bookingId && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Upload Parcel Photos (Required)
              </h4>
              <p className="text-xs text-muted-foreground">
                Please upload photos of your packed parcel so we can verify its
                condition at pickup and at delivery.
              </p>
              <ParcelPhotoUpload bookingId={bookingId} compact />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          {labelUrl && !isReversePickup && !processing && (
            <Button onClick={handleDownloadLabel} className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download Shipping Label
            </Button>
          )}
          <Button variant="outline" onClick={onClose} className="w-full">
            Go to Order History
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BookingConfirmationDialog;
