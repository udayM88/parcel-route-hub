import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  Lock,
  CheckCircle,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: {
    courierId: number | string;
    courierName: string;
    baseFare: number; // Base fare (courier price + platform fee)
    gstAmount: number; // GST at 18%
    totalAmount: number; // Total to be charged
    pickupDate?: string;
  };
  onPaymentSuccess: (paymentMethod: string, paymentDetails?: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    booking_id?: string | null;
  }) => void;
  customerDetails?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  /**
   * Snapshot of the booking the customer is paying for. Sent to
   * razorpay-verify-payment so a PAYMENT_RECEIVED row is persisted server-side
   * the moment payment is verified — preventing orphan payments if the browser
   * closes before the courier API call completes.
   */
  bookingDraft?: Record<string, unknown>;
}

const PaymentModal = ({ isOpen, onClose, orderDetails, onPaymentSuccess, customerDetails, bookingDraft }: PaymentModalProps) => {
  const [paymentMethod, setPaymentMethod] = useState('razorpay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const { toast } = useToast();

  const { baseFare, gstAmount, totalAmount } = orderDetails;

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        console.log('Razorpay script loaded');
        setRazorpayLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        toast({
          title: "Payment Error",
          description: "Failed to load payment gateway. Please try again.",
          variant: "destructive",
        });
      };
      document.body.appendChild(script);
    } else if (window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, []);

  const paymentOptions = [
    {
      id: 'razorpay',
      label: 'Pay Online',
      icon: CreditCard,
      description: 'UPI, Cards, Wallets, Net Banking via Razorpay'
    }
  ];

  const handleRazorpayPayment = async () => {
    if (!razorpayLoaded) {
      toast({
        title: "Please wait",
        description: "Payment gateway is loading...",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Step 1: Create Razorpay order via edge function
      console.log('Creating Razorpay order for amount:', totalAmount);
      
      const { data: orderData, error: orderError } = await supabase.functions.invoke('razorpay-create-order', {
        body: {
          amount: totalAmount,
          currency: 'INR',
          receipt: `booking_${Date.now()}`,
          notes: {
            courierName: orderDetails.courierName,
            courierId: orderDetails.courierId,
          }
        }
      });

      if (orderError || !orderData?.orderId) {
        console.error('Failed to create order:', orderError || orderData);
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      console.log('Order created:', orderData.orderId);

      // Step 2: Open Razorpay checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'ViaSetu',
        description: `Delivery - ${orderDetails.courierName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          console.log('Payment successful, verifying...', response);
          
          // Step 3: Verify payment AND persist a PAYMENT_RECEIVED booking row
          try {
            const prayogAuthRaw = localStorage.getItem('prayog_auth');
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay-verify-payment', {
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                booking_draft: bookingDraft || null,
              },
              headers: prayogAuthRaw ? { 'x-prayog-auth': prayogAuthRaw } : {},
            });

            if (verifyError || !verifyData?.verified) {
              console.error('Payment verification failed, triggering auto-refund:', verifyError || verifyData);
              // Auto-refund: payment was captured but signature verification failed.
              try {
                // prayogAuthRaw already in scope from outer try
                const { data: refundData, error: refundError } = await supabase.functions.invoke(
                  'confirm-booking-or-refund',
                  {
                    body: {
                      payment_id: response.razorpay_payment_id,
                      reason: 'verification_failed',
                      error_detail: String(verifyError?.message || verifyData?.error || 'signature mismatch'),
                    },
                    headers: prayogAuthRaw ? { 'x-prayog-auth': prayogAuthRaw } : {},
                  }
                );

                if (!refundError && refundData?.refunded) {
                  toast({
                    title: "Payment Refunded",
                    description: `Verification failed. ₹${totalAmount} refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`,
                  });
                } else {
                  toast({
                    title: "Verification Failed",
                    description: `Refund could not be processed. Payment ID: ${response.razorpay_payment_id}. Please contact support.`,
                    variant: "destructive",
                  });
                }
              } catch (refundErr) {
                console.error('Auto-refund after verification failure errored:', refundErr);
                toast({
                  title: "Verification Failed",
                  description: `Payment ID: ${response.razorpay_payment_id}. Please contact support for refund.`,
                  variant: "destructive",
                });
              }
              setIsProcessing(false);
              return;
            }

            console.log('Payment verified:', verifyData);
            
            toast({
              title: "Payment Successful!",
              description: `Order confirmed with ${orderDetails.courierName}`,
              action: (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </div>
              ),
            });

            onPaymentSuccess('razorpay', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              booking_id: verifyData?.booking_id ?? null,
            });
            onClose();
          } catch (verifyErr) {
            console.error('Verification error:', verifyErr);
            toast({
              title: "Verification Error",
              description: "Payment may have succeeded. Please check your email.",
              variant: "destructive",
            });
          }
          setIsProcessing(false);
        },
        prefill: {
          name: customerDetails?.name || '',
          email: customerDetails?.email || '',
          contact: customerDetails?.phone || '',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: function() {
            console.log('Razorpay modal dismissed');
            setIsProcessing(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast({
          title: "Payment Failed",
          description: response.error.description || "Please try again",
          variant: "destructive",
        });
        setIsProcessing(false);
      });
      
      razorpay.open();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handlePayment = () => {
    handleRazorpayPayment();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Secure Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Courier Partner</span>
                <span className="font-medium">{orderDetails.courierName}</span>
              </div>
              {orderDetails.pickupDate && (
                <div className="flex justify-between text-sm">
                  <span>Pickup Date</span>
                  <span className="font-medium">
                    {new Date(orderDetails.pickupDate).toLocaleDateString('en-IN', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-sm">
                <span>Base Fare</span>
                <span>₹{baseFare}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST (18%)</span>
                <span>₹{gstAmount}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total Amount</span>
                <span>₹{totalAmount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Choose Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              {paymentOptions.map((option) => {
                const IconComponent = option.icon;
                return (
                  <div key={option.id} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={option.id} id={option.id} />
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <IconComponent className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <Label htmlFor={option.id} className="font-medium cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Security Note */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
            <Lock className="h-3 w-3" />
            <span>Your payment information is secure and encrypted</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={handlePayment} 
              disabled={isProcessing || (paymentMethod === 'razorpay' && !razorpayLoaded)}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : paymentMethod === 'razorpay' ? (
                `Pay ₹${totalAmount}`
              ) : (
                'Confirm Order'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
