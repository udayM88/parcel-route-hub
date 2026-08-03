import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_ENV } from "@/config/environment";
import { getPartnerLogo } from "@/config/partnerLogos";
import { supabase } from "@/integrations/supabase/client";
import { normalizeTatDays, formatTatRange } from "@/lib/tat-utils";
import { usePlatformFee } from "@/hooks/usePlatformFee";
import { computeBaseFare, computeChargeableKg, extractGst, computeRetailPrice, computeSavingsPct } from "@/lib/pricing";
import PaymentModal from "@/components/PaymentModal";
import BookingProgress from "@/components/booking/BookingProgress";
import BookingStep1 from "@/components/booking/BookingStep1";
import BookingStep2 from "@/components/booking/BookingStep2";
import AddressStep from "@/components/booking/AddressStep";
import BookingStep5 from "@/components/booking/BookingStep5";
import PageBackground from "@/components/PageBackground";
import PageSeo from "@/components/PageSeo";
import DisclaimerStep from "@/components/booking/DisclaimerStep";
import BookingReviewStep from "@/components/booking/BookingReviewStep";
import BookingConfirmationDialog from "@/components/booking/BookingConfirmationDialog";
import BottomNav from "@/components/BottomNav";
import { extractInvokeError } from "@/lib/invoke-error";
import { trackStep, markCompleted } from "@/lib/booking-progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Copy, CheckCircle2, UserCog } from "lucide-react";
const Booking = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [urgency, setUrgency] = useState("");
  const [packageWeight, setPackageWeight] = useState("");
  const [customWeight, setCustomWeight] = useState("");
  const [packageDescription, setPackageDescription] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pickupPincode, setPickupPincode] = useState("");
  const [deliveryPincode, setDeliveryPincode] = useState("");
  const [goodsType, setGoodsType] = useState("");
  const [dimensions, setDimensions] = useState({
    length: "",
    width: "",
    height: ""
  });
  const [shipmentValue, setShipmentValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedPartnerData, setSelectedPartnerData] = useState<{
    partnerId: string;
    serviceCode: string;
    rateId: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [calculatedPricing, setCalculatedPricing] = useState<any>(null);
  const [serviceabilityData, setServiceabilityData] = useState<any>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    awbNumber: string;
    labelUrl: string | null;
    courierName: string;
    trackingId: string;
    bookingId: string | null;
  } | null>(null);
  const [senderData, setSenderData] = useState({
    name: "",
    phone: "",
    flatNo: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });
  const [receiverData, setReceiverData] = useState({
    name: "",
    phone: "",
    flatNo: "",
    address: "",
    city: "",
    state: "",
    pincode: ""
  });
  // Admin-assisted booking context (set by /admin/assisted-booking flow).
  const [assistedContext, setAssistedContext] = useState<{ userId: string; name: string; phone: string } | null>(null);
  const [paymentLinkInfo, setPaymentLinkInfo] = useState<{ url: string; bookingId: string } | null>(null);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    toast
  } = useToast();

  // Dynamic platform fee based on distance
  const {
    platformFee,
    feeData: platformFeeData,
    isLoading: platformFeeLoading
  } = usePlatformFee({
    sourcePincode: pickupPincode,
    destinationPincode: deliveryPincode,
    weightKg: parseFloat(packageWeight) || 1,
    shipmentValue: parseFloat(shipmentValue) || 0,
    enabled: pickupPincode.length === 6 && deliveryPincode.length === 6
  });
  const totalSteps = 6;
  useEffect(() => {
    // Admin-assisted mode: navigation state overrides the logged-in user.
    // The admin's own auth session stays in localStorage untouched; we only
    // use the customer's user_id for booking persistence + progress tracking.
    const assisted = (location.state as any)?.assistedContext;
    if (assisted?.userId) {
      setAssistedContext({ userId: assisted.userId, name: assisted.name || "", phone: assisted.phone || "" });
      setUserId(assisted.userId);
      setSenderData(prev => ({
        ...prev,
        name: prev.name || assisted.name || "",
        phone: prev.phone || assisted.phone || "",
      }));
      // Don't restore the admin's own booking draft on top of a customer flow.
      return;
    }

    // Use unified auth session (with legacy prayog_auth fallback).
    const authRaw = localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth');
    if (authRaw) {
      try {
        const authData = JSON.parse(authRaw);
        if (authData.user_id) {
          setUserId(authData.user_id);
        }
      } catch {}
    } else {
      let guestId = localStorage.getItem("guest_user_id");
      if (!guestId) {
        guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem("guest_user_id", guestId);
      }
      setUserId(guestId);
    }

    // Check for clone data from History page
    const cloneData = (location.state as any)?.cloneData;
    if (cloneData) {
      setSenderData(cloneData.senderData || senderData);
      setReceiverData(cloneData.receiverData || receiverData);
      setPickupPincode(cloneData.pickupPincode || '');
      setDeliveryPincode(cloneData.deliveryPincode || '');
      setGoodsType(cloneData.goodsType || '');
      setPackageWeight(cloneData.packageWeight || '');
      setDimensions(cloneData.dimensions || { length: '', width: '', height: '' });
      setShipmentValue(cloneData.shipmentValue || '');
      setCurrentStep(2);
      return;
    }

    // Check for draft in localStorage
    try {
      const draft = localStorage.getItem('booking_draft');
      if (draft) {
        const d = JSON.parse(draft);
        if (d.currentStep) setCurrentStep(d.currentStep);
        if (d.senderData) setSenderData(d.senderData);
        if (d.receiverData) setReceiverData(d.receiverData);
        if (d.pickupPincode) setPickupPincode(d.pickupPincode);
        if (d.deliveryPincode) setDeliveryPincode(d.deliveryPincode);
        if (d.goodsType) setGoodsType(d.goodsType);
        if (d.packageWeight) setPackageWeight(d.packageWeight);
        if (d.dimensions) setDimensions(d.dimensions);
        if (d.shipmentValue) setShipmentValue(d.shipmentValue);
        if (d.urgency) setUrgency(d.urgency);
      }
    } catch {}
  }, []);

  // Save draft on state changes (skip in admin-assisted mode to avoid
  // clobbering the admin's own draft with a customer's booking).
  useEffect(() => {
    if (assistedContext) return;
    if (currentStep > 1) {
      const draft = {
        currentStep, senderData, receiverData, pickupPincode, deliveryPincode,
        goodsType, packageWeight, dimensions, shipmentValue, urgency,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('booking_draft', JSON.stringify(draft));
    }
  }, [assistedContext, currentStep, senderData, receiverData, pickupPincode, deliveryPincode, goodsType, packageWeight, dimensions, shipmentValue, urgency]);

  // Track furthest step reached for admin abandonment analytics
  useEffect(() => {
    if (userId) trackStep(userId, currentStep);
  }, [userId, currentStep]);

  // Auto-populate pincodes from serviceability check - always sync from step 2 values
  useEffect(() => {
    if (pickupPincode) {
      setSenderData(prev => ({
        ...prev,
        pincode: pickupPincode
      }));
    }
    if (deliveryPincode) {
      setReceiverData(prev => ({
        ...prev,
        pincode: deliveryPincode
      }));
    }
  }, [pickupPincode, deliveryPincode]);
  const handleLocationData = (pickupCity: string, pickupState: string, deliveryCity: string, deliveryState: string) => {
    if (pickupCity && pickupState) {
      setSenderData(prev => ({
        ...prev,
        city: pickupCity,
        state: pickupState
      }));
    }
    if (deliveryCity && deliveryState) {
      setReceiverData(prev => ({
        ...prev,
        city: deliveryCity,
        state: deliveryState
      }));
    }
  };

  // Calculate convenience fee based on weight and urgency
  const calculateConvenienceFee = () => {
    if (!packageWeight || !urgency) return 0;
    const baseSuperUrgent = 50;
    const baseUrgent = 25;
    const baseNoRush = 10;
    const weightMultipliers = {
      light: 1,
      medium: 1.5,
      heavy: 2
    };
    let base = baseNoRush;
    if (urgency === "super-urgent") base = baseSuperUrgent;else if (urgency === "urgent") base = baseUrgent;
    const multiplier = weightMultipliers[packageWeight as keyof typeof weightMultipliers] || 1;
    return Math.round(base * multiplier);
  };
  const getCouriers = () => {
    // If we have real serviceability data, use it
    if (serviceabilityData?.partners) {
      const couriers: any[] = [];
      let courierId = 1;
      serviceabilityData.partners.forEach((partner: any) => {
        // Check if partner is serviceable
        if (partner.is_serviceable && partner.services) {
          partner.services.forEach((service: any) => {
            // Extract price from rate object and add dynamic platform fee
            const apiPrice = Math.round(service.rate?.price?.amount || 0);
            // Deterministic pricing: 50% markup + ₹50 flat zone fee per courier card price.
            const basePrice = computeBaseFare(apiPrice);
            const totalPrice = basePrice;
            const convenienceFee = 0;

            // Format partner name properly
            const partnerName = partner.partner_code.split("_").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
            const serviceName = service.service_name.split("_").map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
            couriers.push({
              id: courierId++,
              name: `${partnerName} - ${serviceName}`,
              rating: partner.rating || 4.0,
              deliveryTime: formatTatRange(service.tat_days, service.service_name),
              basePrice,
              convenienceFee,
              vehicleType: service.delivery_modes?.express ? "Express" : "Standard",
              image: getPartnerLogo(partner.partner_code, partnerName),
              features: [service.delivery_modes?.express ? "Express delivery" : "Standard delivery", service.is_cod ? "COD available" : "Prepaid only", service.insurance ? "Insurance available" : "Basic coverage", `Price: ₹${totalPrice}`],
              prayogData: {
                partnerId: partner.partner_id,
                partnerCode: partner.partner_code,
                serviceCode: service.service_code,
                serviceName: service.service_name,
                rateId: service.rate?.rate_id
              }
            });
          });
        }
      });
      return couriers.length > 0 ? couriers : getMockCouriers();
    }

    // Fallback to mock data if no real data available
    return getMockCouriers();
  };
  const getMockCouriers = () => {
    let basePrice = 100;
    let urgencyMultiplier = 1;
    let deliveryTime = "1-2 days";
    if (urgency === "super-urgent") {
      urgencyMultiplier = 2;
      deliveryTime = "2-4 hours";
    } else if (urgency === "urgent") {
      urgencyMultiplier = 1.5;
      deliveryTime = "6-12 hours";
    } else if (urgency === "no-rush") {
      urgencyMultiplier = 0.8;
      deliveryTime = "2-5 days";
    }
    const weightMultiplier = packageWeight === "heavy" ? 1.5 : packageWeight === "medium" ? 1.2 : 1;
    const convenienceFee = calculateConvenienceFee();
    return [{
      id: 1,
      name: "BlueDart Express",
      rating: 4.6,
      deliveryTime,
      basePrice: Math.round(basePrice * urgencyMultiplier * weightMultiplier),
      convenienceFee,
      vehicleType: packageWeight === "heavy" ? "Van" : "Bike",
      image: getPartnerLogo("bluedart"),
      features: ["Real-time tracking", "Insurance included", "SMS updates"]
    }, {
      id: 2,
      name: "DTDC Courier",
      rating: 4.3,
      deliveryTime,
      basePrice: Math.round(basePrice * urgencyMultiplier * weightMultiplier * 0.9),
      convenienceFee,
      vehicleType: packageWeight === "heavy" ? "Van" : "Bike",
      image: getPartnerLogo("dtdc"),
      features: ["Affordable rates", "Wide network", "COD available"]
    }, {
      id: 3,
      name: "Delhivery Express",
      rating: 4.4,
      deliveryTime,
      basePrice: Math.round(basePrice * urgencyMultiplier * weightMultiplier * 0.95),
      convenienceFee,
      vehicleType: packageWeight === "heavy" ? "Van" : "Bike",
      image: getPartnerLogo("delhivery"),
      features: ["Fast delivery", "Live tracking", "Safe handling"]
    }, {
      id: 4,
      name: "SpeedPost",
      rating: 4.2,
      deliveryTime,
      basePrice: Math.round(basePrice * urgencyMultiplier * weightMultiplier * 0.8),
      convenienceFee,
      vehicleType: packageWeight === "heavy" ? "Van" : "Bike",
      image: getPartnerLogo("india_post"),
      features: ["Government backed", "Nationwide reach", "Budget friendly"]
    }, {
      id: 5,
      name: "Ecom Express",
      rating: 4.5,
      deliveryTime,
      basePrice: Math.round(basePrice * urgencyMultiplier * weightMultiplier * 1.1),
      convenienceFee,
      vehicleType: packageWeight === "heavy" ? "Van" : "Bike",
      image: getPartnerLogo("ecom_express"),
      features: ["E-commerce focus", "Quick pickup", "Flexible delivery"]
    }];
  };
  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case "pickupAddress":
        setPickupAddress(value);
        break;
      case "deliveryAddress":
        setDeliveryAddress(value);
        break;
      case "urgency":
        setUrgency(value);
        break;
      case "packageWeight":
        setPackageWeight(value);
        break;
      case "phoneNumber":
        setPhoneNumber(value);
        break;
      case "pickupPincode":
        setPickupPincode(value);
        break;
      case "deliveryPincode":
        setDeliveryPincode(value);
        break;
      case "goodsType":
        setGoodsType(value);
        if (value === 'documents') {
          setPackageWeight("0.25");
          setDimensions({ length: "", width: "", height: "" });
        } else if (value === 'box') {
          setPackageWeight("");
        }
        break;
      case "shipmentValue":
        setShipmentValue(value);
        break;
      case "packageDescription":
        setPackageDescription(value);
        break;
      case "customWeight":
        setCustomWeight(value);
        break;
    }
  };
  const handleDimensionChange = (dimension: string, value: string) => {
    setDimensions(prev => ({
      ...prev,
      [dimension]: value
    }));
  };
  const handleServiceSelect = (partnerId: string, serviceCode: string, rateId: string) => {
    const serviceId = `${partnerId}_${serviceCode}`;
    setSelectedServiceId(serviceId);
    setSelectedPartnerData({
      partnerId,
      serviceCode,
      rateId
    });
  };

  // Get partners from serviceability data
  const getPartners = () => {
    if (serviceabilityData?.partners) {
      return serviceabilityData.partners;
    }
    return [];
  };

  // Get selected service details for review step
  const getSelectedServiceDetails = () => {
    if (!selectedPartnerData || !serviceabilityData?.partners) return null;
    for (const partner of serviceabilityData.partners) {
      if (partner.partner_id === selectedPartnerData.partnerId) {
        const service = partner.services?.find((s: any) => s.service_code === selectedPartnerData.serviceCode);
        if (service) {
          const apiPrice = Math.round(service.rate?.price?.amount || 0);
          // Deterministic pricing: baseFare = round(card * 3) + 50.
          return {
            name: `${partner.partner_name} - ${service.service_name}`,
            basePrice: computeBaseFare(apiPrice),
            cardPrice: apiPrice,
            convenienceFee: calculateConvenienceFee(),
            deliveryTime: formatTatRange(service.tat_days, service.service_name),
            platformFeeBreakdown: platformFeeData,
            // Include fee breakdown for display
            partnerId: partner.partner_id,
            partnerCode: partner.partner_code,
            serviceCode: service.service_code,
            serviceName: service.service_name,
            rateId: service.rate?.rate_id
          };
        }
      }
    }
    return null;
  };
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
  };
  const handleNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Reset dependent data when navigating back to a step
  const resetDataFromStep = (stepNumber: number) => {
    // When going back to step 2 (pincodes/package details), reset all downstream data
    if (stepNumber <= 2) {
      setServiceabilityData(null);
      setCalculatedPricing(null);
      setSelectedServiceId(null);
      setSelectedPartnerData(null);
      setSelectedDate(undefined);
    }
    // When going back to step 3 (goods details), reset courier selection and beyond
    if (stepNumber <= 3) {
      // Serviceability might still be valid, but courier selection should be reconsidered
    }
    // When going back to step 4 (courier selection), reset date selection
    if (stepNumber <= 4) {
      setSelectedServiceId(null);
      setSelectedPartnerData(null);
      setSelectedDate(undefined);
    }
    // When going back to step 5 (date selection), reset date
    if (stepNumber <= 5) {
      setSelectedDate(undefined);
    }
  };
  const handlePrevStep = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      resetDataFromStep(prevStep);
      setCurrentStep(prevStep);
    }
  };

  // Handle going to a specific step (e.g., from pincode mismatch)
  const handleGoToStep = (stepNumber: number) => {
    resetDataFromStep(stepNumber);
    setCurrentStep(stepNumber);
  };
  const handleProceedToPayment = () => {
    if (assistedContext) {
      handleSendAdminPaymentLink();
      return;
    }
    setShowPaymentModal(true);
  };

  // Admin-assisted flow: create a Razorpay Payment Link and SMS it to the
  // customer instead of opening the Razorpay checkout in-session.
  const handleSendAdminPaymentLink = async () => {
    if (!assistedContext) return;
    const selectedCourierData = getSelectedServiceDetails();
    if (!selectedCourierData) {
      toast({ title: "Select a courier first", variant: "destructive" });
      return;
    }
    setSendingPaymentLink(true);
    try {
      const bookingDraft = {
        sender_name: senderData.name,
        sender_phone: senderData.phone,
        sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
        sender_city: senderData.city,
        sender_state: senderData.state,
        sender_pincode: senderData.pincode,
        receiver_name: receiverData.name,
        receiver_phone: receiverData.phone,
        receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
        receiver_city: receiverData.city,
        receiver_state: receiverData.state,
        receiver_pincode: receiverData.pincode,
        goods_type: goodsType || 'Package',
        package_weight: String(weightUnit === 'g' ? (parseFloat(packageWeight) || 1000) / 1000 : parseFloat(packageWeight) || 1),
        length: dimensions?.length || null,
        width: dimensions?.width || null,
        height: dimensions?.height || null,
        shipment_value: shipmentValue ? parseFloat(shipmentValue) : null,
        urgency: urgency || 'standard',
        courier_name: selectedCourierData.name,
        courier_price: totalAmount,
        delivery_time: selectedCourierData.deliveryTime,
        base_fare: baseFare,
        platform_fee: effectivePlatformFee,
        gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
        partner_id: selectedPartnerData?.partnerId || null,
        service_code: selectedPartnerData?.serviceCode || null,
      };
      const { data, error } = await supabase.functions.invoke('admin-create-payment-link', {
        body: {
          customer_user_id: assistedContext.userId,
          customer_name: assistedContext.name,
          customer_phone: assistedContext.phone,
          total_amount: totalAmount,
          description: `ViaSetu · ${selectedCourierData.name} · ${senderData.city || ''} → ${receiverData.city || ''}`,
          booking_draft: bookingDraft,
        },
        headers: { 'x-environment': CURRENT_ENV },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Failed to create payment link');
      }
      setPaymentLinkInfo({ url: data.payment_link_url, bookingId: data.booking_id });
      toast({
        title: "Payment link sent",
        description: `SMS sent to +91 ${assistedContext.phone}`,
      });
    } catch (e: any) {
      toast({ title: "Could not send payment link", description: e?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setSendingPaymentLink(false);
    }
  };
  // Cash-on-Pickup: skip Razorpay entirely. TEMPORARY — see memory note
  // payments/no-cash-on-delivery-policy. Booking is created as Prepaid with the
  // courier; we settle internally and mark payment_status='cop_pending'.
  const handleCashOnPickup = async () => {
    await handlePaymentSuccess('cop', undefined, true);
  };
  const handlePaymentSuccess = async (paymentMethod: string, paymentDetails?: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
  }, isCop: boolean = false) => {
    if (!userId) return;
    const selectedCourierData = getSelectedServiceDetails();
    try {
      // Find the selected service from serviceability data
      let selectedService = null;
      let isShadowfaxDirect = false;
      let isDelhiveryDirect = false;
      let isUrbaneboltDirect = false;
      let isXpressbeesDirect = false;
      let isShreeMarutiDirect = false;
      if (serviceabilityData?.partners && selectedPartnerData) {
        for (const partner of serviceabilityData.partners) {
          if (partner.partner_id === selectedPartnerData.partnerId) {
            if (partner.partner_id === 'shadowfax_direct') {
              isShadowfaxDirect = true;
            }
            if (partner.partner_id === 'delhivery_direct') {
              isDelhiveryDirect = true;
            }
            if (partner.partner_id === 'urbanebolt_direct') {
              isUrbaneboltDirect = true;
            }
            if (partner.partner_id === 'xpressbees_direct') {
              isXpressbeesDirect = true;
            }
            if (partner.partner_id === 'shree_maruti_direct') {
              isShreeMarutiDirect = true;
            }
            const service = partner.services?.find((s: any) => s.service_code === selectedPartnerData.serviceCode);
            if (service) {
              selectedService = {
                ...service,
                partner_id: partner.partner_id,
                partner_code: partner.partner_code
              };
              break;
            }
          }
        }
      }

      // Generate orderId
      const now = new Date();
      const timestamp = [now.getFullYear().toString().slice(-2), (now.getMonth() + 1).toString().padStart(2, "0"), now.getDate().toString().padStart(2, "0"), now.getHours().toString().padStart(2, "0"), now.getMinutes().toString().padStart(2, "0"), now.getSeconds().toString().padStart(2, "0")].join("");
      const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const randomPart = Array.from({
        length: 6
      }, () => charset[Math.floor(Math.random() * charset.length)]).join("");
      const orderId = timestamp + randomPart;

      // Calculate volumetric + chargeable weight. Chargeable weight is what
      // we send to the partner booking APIs and persist as `package_weight` so
      // pricing, manifest, and reconciliation all line up (partners bill on
      // max(dead, volumetric) — see src/lib/pricing.ts).
      const isDocuments = goodsType === 'documents';
      const length = parseFloat(dimensions?.length) || (isDocuments ? 30 : 10);
      const width = parseFloat(dimensions?.width) || (isDocuments ? 22 : 10);
      const height = parseFloat(dimensions?.height) || (isDocuments ? 2 : 10);
      const volumetricWeight = length * width * height / 5000;
      const deadWeightKg = weightUnit === 'g' ? (parseFloat(packageWeight) || 1000) / 1000 : parseFloat(packageWeight) || 1;
      const { chargeableKg } = computeChargeableKg(
        deadWeightKg,
        length,
        width,
        height,
        { isDocument: isDocuments },
      );
      // physicalWeight is the weight sent to partners + saved on the row.
      // Renamed semantically to chargeable, kept the variable name to limit churn.
      const physicalWeight = chargeableKg > 0 ? chargeableKg : deadWeightKg;
      const deadWeightG = Math.round(deadWeightKg * 1000);
      const volumetricWeightG = Math.round(volumetricWeight * 1000);
      const chargeableWeightG = Math.round(physicalWeight * 1000);
      const baseAmount = selectedService?.rate?.price?.amount || 0;

      // Prepare Prayog API payload
      const prayogPayload = {
        referenceId: orderId,
        orderDate: new Date().toISOString(),
        orderType: "FORWARD",
        orderStatus: "CREATED",
        parcelCategory: "ECOMM",
        vendorCode: "AWSA",
        autoManifest: true,
        carrierName: selectedService?.partner_code || "",
        carrierId: selectedService?.partner_id || "",
        eWaybills: [],
        deliveryPromise: selectedService?.service_name || "standard",
        metadata: {
          source: "WEB_APP",
          baseFare: baseFare,
          gstAmount: gstAmount,
          totalAmount: totalAmount,
          platformFee: effectivePlatformFee,
          ...(paymentDetails && {
            razorpay_payment_id: paymentDetails.razorpay_payment_id,
            razorpay_order_id: paymentDetails.razorpay_order_id
          })
        },
        documents: [],
        addresses: [
          {
            type: "PICKUP",
            zip: senderData.pincode,
            name: senderData.name,
            phone: senderData.phone,
            street: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            landmark: null,
            city: senderData.city,
            state: senderData.state,
            country: "India",
            latitude: 0,
            longitude: 0,
            addressName: [senderData.flatNo, senderData.address].filter(Boolean).join(', ')
          },
          {
            type: "DELIVERY",
            zip: receiverData.pincode,
            name: receiverData.name,
            phone: receiverData.phone,
            street: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            landmark: null,
            city: receiverData.city,
            state: receiverData.state,
            country: "India",
            latitude: 0,
            longitude: 0,
            addressName: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', ')
          },
          {
            type: "BILLING",
            zip: receiverData.pincode,
            name: receiverData.name,
            phone: receiverData.phone,
            street: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            landmark: null,
            city: receiverData.city,
            state: receiverData.state,
            country: "India",
            latitude: 0,
            longitude: 0,
            addressName: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', ')
          },
          {
            type: "RETURN",
            zip: senderData.pincode,
            name: senderData.name,
            phone: senderData.phone,
            street: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            landmark: null,
            city: senderData.city,
            state: senderData.state,
            country: "India",
            latitude: 0,
            longitude: 0,
            addressName: [senderData.flatNo, senderData.address].filter(Boolean).join(', ')
          }
        ],
        shipments: [{
          dimensions: {
            length: length,
            width: width,
            height: height
          },
          shipmentStatus: "CONFIRMED",
          awbNumber: "",
          physicalWeight: physicalWeight,
          volumetricWeight: volumetricWeight,
          note: packageDescription || "",
          items: [{
            name: goodsType || "Package",
            description: packageDescription || "Package"
          }]
        }],
        payment: {
          finalAmount: totalAmount,
          // Total amount paid by user (includes platform fee + GST)
          type: "PREPAID",
          // Add paymentMethod for Delhivery orders only
          ...(selectedService?.partner_code?.toLowerCase().includes('delhivery') && { paymentMethod: "Pickup" }),
          breakdown: {
            otherCharges: [{
              name: "Base Rate",
              chargedAmount: baseFare
            },
            // Base fare includes platform fee
            {
              name: "GST (18%)",
              chargedAmount: gstAmount
            }]
          }
        },
        vendorcode: "VIAS"
      };

      let trackingId = '';
      let awbNumber: string | null = null;
      let labelUrl: string | null = null;
      let prayogOrderId = orderId;

      if (isShadowfaxDirect) {
        // ─── Shadowfax Direct Booking ───
        console.log('[Booking] Using Shadowfax direct booking');
        const { data: sfxResult, error: sfxError } = await supabase.functions.invoke('shadowfax-booking', {
          body: {
            order_id: orderId,
            sender_name: senderData.name,
            sender_phone: senderData.phone,
            sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            sender_pincode: senderData.pincode,
            sender_city: senderData.city,
            sender_state: senderData.state,
            receiver_name: receiverData.name,
            receiver_phone: receiverData.phone,
            receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            receiver_pincode: receiverData.pincode,
            receiver_city: receiverData.city,
            receiver_state: receiverData.state,
            package_weight: physicalWeight,
            goods_type: goodsType || 'Package',
            shipment_value: shipmentValue ? parseFloat(shipmentValue) : 0,
            length: length,
            width: width,
            height: height,
          },
          headers: { 'x-environment': CURRENT_ENV },
        });

        if (sfxError || !sfxResult?.success) {
          // Auto-refund + audit row via centralized edge function.
          if (paymentDetails?.razorpay_payment_id) {
            const prayogAuthRawSfx = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
            const failedBookingRow = {
              sender_name: senderData.name, sender_phone: senderData.phone,
              sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
              sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
              receiver_name: receiverData.name, receiver_phone: receiverData.phone,
              receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
              receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
              goods_type: goodsType || "Package",
              package_weight: String(physicalWeight),
              urgency: urgency || "standard",
              courier_name: selectedService?.partner_code || selectedCourierData?.name || "Shadowfax",
              courier_price: totalAmount,
              delivery_time: selectedCourierData?.deliveryTime || "3-5 days",
              base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              booking_source: 'shadowfax_direct',
            };
            const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
              body: {
                payment_id: paymentDetails.razorpay_payment_id,
                reason: 'shadowfax_booking_failed',
                error_detail: await extractInvokeError(sfxResult, sfxError),
                booking_row: failedBookingRow,
              },
              headers: { ...(prayogAuthRawSfx ? { 'x-prayog-auth': prayogAuthRawSfx } : {}), 'x-environment': CURRENT_ENV },
            });
            localStorage.removeItem('booking_draft');
            if (refundData?.refunded) {
              throw new Error(`Booking could not be created. Your payment of ₹${totalAmount} has been refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`);
            }
            throw new Error(`Shadowfax booking failed and refund could not be processed. Payment ID: ${paymentDetails.razorpay_payment_id}. Please contact support.`);
          }
          throw new Error(`Shadowfax booking failed: ${sfxResult?.error || sfxError || 'Unknown error'}`);
        }

        trackingId = sfxResult.awbNumber || sfxResult.orderId || orderId;
        awbNumber = sfxResult.awbNumber || null;
        prayogOrderId = sfxResult.orderId || orderId;

      } else if (isDelhiveryDirect) {
        // ─── Delhivery Direct Booking (RVP) ───
        console.log('[Booking] Using Delhivery direct booking');
        const { data: dlvResult, error: dlvError } = await supabase.functions.invoke('delhivery-booking', {
          body: {
            order_id: orderId,
            sender_name: senderData.name,
            sender_phone: senderData.phone,
            sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            sender_pincode: senderData.pincode,
            sender_city: senderData.city,
            sender_state: senderData.state,
            receiver_name: receiverData.name,
            receiver_phone: receiverData.phone,
            receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            receiver_pincode: receiverData.pincode,
            receiver_city: receiverData.city,
            receiver_state: receiverData.state,
            package_weight: physicalWeight,
            goods_type: goodsType || 'Package',
            shipment_value: shipmentValue ? parseFloat(shipmentValue) : 0,
            length, width, height,
            service_code: selectedService?.service_code || 'delhivery_express',
          },
          headers: { 'x-environment': CURRENT_ENV },
        });

        if (dlvError || !dlvResult?.success) {
          if (paymentDetails?.razorpay_payment_id) {
            const prayogAuthRawDlv = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
            const failedBookingRow = {
              sender_name: senderData.name, sender_phone: senderData.phone,
              sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
              sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
              receiver_name: receiverData.name, receiver_phone: receiverData.phone,
              receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
              receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
              goods_type: goodsType || "Package",
              package_weight: String(physicalWeight),
              urgency: urgency || "standard",
              courier_name: selectedService?.partner_code || selectedCourierData?.name || "Delhivery",
              courier_price: totalAmount,
              delivery_time: selectedCourierData?.deliveryTime || "3-5 days",
              base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              booking_source: 'delhivery_direct',
            };
            const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
              body: {
                payment_id: paymentDetails.razorpay_payment_id,
                reason: 'delhivery_booking_failed',
                error_detail: await extractInvokeError(dlvResult, dlvError),
                booking_row: failedBookingRow,
              },
              headers: { ...(prayogAuthRawDlv ? { 'x-prayog-auth': prayogAuthRawDlv } : {}), 'x-environment': CURRENT_ENV },
            });
            localStorage.removeItem('booking_draft');
            if (refundData?.refunded) {
              throw new Error(`Booking could not be created. Your payment of ₹${totalAmount} has been refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`);
            }
            throw new Error(`Delhivery booking failed and refund could not be processed. Payment ID: ${paymentDetails.razorpay_payment_id}. Please contact support.`);
          }
          throw new Error(`Delhivery booking failed: ${dlvResult?.error || dlvError?.message || 'Unknown error'}`);
        }

        trackingId = dlvResult.awbNumber || dlvResult.orderId || orderId;
        awbNumber = dlvResult.awbNumber || null;
        prayogOrderId = dlvResult.orderId || orderId;
        labelUrl = dlvResult.label_url || null;

      } else if (isUrbaneboltDirect) {
        // ─── Urbanebolt Direct Booking ───
        console.log('[Booking] Using Urbanebolt direct booking');
        const { data: ubResult, error: ubError } = await supabase.functions.invoke('urbanebolt-booking', {
          body: {
            order_id: orderId,
            sender_name: senderData.name,
            sender_phone: senderData.phone,
            sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            sender_pincode: senderData.pincode,
            sender_city: senderData.city,
            sender_state: senderData.state,
            receiver_name: receiverData.name,
            receiver_phone: receiverData.phone,
            receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            receiver_pincode: receiverData.pincode,
            receiver_city: receiverData.city,
            receiver_state: receiverData.state,
            package_weight: physicalWeight,
            goods_type: goodsType || 'Package',
            shipment_value: shipmentValue ? parseFloat(shipmentValue) : 0,
            length, width, height,
            service_code: selectedService?.service_code || 'ub_intercity',
          },
          headers: { 'x-environment': CURRENT_ENV },
        });

        if (ubError || !ubResult?.success) {
          if (paymentDetails?.razorpay_payment_id) {
            const prayogAuthRawUb = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
            const failedBookingRow = {
              sender_name: senderData.name, sender_phone: senderData.phone,
              sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
              sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
              receiver_name: receiverData.name, receiver_phone: receiverData.phone,
              receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
              receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
              goods_type: goodsType || "Package",
              package_weight: String(physicalWeight),
              urgency: urgency || "standard",
              courier_name: selectedService?.partner_code || selectedCourierData?.name || "Urbanebolt",
              courier_price: totalAmount,
              delivery_time: selectedCourierData?.deliveryTime || "2-4 days",
              base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              booking_source: 'urbanebolt_direct',
            };
            const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
              body: {
                payment_id: paymentDetails.razorpay_payment_id,
                reason: 'urbanebolt_booking_failed',
                error_detail: await extractInvokeError(ubResult, ubError),
                booking_row: failedBookingRow,
              },
              headers: { ...(prayogAuthRawUb ? { 'x-prayog-auth': prayogAuthRawUb } : {}), 'x-environment': CURRENT_ENV },
            });
            localStorage.removeItem('booking_draft');
            if (refundData?.refunded) {
              throw new Error(`Booking could not be created. Your payment of ₹${totalAmount} has been refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`);
            }
            throw new Error(`Urbanebolt booking failed and refund could not be processed. Payment ID: ${paymentDetails.razorpay_payment_id}. Please contact support.`);
          }
          throw new Error(`Urbanebolt booking failed: ${ubResult?.error || ubError?.message || 'Unknown error'}`);
        }

        trackingId = ubResult.awbNumber || ubResult.orderId || orderId;
        awbNumber = ubResult.awbNumber || null;
        prayogOrderId = ubResult.orderId || orderId;
        labelUrl = ubResult.label_url || null;

      } else if (isXpressbeesDirect) {
        // ─── XpressBees Direct Booking ───
        console.log('[Booking] Using XpressBees direct booking');
        const { data: xbResult, error: xbError } = await supabase.functions.invoke('xpressbees-booking', {
          body: {
            order_id: orderId,
            sender_name: senderData.name,
            sender_phone: senderData.phone,
            sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            sender_pincode: senderData.pincode,
            sender_city: senderData.city,
            sender_state: senderData.state,
            receiver_name: receiverData.name,
            receiver_phone: receiverData.phone,
            receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            receiver_pincode: receiverData.pincode,
            receiver_city: receiverData.city,
            receiver_state: receiverData.state,
            package_weight: physicalWeight,
            goods_type: goodsType || 'Package',
            shipment_value: shipmentValue ? parseFloat(shipmentValue) : 0,
            length, width, height,
            service_code: selectedService?.service_code || 'xb_surface_z6',
          },
          headers: { 'x-environment': CURRENT_ENV },
        });

        if (xbError || !xbResult?.success) {
          if (paymentDetails?.razorpay_payment_id) {
            const prayogAuthRawXb = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
            const failedBookingRow = {
              sender_name: senderData.name, sender_phone: senderData.phone,
              sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
              sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
              receiver_name: receiverData.name, receiver_phone: receiverData.phone,
              receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
              receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
              goods_type: goodsType || "Package",
              package_weight: String(physicalWeight),
              urgency: urgency || "standard",
              courier_name: selectedService?.partner_code || selectedCourierData?.name || "XpressBees",
              courier_price: totalAmount,
              delivery_time: selectedCourierData?.deliveryTime || "2-4 days",
              base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              booking_source: 'xpressbees_direct',
            };
            const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
              body: {
                payment_id: paymentDetails.razorpay_payment_id,
                reason: 'xpressbees_booking_failed',
                error_detail: await extractInvokeError(xbResult, xbError),
                booking_row: failedBookingRow,
              },
              headers: { ...(prayogAuthRawXb ? { 'x-prayog-auth': prayogAuthRawXb } : {}), 'x-environment': CURRENT_ENV },
            });
            localStorage.removeItem('booking_draft');
            if (refundData?.refunded) {
              throw new Error(`Booking could not be created. Your payment of ₹${totalAmount} has been refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`);
            }
            throw new Error(`XpressBees booking failed and refund could not be processed. Payment ID: ${paymentDetails.razorpay_payment_id}. Please contact support.`);
          }
          throw new Error(`XpressBees booking failed: ${xbResult?.error || xbError?.message || 'Unknown error'}`);
        }

        trackingId = xbResult.awbNumber || xbResult.orderId || orderId;
        awbNumber = xbResult.awbNumber || null;
        prayogOrderId = xbResult.orderId || orderId;
        labelUrl = xbResult.label_url || null;

      } else if (isShreeMarutiDirect) {
        // ─── Shree Maruti Direct Booking ───
        console.log('[Booking] Using Shree Maruti direct booking');
        const { data: smResult, error: smError } = await supabase.functions.invoke('shree-maruti-booking', {
          body: {
            order_id: orderId,
            sender_name: senderData.name,
            sender_phone: senderData.phone,
            sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
            sender_pincode: senderData.pincode,
            sender_city: senderData.city,
            sender_state: senderData.state,
            receiver_name: receiverData.name,
            receiver_phone: receiverData.phone,
            receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
            receiver_pincode: receiverData.pincode,
            receiver_city: receiverData.city,
            receiver_state: receiverData.state,
            package_weight: physicalWeight,
            goods_type: goodsType || 'Package',
            shipment_value: shipmentValue ? parseFloat(shipmentValue) : 0,
            length, width, height,
            service_code: selectedService?.service_code || 'shree_maruti_surface',
          },
          headers: { 'x-environment': CURRENT_ENV },
        });

        if (smError || !smResult?.success) {
          if (paymentDetails?.razorpay_payment_id) {
            const prayogAuthRawSm = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
            const failedBookingRow = {
              sender_name: senderData.name, sender_phone: senderData.phone,
              sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
              sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
              receiver_name: receiverData.name, receiver_phone: receiverData.phone,
              receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
              receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
              goods_type: goodsType || "Package",
              package_weight: String(physicalWeight),
              urgency: urgency || "standard",
              courier_name: selectedService?.partner_code || selectedCourierData?.name || "Shree Maruti Courier",
              courier_price: totalAmount,
              delivery_time: selectedCourierData?.deliveryTime || "3-5 days",
              base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              booking_source: 'shree_maruti_direct',
            };
            const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
              body: {
                payment_id: paymentDetails.razorpay_payment_id,
                reason: 'shree_maruti_booking_failed',
                error_detail: await extractInvokeError(smResult, smError),
                booking_row: failedBookingRow,
              },
              headers: { ...(prayogAuthRawSm ? { 'x-prayog-auth': prayogAuthRawSm } : {}), 'x-environment': CURRENT_ENV },
            });
            localStorage.removeItem('booking_draft');
            if (refundData?.refunded) {
              throw new Error(`Booking could not be created. Your payment of ₹${totalAmount} has been refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`);
            }
            throw new Error(`Shree Maruti booking failed and refund could not be processed. Payment ID: ${paymentDetails.razorpay_payment_id}. Please contact support.`);
          }
          throw new Error(`Shree Maruti booking failed: ${smResult?.error || smError?.message || 'Unknown error'}`);
        }

        trackingId = smResult.awbNumber || smResult.orderId || orderId;
        awbNumber = smResult.awbNumber || null;
        prayogOrderId = smResult.orderId || orderId;
        labelUrl = smResult.label_url || null;

      } else {
        // Unsupported partner — Prayog and other aggregators have been removed.
        throw new Error(
          "This courier partner is no longer supported. Please pick a different partner."
        );
      }

      // Save booking to Supabase for admin dashboard and order history
      const bookingSource = isShadowfaxDirect
        ? 'shadowfax_direct'
        : isDelhiveryDirect
          ? 'delhivery_direct'
          : isUrbaneboltDirect
            ? 'urbanebolt_direct'
            : isXpressbeesDirect
              ? 'xpressbees_direct'
              : isShreeMarutiDirect
                ? 'shree_maruti_direct'
                : 'unknown';
      const bookingData = {
        user_id: userId,
        sender_name: senderData.name,
        sender_phone: senderData.phone,
        sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
        sender_city: senderData.city,
        sender_state: senderData.state,
        sender_pincode: senderData.pincode,
        receiver_name: receiverData.name,
        receiver_phone: receiverData.phone,
        receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
        receiver_city: receiverData.city,
        receiver_state: receiverData.state,
        receiver_pincode: receiverData.pincode,
        goods_type: goodsType || "Package",
        package_weight: String(physicalWeight),
        dead_weight_g: deadWeightG,
        volumetric_weight_g: volumetricWeightG,
        chargeable_weight_g: chargeableWeightG,
        length: dimensions?.length || null,
        width: dimensions?.width || null,
        height: dimensions?.height || null,
        shipment_value: shipmentValue ? parseFloat(shipmentValue) : null,
        urgency: urgency || "standard",
        packaging_required: false,
        insurance_required: false,
        courier_name: selectedService?.partner_code || selectedCourierData?.name || "",
        courier_price: totalAmount,
        delivery_time: selectedCourierData?.deliveryTime || "3-5 days",
        tracking_id: trackingId,
        prayog_order_id: prayogOrderId,
        prayog_awb: awbNumber,
        label_url: labelUrl,
        status: "CREATED",
        payment_id: paymentDetails?.razorpay_payment_id || null,
        payment_status: isCop ? "cop_pending" : "paid",
        base_fare: baseFare,
        platform_fee: effectivePlatformFee,
        gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
        prayog_commission: (isShadowfaxDirect || isDelhiveryDirect || isUrbaneboltDirect) ? 0 : Math.round(baseAmount * 0.05),
        booking_source: bookingSource,
      } as any;
      // Persist via edge function (RLS-safe; Prayog auth doesn't set auth.uid()).
      const prayogAuthRaw = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
      const { data: dbData, error: dbError } = await supabase.functions.invoke('save-booking', {
        body: bookingData,
        headers: prayogAuthRaw ? { 'x-prayog-auth': prayogAuthRaw } : {},
      });
      if (dbError) {
        console.error("Failed to save booking to database:", dbError);
        // Don't block the flow, just log the error
      }

      // Store confirmation data and show dialog
      setConfirmationData({
        awbNumber: awbNumber || trackingId,
        labelUrl: labelUrl,
        courierName: selectedCourierData?.name || selectedService?.partner_code || "",
        trackingId: trackingId,
        bookingId: dbData?.booking?.id || null,
      });
      // Clear draft on successful booking
      localStorage.removeItem('booking_draft');
      markCompleted(userId, dbData?.booking?.id || null);
      setShowPaymentModal(false);
      setShowConfirmationDialog(true);
    } catch (error: any) {
      console.error("Booking error:", error);
      // Outer safety-net: if a payment was captured but our flow threw before
      // a refund could be triggered (network blip, JS crash, unexpected partner
      // SDK shape), fire a last-resort server-side refund.
      const alreadyRefunded = /refund/i.test(error?.message || "");
      if (paymentDetails?.razorpay_payment_id && !alreadyRefunded) {
        try {
          const prayogAuthRawFallback = (localStorage.getItem('auth_session') || localStorage.getItem('prayog_auth'));
          const { data: refundData } = await supabase.functions.invoke('confirm-booking-or-refund', {
            body: {
              payment_id: paymentDetails.razorpay_payment_id,
              reason: 'unexpected_error',
              error_detail: await extractInvokeError(null, error),
              booking_row: {
                sender_name: senderData.name, sender_phone: senderData.phone,
                sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
                sender_city: senderData.city, sender_state: senderData.state, sender_pincode: senderData.pincode,
                receiver_name: receiverData.name, receiver_phone: receiverData.phone,
                receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
                receiver_city: receiverData.city, receiver_state: receiverData.state, receiver_pincode: receiverData.pincode,
                goods_type: goodsType || "Package",
                package_weight: String(weightUnit === 'g' ? (parseFloat(packageWeight) || 1000) / 1000 : parseFloat(packageWeight) || 1),
                urgency: urgency || "standard",
                courier_name: selectedCourierData?.name || "",
                courier_price: totalAmount,
                delivery_time: selectedCourierData?.deliveryTime || "3-5 days",
                base_fare: baseFare, platform_fee: effectivePlatformFee, gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
              },
            },
            headers: { ...(prayogAuthRawFallback ? { 'x-prayog-auth': prayogAuthRawFallback } : {}), 'x-environment': CURRENT_ENV },
          });
          if (refundData?.refunded) {
            toast({
              title: "Payment Refunded",
              description: `Booking failed. ₹${totalAmount} refunded automatically. Refund ID: ${refundData.refund_id || 'processing'}`,
              variant: "destructive",
            });
            return;
          }
          toast({
            title: "Booking Failed — Refund Pending",
            description: `Payment ID: ${paymentDetails.razorpay_payment_id}. Our team will process your refund shortly.`,
            variant: "destructive",
          });
          return;
        } catch (fallbackErr) {
          console.error('Outer safety-net refund threw:', fallbackErr);
        }
      }
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive"
      });
    }
  };
  const selectedCourierData = getSelectedServiceDetails();
  // All-inclusive pricing: displayed price already contains GST (70% margin
  // over the courier rate). We only split out the included GST for records.
  const totalAmount = Math.round(selectedCourierData ? selectedCourierData.basePrice : 0);
  const gstAmount = extractGst(totalAmount);
  const baseFare = totalAmount - gstAmount;
  // ViaSetu revenue on this shipment (total - courier rate).
  const effectivePlatformFee = selectedCourierData?.cardPrice != null
    ? Math.max(0, totalAmount - Math.round(selectedCourierData.cardPrice))
    : platformFee;
  const courierRateValue = selectedCourierData?.cardPrice != null ? Math.round(selectedCourierData.cardPrice) : null;
  const retailPriceValue = courierRateValue != null ? computeRetailPrice(courierRateValue) : null;
  const savingsPctValue = retailPriceValue ? computeSavingsPct(retailPriceValue, totalAmount) : 0;

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return <BookingStep1 onNext={handleNextStep} />;
      case 2:
        return <BookingStep2 pickupPincode={pickupPincode} deliveryPincode={deliveryPincode} pickupCity={senderData.city} deliveryCity={receiverData.city} goodsType={goodsType} packageWeight={packageWeight} dimensions={dimensions} shipmentValue={shipmentValue} urgency={urgency} onInputChange={handleInputChange} onDimensionChange={handleDimensionChange} onPricingCalculated={setCalculatedPricing} onServiceabilityData={setServiceabilityData} onLocationData={handleLocationData} onWeightUnitChange={setWeightUnit} onNext={handleNextStep} onBack={handlePrevStep} />;
      case 3:
        return <BookingStep5 partners={getPartners()} selectedServiceId={selectedServiceId} onServiceSelect={handleServiceSelect} onNext={handleNextStep} onBack={handlePrevStep} platformFee={platformFee} platformFeeData={platformFeeData} isAssisted={!!assistedContext} shipmentSummary={{
          pickupPincode,
          deliveryPincode,
          pickupCity: senderData.city || serviceabilityData?.partners?.find((p: any) => p.is_serviceable)?.metadata?.source_pincode_data?.city || "",
          deliveryCity: receiverData.city || serviceabilityData?.partners?.find((p: any) => p.is_serviceable)?.metadata?.dest_pincode_data?.city || "",
          weight: packageWeight,
          goodsType,
          dimensions,
          shipmentValue: Number(shipmentValue) || 0
        }} />;
      case 4:
        return <AddressStep senderData={senderData} receiverData={receiverData} pickupPincode={pickupPincode} deliveryPincode={deliveryPincode} shipmentValue={shipmentValue} packageDescription={packageDescription} onSenderChange={(field, value) => setSenderData(prev => ({
          ...prev,
          [field]: value
        }))} onReceiverChange={(field, value) => setReceiverData(prev => ({
          ...prev,
          [field]: value
        }))} onPackageChange={handleInputChange} onNext={handleNextStep} onBack={handlePrevStep} onGoToStep={handleGoToStep} />;
      case 5:
        return <DisclaimerStep onNext={handleNextStep} onBack={handlePrevStep} />;
      case 6:
        const baseFare = selectedCourierData?.basePrice || 0;
        return <BookingReviewStep senderData={senderData} receiverData={receiverData} packageDetails={{
          goodsType,
          weight: packageWeight,
          dimensions,
          shipmentValue,
          urgency
        }} courierDetails={{
          name: selectedCourierData?.name || "",
          baseFare: baseFare,
          // This already includes platform fee (merged into displayed price)
          deliveryTime: selectedCourierData?.deliveryTime || ""
        }} selectedDate={selectedDate} onConfirm={handleProceedToPayment} onBack={handlePrevStep} />;
      default:
        return null;
    }
  };
  return <PageBackground variant="logistics" opacity={0.7}>
      <PageSeo title="Book a Courier — Compare 14+ Couriers Online | ViaSetu" description="Compare real-time prices and ETAs from 14+ couriers and book doorstep pickup across 21,000+ pincodes in India." path="/booking" />
      <div className="min-h-screen relative z-10">
        {/* Header */}
        <header className="backdrop-blur-md border-b border-border/50 p-2.5 md:p-4 sticky top-0 z-50 bg-primary-glow">
          <div className="flex items-center gap-2 md:gap-3 max-w-2xl mx-auto">
            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10" onClick={() => currentStep === 1 ? navigate(assistedContext ? "/admin/assisted-booking" : "/") : handlePrevStep()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base md:text-xl font-semibold text-slate-700">
              {assistedContext ? "Assisted Booking" : "Book Delivery"}
            </h1>
          </div>
        </header>

        {assistedContext && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-3 md:px-4 py-2 sticky top-[52px] md:top-[65px] z-40">
            <div className="max-w-2xl mx-auto flex items-center gap-2 text-sm">
              <UserCog className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Booking on behalf of <strong>{assistedContext.name || 'customer'}</strong> · +91 {assistedContext.phone}
              </span>
            </div>
          </div>
        )}

        <div className="booking-shell p-3 md:p-4 max-w-2xl mx-auto pb-24 md:pb-4">
          <BookingProgress currentStep={currentStep} totalSteps={totalSteps} />
          {renderCurrentStep()}
          {assistedContext && currentStep === 6 && sendingPaymentLink && (
            <div className="mt-3 text-sm text-muted-foreground text-center">Sending payment link to customer…</div>
          )}
        </div>


        <BottomNav />

        {/* Payment Modal (customer self-service only) */}
        {!assistedContext && selectedCourierData && <PaymentModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} orderDetails={{
        courierId: selectedPartnerData?.partnerId ?? '',
        courierName: selectedCourierData.name ?? '',
        baseFare: baseFare,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        pickupDate: selectedDate?.toISOString()
      }} onPaymentSuccess={handlePaymentSuccess} customerDetails={{
        name: senderData.name,
        phone: senderData.phone,
        email: undefined
      }} bookingDraft={{
        sender_name: senderData.name,
        sender_phone: senderData.phone,
        sender_address: [senderData.flatNo, senderData.address].filter(Boolean).join(', '),
        sender_city: senderData.city,
        sender_state: senderData.state,
        sender_pincode: senderData.pincode,
        receiver_name: receiverData.name,
        receiver_phone: receiverData.phone,
        receiver_address: [receiverData.flatNo, receiverData.address].filter(Boolean).join(', '),
        receiver_city: receiverData.city,
        receiver_state: receiverData.state,
        receiver_pincode: receiverData.pincode,
        goods_type: goodsType || 'Package',
        package_weight: String(weightUnit === 'g' ? (parseFloat(packageWeight) || 1000) / 1000 : parseFloat(packageWeight) || 1),
        length: dimensions?.length || null,
        width: dimensions?.width || null,
        height: dimensions?.height || null,
        shipment_value: shipmentValue ? parseFloat(shipmentValue) : null,
        urgency: urgency || 'standard',
        courier_name: selectedCourierData.name ?? '',
        courier_price: totalAmount,
        delivery_time: selectedCourierData.deliveryTime || 'Standard',
        base_fare: baseFare,
        platform_fee: effectivePlatformFee,
        gst: gstAmount, courier_rate: courierRateValue, retail_price: retailPriceValue, margin_amount: effectivePlatformFee, account_type: 'consumer',
        booking_source: 'pending',
      }} />}

        {/* Admin-assisted: payment link sent confirmation */}
        <Dialog open={!!paymentLinkInfo} onOpenChange={(open) => { if (!open) { setPaymentLinkInfo(null); navigate('/admin/assisted-booking'); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Payment link sent
              </DialogTitle>
              <DialogDescription>
                An SMS with the Razorpay payment link has been sent to <strong>+91 {assistedContext?.phone}</strong>.
                The booking will be confirmed automatically once the customer completes payment.
              </DialogDescription>
            </DialogHeader>
            {paymentLinkInfo?.url && (
              <div className="rounded-md border bg-muted p-3 text-xs break-all font-mono">
                {paymentLinkInfo.url}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  if (paymentLinkInfo?.url) {
                    navigator.clipboard.writeText(paymentLinkInfo.url);
                    toast({ title: "Link copied" });
                  }
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy link
              </Button>
              <Button variant="outline" onClick={() => { setPaymentLinkInfo(null); navigate('/admin/assisted-pending'); }}>
                View pending bookings
              </Button>
              <Button onClick={() => { setPaymentLinkInfo(null); navigate('/admin/assisted-booking'); }}>
                Book for another customer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* Booking Confirmation Dialog */}
        <BookingConfirmationDialog isOpen={showConfirmationDialog} onClose={() => {
        setShowConfirmationDialog(false);
        if (confirmationData) {
          navigate("/tracking", {
            state: {
              orderId: confirmationData.trackingId,
              awbNumber: confirmationData.awbNumber,
              courier: confirmationData.courierName,
              pickupAddress: `${senderData.address}, ${senderData.city}`,
              deliveryAddress: `${receiverData.address}, ${receiverData.city}`,
              pickupDate: selectedDate?.toISOString()
            }
          });
        }
      }} awbNumber={confirmationData?.awbNumber || ""} labelUrl={confirmationData?.labelUrl} courierName={confirmationData?.courierName} isReversePickup={(confirmationData?.courierName || "").toLowerCase().includes("shadowfax")} bookingId={confirmationData?.bookingId} />
      </div>
    </PageBackground>;
};
export default Booking;