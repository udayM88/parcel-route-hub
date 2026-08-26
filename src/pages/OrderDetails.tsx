import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, MapPin, Calendar, Truck, Weight, Box, Navigation, Download, FileText, Printer, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";
import { supabase } from "@/integrations/supabase/client";
import { getAuthSession } from "@/lib/auth";
import { isCancellable } from "@/hooks/useCancelOrder";
import ParcelPhotoUpload from "@/components/booking/ParcelPhotoUpload";
import BalanceDueCard, { type BookingBalance } from "@/components/booking/BalanceDueCard";

interface OrderAddress {
  type: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ShipmentDocument {
  type: string;
  url: string;
}

interface Shipment {
  awbNumber: string;
  thirdPartyAwbNumber?: string;
  shipmentStatus: string;
  dimensions?: {
    width: number;
    height: number;
    length: number;
  };
  physicalWeight?: number;
  volumetricWeight?: number;
  items?: Array<{
    name: string;
    description: string;
  }>;
  documents?: ShipmentDocument[];
}

interface PaymentBreakdown {
  otherCharges?: Array<{
    name: string;
    chargedAmount: number;
  }>;
}

interface Payment {
  finalAmount: number;
  type: string;
  breakdown?: PaymentBreakdown;
}

interface OrderDetails {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  deliveryPromise: string;
  carrierName?: string;
  carrierId?: string;
  addresses?: OrderAddress[];
  shipments?: Shipment[];
  payment?: Payment;
  metadata?: {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    source?: string;
    baseFare?: number;
    gstAmount?: number;
    totalAmount?: number;
    platformFee?: number;
  };
}

const OrderDetails = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [downloadingLabel, setDownloadingLabel] = useState(false);
  const [refundInfo, setRefundInfo] = useState<{
    status: string | null;
    payment_status: string | null;
    payment_id: string | null;
  } | null>(null);
  const [bookingMeta, setBookingMeta] = useState<{
    id: string;
    booking_source: string;
    status: string;
    awb?: string | null;
  } | null>(null);
  const [balance, setBalance] = useState<BookingBalance | null>(null);

  const fetchBalance = async (bookingId: string) => {
    try {
      const auth = getAuthSession();
      if (!auth) return;
      const { data } = await supabase.functions.invoke('booking-balance', {
        body: { action: 'list' },
        headers: { 'x-prayog-auth': JSON.stringify(auth) },
      });
      const list: BookingBalance[] = (data as any)?.balances || [];
      const forThis = list.filter((b) => b.booking_id === bookingId);
      setBalance(forThis.find((b) => b.status === 'pending') || forThis[0] || null);
    } catch (e) {
      console.error('Failed to load balance', e);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);



  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      const auth = getAuthSession();
      if (!auth) {
        toast({ title: "Authentication required", description: "Please sign in", variant: "destructive" });
        navigate('/login');
        return;
      }

      // Try as a local booking UUID first; the edge function falls back to order_id lookup.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId || '');
      const { data, error } = await supabase.functions.invoke('get-booking-detail', {
        body: isUuid ? { booking_id: orderId } : { order_id: orderId },
        headers: { 'x-prayog-auth': JSON.stringify(auth) },
      });

      if (error || !data?.order) {
        toast({
          title: "Order not found",
          description: "We couldn't find this order. It may belong to a different account.",
          variant: "destructive",
        });
        return;
      }

      const o = data.order;
      setOrder(o);
      const b = o._booking;
      if (b) {
        setBookingMeta({
          id: b.id,
          booking_source: b.booking_source || '',
          status: b.status || '',
          awb: b.awb || b.prayog_awb || b.tracking_id || null,
        });
        fetchBalance(b.id);

        if (
          b.payment_status === 'refunded' ||
          b.payment_status === 'refund_failed' ||
          b.payment_status === 'cop_pending' ||
          b.status === 'FAILED'
        ) {
          setRefundInfo({
            status: b.status,
            payment_status: b.payment_status,
            payment_id: o.metadata?.razorpay_payment_id || null,
          });
        }
      }
    } catch (error: any) {
      console.error("Error fetching order details:", error);
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    
    setDownloadingInvoice(true);
    
    const pickupAddr = order.addresses?.find(a => a.type === 'PICKUP');
    const deliveryAddr = order.addresses?.find(a => a.type === 'DELIVERY');
    const shipmentData = order.shipments?.[0];
    
    const invoiceHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${order.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #f5f5f5; }
          .invoice-container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
          .logo { font-size: 28px; font-weight: bold; color: #3b82f6; }
          .invoice-title { text-align: right; }
          .invoice-title h1 { font-size: 32px; color: #333; margin-bottom: 8px; }
          .invoice-title p { color: #666; font-size: 14px; }
          .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
          .info-box h3 { font-size: 14px; color: #3b82f6; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-box p { color: #333; font-size: 14px; line-height: 1.6; }
          .info-box .name { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
          .order-details { margin-bottom: 30px; }
          .order-details h3 { font-size: 18px; color: #333; margin-bottom: 15px; }
          .details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
          .detail-item { background: #f8fafc; padding: 15px; border-radius: 8px; }
          .detail-item label { font-size: 12px; color: #666; display: block; margin-bottom: 4px; }
          .detail-item span { font-size: 14px; font-weight: 600; color: #333; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          .items-table th { background: #3b82f6; color: white; padding: 12px; text-align: left; font-size: 14px; }
          .items-table td { padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; }
          .items-table tr:last-child td { border-bottom: none; }
          .payment-section { background: #f8fafc; padding: 25px; border-radius: 8px; }
          .payment-section h3 { font-size: 18px; color: #333; margin-bottom: 20px; }
          .payment-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
          .payment-row.total { border-top: 2px solid #3b82f6; margin-top: 15px; padding-top: 15px; font-size: 18px; font-weight: bold; color: #3b82f6; }
          .status-badge { display: inline-block; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
          .status-processing { background: #fef3c7; color: #d97706; }
          .status-delivered { background: #d1fae5; color: #059669; }
          .status-failed { background: #fee2e2; color: #dc2626; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
          @media print { body { padding: 0; background: white; } .invoice-container { box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="logo">📦 ViaSetu.</div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <p>Order ID: ${order.orderId}</p>
              <p>Date: ${new Date(order.orderDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>

          <div class="info-section">
            <div class="info-box">
              <h3>Pickup Address</h3>
              ${pickupAddr ? `
                <p class="name">${pickupAddr.name}</p>
                <p>${pickupAddr.phone}</p>
                <p>${pickupAddr.street}</p>
                <p>${pickupAddr.city}, ${pickupAddr.state} - ${pickupAddr.zip}</p>
                <p>${pickupAddr.country}</p>
              ` : '<p>Not available</p>'}
            </div>
            <div class="info-box">
              <h3>Delivery Address</h3>
              ${deliveryAddr ? `
                <p class="name">${deliveryAddr.name}</p>
                <p>${deliveryAddr.phone}</p>
                <p>${deliveryAddr.street}</p>
                <p>${deliveryAddr.city}, ${deliveryAddr.state} - ${deliveryAddr.zip}</p>
                <p>${deliveryAddr.country}</p>
              ` : '<p>Not available</p>'}
            </div>
          </div>

          <div class="order-details">
            <h3>Order Details</h3>
            <div class="details-grid">
              <div class="detail-item">
                <label>AWB Number</label>
                <span>${shipmentData?.awbNumber || 'N/A'}</span>
              </div>
              ${order.carrierName ? `
              <div class="detail-item">
                <label>Carrier</label>
                <span>${order.carrierName}</span>
              </div>
              ` : ''}
              <div class="detail-item">
                <label>Delivery Type</label>
                <span>${order.deliveryPromise || 'Standard'}</span>
              </div>
              <div class="detail-item">
                <label>Payment Type</label>
                <span>${order.payment?.type || 'N/A'}</span>
              </div>
              ${order.metadata?.razorpay_payment_id ? `
              <div class="detail-item">
                <label>Payment ID</label>
                <span>${order.metadata.razorpay_payment_id}</span>
              </div>
              ` : ''}
            </div>
            ${order.metadata?.razorpay_order_id ? `
            <div class="details-grid" style="margin-top: 15px;">
              <div class="detail-item">
                <label>Razorpay Order ID</label>
                <span>${order.metadata.razorpay_order_id}</span>
              </div>
            </div>
            ` : ''}
          </div>

          ${shipmentData ? `
            <div class="order-details">
              <h3>Shipment Information</h3>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Dimensions (L×W×H)</th>
                    <th>Physical Weight</th>
                    <th>Volumetric Weight</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${shipmentData.items?.[0]?.name || 'Package'} ${shipmentData.items?.[0]?.description ? `- ${shipmentData.items[0].description}` : ''}</td>
                    <td>${shipmentData.dimensions ? `${shipmentData.dimensions.length} × ${shipmentData.dimensions.width} × ${shipmentData.dimensions.height} cm` : 'N/A'}</td>
                    <td>${shipmentData.physicalWeight !== undefined ? `${shipmentData.physicalWeight} kg` : 'N/A'}</td>
                    <td>${shipmentData.volumetricWeight !== undefined ? `${shipmentData.volumetricWeight.toFixed(2)} kg` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="payment-section">
            <h3>Payment Summary</h3>
            ${order.payment?.breakdown?.otherCharges?.map(charge => `
              <div class="payment-row">
                <span>${charge.name}</span>
                <span>₹${Math.round(charge.chargedAmount)}</span>
              </div>
            `).join('') || `
              <div class="payment-row">
                <span>Base Fare</span>
                <span>₹${Math.round(order.metadata?.baseFare || order.payment?.finalAmount || 0)}</span>
              </div>
              ${order.metadata?.gstAmount ? `
                <div class="payment-row">
                  <span>GST (18%)</span>
                  <span>₹${Math.round(order.metadata.gstAmount)}</span>
                </div>
              ` : ''}
            `}
            <div class="payment-row total">
              <span>Total Amount</span>
              <span>₹${Math.round(order.payment?.finalAmount || 0)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing ViaSetu.!</p>
            <p>For support, contact us at support@viasetu.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(invoiceHtml);
      newWindow.document.close();
    }
    
    setDownloadingInvoice(false);
    toast({
      title: "Success",
      description: "Invoice opened in new tab",
    });
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'delivered':
        return 'bg-green-500';
      case 'in_transit':
      case 'intransit':
      case 'shipped':
        return 'bg-blue-500';
      case 'pending':
      case 'booked':
      case 'processing':
        return 'bg-yellow-500';
      case 'cancelled':
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Order not found</h2>
          <Button onClick={() => navigate('/history')}>
            Go to Order History
          </Button>
        </Card>
      </div>
    );
  }

  const pickupAddress = order.addresses?.find(a => a.type === 'PICKUP');
  const deliveryAddress = order.addresses?.find(a => a.type === 'DELIVERY');
  const shipment = order.shipments?.[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background/95 backdrop-blur-sm border-b border-border p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Order Details</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/tracking', { 
              state: { 
                awbNumber: shipment?.awbNumber,
                orderId: order.orderId 
              } 
            })}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Track
          </Button>
        </div>
      </header>

      <div className="p-4 max-w-4xl mx-auto space-y-4">
        {/* Order Summary */}
        <Card className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-semibold text-lg">{shipment?.thirdPartyAwbNumber || shipment?.awbNumber || order.orderId}</h2>
              <p className="text-sm text-muted-foreground">Order ID: {order.orderId}</p>
              {shipment?.thirdPartyAwbNumber && (
                <p className="text-sm text-muted-foreground">AWB: {shipment.awbNumber}</p>
              )}
            </div>
            <Badge className={getStatusColor(order.orderStatus)}>
              {order.orderStatus || 'Unknown'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(order.orderDate)}
            </span>
            {order.carrierName && (
              <span className="flex items-center gap-1">
                <Truck className="h-4 w-4" />
                {order.carrierName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {order.deliveryPromise || 'Standard'}
            </span>
          </div>

          {balance && (
            <BalanceDueCard
              balance={balance}
              onPaid={() => { fetchOrderDetails(); if (bookingMeta?.id) fetchBalance(bookingMeta.id); }}
            />
          )}



          {/* Cancellation notice — customers must email support */}
          {bookingMeta && isCancellable(order.orderStatus || bookingMeta.status) && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">
                <strong>Need to cancel this order?</strong> Orders cannot be cancelled from the
                app once placed. Please email{' '}
                <a href="mailto:support@viasetu.com" className="font-semibold underline">
                  support@viasetu.com
                </a>{' '}
                with your order ID and we'll get back to you within a few hours.
              </p>
            </div>
          )}

        </Card>

        {/* Refund Status Indicator */}
        {refundInfo && (
          <Card className={`p-4 border-l-4 ${
            refundInfo.payment_status === 'refunded'
              ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
              : refundInfo.payment_status === 'refund_failed'
                ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
                : refundInfo.payment_status === 'cop_pending'
                  ? 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                  : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
          }`}>
            <div className="flex items-start gap-3">
              {refundInfo.payment_status === 'refunded' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              ) : refundInfo.payment_status === 'refund_failed' ? (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  {refundInfo.payment_status === 'refunded' && 'Payment Refunded'}
                  {refundInfo.payment_status === 'refund_failed' && 'Refund Failed'}
                  {refundInfo.payment_status === 'cop_pending' && 'Cash on Pickup — Pending'}
                  {refundInfo.payment_status !== 'refunded' && refundInfo.payment_status !== 'refund_failed' && refundInfo.payment_status !== 'cop_pending' && 'Order Failed'}
                  <Badge variant="outline" className={`text-xs ${
                    refundInfo.payment_status === 'refunded'
                      ? 'border-green-500 text-green-700'
                      : refundInfo.payment_status === 'refund_failed'
                        ? 'border-red-500 text-red-700'
                        : 'border-yellow-500 text-yellow-700'
                  }`}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {refundInfo.payment_status === 'refunded'
                      ? 'Refunded'
                      : refundInfo.payment_status === 'refund_failed'
                        ? 'Action Required'
                        : refundInfo.payment_status === 'cop_pending'
                          ? 'COP Pending'
                          : refundInfo.status}
                  </Badge>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {refundInfo.payment_status === 'refunded' && 'Your payment has been automatically refunded. It may take 5-7 business days to reflect in your account.'}
                  {refundInfo.payment_status === 'refund_failed' && 'The automatic refund could not be processed. Please contact support with your Payment ID for assistance.'}
                  {refundInfo.payment_status === 'cop_pending' && 'Please pay the total amount in cash to the courier executive at the time of pickup. Keep the exact amount ready.'}
                  {refundInfo.payment_status !== 'refunded' && refundInfo.payment_status !== 'refund_failed' && refundInfo.payment_status !== 'cop_pending' && 'This order could not be completed.'}
                </p>
                {refundInfo.payment_id && (
                  <p className="text-xs text-muted-foreground mt-2 font-mono">
                    Payment ID: {refundInfo.payment_id}
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Addresses */}
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Addresses</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Pickup Address</span>
              </div>
              {pickupAddress ? (
                <div className="text-sm">
                  <p className="font-medium">{pickupAddress.name}</p>
                  <p className="text-muted-foreground">{pickupAddress.phone}</p>
                  <p className="text-muted-foreground">
                    {pickupAddress.street}, {pickupAddress.city}
                  </p>
                  <p className="text-muted-foreground">
                    {pickupAddress.state} - {pickupAddress.zip}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not available</p>
              )}
            </div>

            <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Delivery Address</span>
              </div>
              {deliveryAddress ? (
                <div className="text-sm">
                  <p className="font-medium">{deliveryAddress.name}</p>
                  <p className="text-muted-foreground">{deliveryAddress.phone}</p>
                  <p className="text-muted-foreground">
                    {deliveryAddress.street}, {deliveryAddress.city}
                  </p>
                  <p className="text-muted-foreground">
                    {deliveryAddress.state} - {deliveryAddress.zip}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Not available</p>
              )}
            </div>
          </div>
        </Card>

        {/* Shipment Details */}
        {shipment && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Shipment Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {shipment.dimensions && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Box className="h-4 w-4" />
                    <span className="text-xs">Dimensions</span>
                  </div>
                  <p className="text-sm font-medium">
                    {shipment.dimensions.length} x {shipment.dimensions.width} x {shipment.dimensions.height} cm
                  </p>
                </div>
              )}
              {shipment.physicalWeight !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Weight className="h-4 w-4" />
                    <span className="text-xs">Weight</span>
                  </div>
                  <p className="text-sm font-medium">{shipment.physicalWeight} kg</p>
                </div>
              )}
              {shipment.volumetricWeight !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Weight className="h-4 w-4" />
                    <span className="text-xs">Volumetric</span>
                  </div>
                  <p className="text-sm font-medium">{shipment.volumetricWeight.toFixed(2)} kg</p>
                </div>
              )}
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span className="text-xs">Status</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {shipment.shipmentStatus}
                </Badge>
              </div>
            </div>

            {shipment.items && shipment.items.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Items</p>
                {shipment.items.map((item, index) => (
                  <div key={index} className="text-sm text-muted-foreground">
                    <span className="font-medium">{item.name}</span>
                    {item.description && <span> - {item.description}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Payment Details */}
        {order.payment && (
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Payment Details</h3>
            <div className="space-y-3">
              {/* Payment breakdown */}
              {order.payment.breakdown?.otherCharges?.map((charge, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{charge.name}</span>
                  <span>₹{Math.round(charge.chargedAmount)}</span>
                </div>
              ))}
              
              {/* Fallback for orders without breakdown - use metadata */}
              {(!order.payment.breakdown?.otherCharges || order.payment.breakdown.otherCharges.length === 0) && order.metadata?.baseFare && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Base Fare</span>
                    <span>₹{Math.round(order.metadata.baseFare)}</span>
                  </div>
                  {order.metadata.gstAmount && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">GST (18%)</span>
                      <span>₹{Math.round(order.metadata.gstAmount)}</span>
                    </div>
                  )}
                </>
              )}
              
              <div className="border-t pt-3 flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Type</p>
                  <p className="font-medium">{order.payment.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-xl font-bold text-primary">₹{Math.round(order.payment.finalAmount || 0)}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Label Printing Instructions + Parcel Photo Upload */}
        <Card className="p-4 space-y-4">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-warning" />
              <h4 className="font-semibold text-sm">Important: Label Printing Instructions</h4>
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
              <li>
                <span className="font-medium text-foreground">Upload</span> photos of your packed parcel below (required before pickup)
              </li>
            </ol>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-primary/10 p-3">
            <Package className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> The courier will only pick up your shipment if the shipping label is clearly visible and attached to the package.
            </p>
          </div>

          {bookingMeta?.id && (
            <div className="pt-2 border-t">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Parcel Photos
              </h4>
              <ParcelPhotoUpload bookingId={bookingMeta.id} />
            </div>
          )}
        </Card>

        {/* Download Actions */}
        <div className="flex flex-col gap-3">
          {/* Download Label */}
          {(() => {
            const labelDoc = shipment?.documents?.find(doc => doc.type === 'label');
            const canFetchFresh = bookingMeta?.booking_source === 'delhivery_direct'
              || bookingMeta?.booking_source === 'urbanebolt_direct'
              || bookingMeta?.booking_source === 'xpressbees_direct'
              || bookingMeta?.booking_source === 'shadowfax_direct'
              || bookingMeta?.booking_source === 'shree_maruti_direct';
            if (!labelDoc?.url && !canFetchFresh) return null;

            const handleLabel = async () => {
              if (!canFetchFresh && labelDoc?.url) {
                window.open(labelDoc.url, '_blank');
                return;
              }

              setDownloadingLabel(true);
              try {
                const auth = getAuthSession();
                const { data, error } = await supabase.functions.invoke('get-booking-label', {
                  body: { booking_id: bookingMeta?.id },
                  headers: { 'x-prayog-auth': JSON.stringify(auth), 'x-environment': CURRENT_ENV },
                });
                if (error) throw error;
                if (data?.success && data?.label_url) {
                  window.open(data.label_url, '_blank');
                  fetchOrderDetails();
                } else {
                  toast({
                    title: 'Label Unavailable',
                    description: data?.error || 'Could not retrieve label.',
                    variant: 'destructive',
                  });
                }
              } catch (e: any) {
                toast({ title: 'Error', description: e.message || 'Failed', variant: 'destructive' });
              } finally {
                setDownloadingLabel(false);
              }
            };

            return (
              <Button variant="default" className="w-full" onClick={handleLabel} disabled={downloadingLabel}>
                <FileText className="h-4 w-4 mr-2" />
                {downloadingLabel ? 'Fetching label...' : 'Download Shipping Label'}
              </Button>
            );
          })()}

          {/* Download Invoice */}
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
          >
            <Download className="h-4 w-4 mr-2" />
            {downloadingInvoice ? "Downloading..." : "Download Invoice"}
          </Button>
        </div>
      </div>

    </div>
  );
};

export default OrderDetails;
