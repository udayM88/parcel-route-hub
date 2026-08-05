import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, CheckCircle, Package, Loader2, FileText, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { supabase } from "@/integrations/supabase/client";
import { CURRENT_ENV } from "@/config/environment";
import { cn } from "@/lib/utils";
import { computeBaseFare, computeChargeableKg } from "@/lib/pricing";
import PincodeSwapButton from "@/components/booking/PincodeSwapButton";

const goodsTypes = [
  { id: 'documents', label: 'Documents / Envelope', icon: FileText, weightHint: 'Up to 250g' },
  { id: 'box', label: 'Box / Parcel', icon: Package, weightHint: 'Specify contents' },
];

interface PricingData {
  basePrice: number;
  convenienceFee: number;
  totalPrice: number;
  serviceType: string;
  weightRange: string;
  locationType: string;
}

interface BookingStep2Props {
  pickupPincode: string;
  deliveryPincode: string;
  pickupCity?: string;
  deliveryCity?: string;
  goodsType: string;
  packageWeight: string;
  dimensions: { length: string; width: string; height: string };
  shipmentValue: string;
  urgency: string;
  onInputChange: (field: string, value: string) => void;
  onDimensionChange: (dimension: string, value: string) => void;
  onPricingCalculated?: (pricing: PricingData) => void;
  onServiceabilityData?: (data: any) => void;
  onLocationData?: (pickupCity: string, pickupState: string, deliveryCity: string, deliveryState: string) => void;
  onWeightUnitChange?: (unit: 'kg' | 'g') => void;
  onNext: () => void;
  onBack: () => void;
}

// Registry of direct courier partners. Add a new entry here (and a matching
// edge function) to enable a new partner. Each function should respond with
// `{ is_serviceable, partner: { partner_code, partner_name, services, ... } }`.
const DIRECT_PARTNERS: { code: string; name: string; fn: string }[] = [
  { code: 'shadowfax', name: 'Shadowfax', fn: 'shadowfax-serviceability' },
  { code: 'delhivery', name: 'Delhivery', fn: 'delhivery-serviceability' },
  { code: 'urbanebolt', name: 'UrbaneBolt', fn: 'urbanebolt-serviceability' },
  { code: 'xpressbees', name: 'XpressBees', fn: 'xpressbees-serviceability' },
  { code: 'shree_maruti', name: 'Shree Maruti Courier', fn: 'shree-maruti-serviceability' },
  // Future: { code: 'dtdc', name: 'DTDC', fn: 'dtdc-serviceability' },
];

const BookingStep2 = ({ 
  pickupPincode,
  deliveryPincode,
  pickupCity,
  deliveryCity,
  goodsType,
  packageWeight,
  dimensions,
  shipmentValue,
  urgency,
  onInputChange,
  onDimensionChange,
  onPricingCalculated,
  onServiceabilityData,
  onLocationData,
  onWeightUnitChange,
  onNext, 
  onBack 
}: BookingStep2Props) => {
  const { toast } = useToast();
  const [isCheckingServiceability, setIsCheckingServiceability] = useState(false);
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [isServiceable, setIsServiceable] = useState(false);
  const [isLoadingPickupCity, setIsLoadingPickupCity] = useState(false);
  const [isLoadingDeliveryCity, setIsLoadingDeliveryCity] = useState(false);
  // Weight is always captured in grams in the UI; converted to kg before sending to API.
  const weightUnit: 'g' = 'g';
  useEffect(() => { onWeightUnitChange?.('g'); }, [onWeightUnitChange]);
  const [customGoodsType, setCustomGoodsType] = useState('');
  
  const pickupDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const deliveryDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    if (pickupPincode.length === 6) {
      setIsLoadingPickupCity(true);
      pickupDebounceRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('google-geocode-pincode', {
            body: { pincodes: [pickupPincode] }
          });
          if (!error && data?.results?.[0]) {
            const result = data.results[0];
            if (onLocationData && result.city) {
              onLocationData(result.city, result.state || '', deliveryCity || '', '');
            }
          }
        } catch (err) {
          console.error('Pickup city lookup error:', err);
        } finally {
          setIsLoadingPickupCity(false);
        }
      }, 500);
    }
    return () => {
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    };
  }, [pickupPincode]);

  useEffect(() => {
    if (deliveryDebounceRef.current) clearTimeout(deliveryDebounceRef.current);
    if (deliveryPincode.length === 6) {
      setIsLoadingDeliveryCity(true);
      deliveryDebounceRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.functions.invoke('google-geocode-pincode', {
            body: { pincodes: [deliveryPincode] }
          });
          if (!error && data?.results?.[0]) {
            const result = data.results[0];
            if (onLocationData && result.city) {
              onLocationData(pickupCity || '', '', result.city, result.state || '');
            }
          }
        } catch (err) {
          console.error('Delivery city lookup error:', err);
        } finally {
          setIsLoadingDeliveryCity(false);
        }
      }, 500);
    }
    return () => {
      if (deliveryDebounceRef.current) clearTimeout(deliveryDebounceRef.current);
    };
  }, [deliveryPincode]);
  
  const isDocuments = goodsType === 'documents';
  const dimensionsRequired = !isDocuments;
  const weightRequired = !isDocuments;
  // For documents/envelope, weight is fixed at 250g (no user input needed).
  useEffect(() => {
    if (isDocuments && packageWeight !== '250') {
      onInputChange('packageWeight', '250');
    }
  }, [isDocuments, packageWeight, onInputChange]);
  const isValid = pickupPincode && deliveryPincode && goodsType
    && (!weightRequired || packageWeight)
    && (!dimensionsRequired || (dimensions.length && dimensions.width && dimensions.height))
    && (goodsType !== 'box' || customGoodsType.trim());

  const handleContinue = async () => {
    if (!isValid) return;
    
    if (pickupPincode.length !== 6 || deliveryPincode.length !== 6) {
      toast({
        title: "Invalid Pincode",
        description: "Please enter valid 6-digit pincodes",
        variant: "destructive"
      });
      return;
    }

    setIsCheckingServiceability(true);

    try {
      let pickupCityLocal = '';
      let pickupState = '';
      let deliveryCityLocal = '';
      let deliveryState = '';

      // Weight is always entered in grams now. Reject empty/invalid input
      // instead of silently defaulting to 1 kg (which masked the real weight).
      const weightG = parseFloat(packageWeight);
      if (!weightG || weightG <= 0) {
        toast({
          title: "Invalid weight",
          description: "Please enter the package weight in grams.",
          variant: "destructive",
        });
        setIsCheckingServiceability(false);
        return;
      }
      const weightKg = weightG / 1000;
      // Compute chargeable weight (max of dead vs volumetric, rounded up
      // to next 0.5 kg) and quote partners on THAT — otherwise we'd
      // under-charge on bulky-but-light parcels (e.g. 300 g box at 50×50×20
      // = 5 kg volumetric → partner bills us for 5 kg).
      const { chargeableKg } = computeChargeableKg(
        weightKg,
        dimensions.length,
        dimensions.width,
        dimensions.height,
        { isDocument: isDocuments },
      );

      const partnerPayload = {
        pickup_pincode: pickupPincode,
        delivery_pincode: deliveryPincode,
        weight_kg: chargeableKg > 0 ? chargeableKg : weightKg,
        length_cm: parseFloat(dimensions.length) || 10,
        width_cm: parseFloat(dimensions.width) || 10,
        height_cm: parseFloat(dimensions.height) || 10,
      };

      // Run serviceability checks for all direct partners in parallel.
      const results = await Promise.allSettled(
        DIRECT_PARTNERS.map((p) =>
          supabase.functions.invoke(p.fn, {
            body: partnerPayload,
            headers: { 'x-environment': CURRENT_ENV },
          }).then((res) => ({ ...res, _partnerCode: p.code }))
        )
      );

      const partners: any[] = [];
      results.forEach((result, idx) => {
        const meta = DIRECT_PARTNERS[idx];
        const partnerCode = meta.code;
        const partnerName = meta.name;
        const partnerId = `${partnerCode}_direct`;

        const pushUnavailable = (reason: string) => {
          partners.push({
            partner_id: partnerId,
            partner_code: partnerCode,
            partner_name: partnerName,
            is_serviceable: false,
            services: [],
            rating: 0,
            error: reason,
          });
        };

        if (result.status === 'fulfilled') {
          const { data, error } = result.value as any;
          if (!error && data?.is_serviceable && data?.partner) {
            partners.push(data.partner);
            console.log(`${partnerCode} is serviceable:`, data.partner);
          } else {
            // Capture the API's stated reason so the UI can show it.
            const reason =
              data?.reason ||
              data?.error ||
              error?.message ||
              'Not serviceable for this route';
            pushUnavailable(String(reason));
            console.warn(`${partnerCode} not serviceable:`, reason, data || error);
          }
        } else {
          pushUnavailable('Partner service temporarily unavailable');
          console.warn(`${partnerCode} serviceability rejected:`, result.reason);
        }
      });

      const serviceableCount = partners.filter((p) => p.is_serviceable).length;
      const serviceabilityData = {
        success: serviceableCount > 0,
        partners,
        metadata: { serviceable_count: serviceableCount },
      };

      if (serviceableCount === 0) {
        setIsServiceable(false);
        // Still pass partners (with reasons) to the next step so the user
        // can see WHY each courier declined.
        if (onServiceabilityData) onServiceabilityData(serviceabilityData);
        toast({
          title: "Service Unavailable",
          description: "No courier partner serves this route right now. Please try different pincodes.",
          variant: "destructive"
        });
        return;
      }

      // Fetch city names using Google Geocoding API
      try {
        const { data: geocodeData, error: geocodeError } = await supabase.functions.invoke('google-geocode-pincode', {
          body: { pincodes: [pickupPincode, deliveryPincode] }
        });

        if (!geocodeError && geocodeData?.results) {
          const pickupResult = geocodeData.results.find((r: any) => r.pincode === pickupPincode);
          const deliveryResult = geocodeData.results.find((r: any) => r.pincode === deliveryPincode);
          if (pickupResult) {
            pickupCityLocal = pickupResult.city || '';
            pickupState = pickupResult.state || '';
          }
          if (deliveryResult) {
            deliveryCityLocal = deliveryResult.city || '';
            deliveryState = deliveryResult.state || '';
          }
        } else {
          console.warn('Geocoding failed:', geocodeError);
        }
      } catch (geocodeErr) {
        console.error('Geocoding error:', geocodeErr);
      }
      
      extractPricingFromResponse(serviceabilityData);
      
      if (onServiceabilityData) {
        onServiceabilityData(serviceabilityData);
      }
      
      if (onLocationData) {
        onLocationData(pickupCityLocal, pickupState, deliveryCityLocal, deliveryState);
      }
      
      setIsServiceable(true);
      
      toast({
        title: "Service Available ✓",
        description: "Great! Delivery is available for this route.",
      });
      
      onNext();
    } catch (error: any) {
      console.error('Serviceability check error:', error);
      toast({
        title: "Error",
        description: "Failed to check serviceability. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsCheckingServiceability(false);
    }
  };

  const extractPricingFromResponse = (serviceabilityData: any) => {
    try {
      const serviceablePartner = serviceabilityData.partners?.find(
        (p: any) => p.is_serviceable
      );

      if (serviceablePartner?.services && serviceablePartner.services.length > 0) {
        const service = serviceablePartner.services[0];
        const apiPrice = Math.round(service.rate?.price?.amount || 0);
        // Deterministic: 50% markup + ₹50 zone fee on courier card price.
        const basePrice = computeBaseFare(apiPrice);
        const convenienceFee = 0;
        const totalPrice = basePrice;

        const pricing: PricingData = {
          basePrice,
          convenienceFee,
          totalPrice,
          serviceType: service.service_name.toUpperCase(),
          weightRange: 'Based on package details',
          locationType: serviceablePartner.capabilities?.city_name || 'Standard'
        };

        setPricingData(pricing);
        if (onPricingCalculated) {
          onPricingCalculated(pricing);
        }
      }
    } catch (error) {
      console.error('Error extracting pricing:', error);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg font-bold">
            <MapPin className="h-5 w-5 text-primary" />
            Pincode Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 md:p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup-pincode" className="font-semibold text-foreground">Pickup Pincode</Label>
              <Input
                id="pickup-pincode"
                value={pickupPincode}
                onChange={(e) => onInputChange('pickupPincode', e.target.value)}
                placeholder="e.g., 110001"
                maxLength={6}
              />
              {isLoadingPickupCity ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up city...
                </p>
              ) : pickupCity ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {pickupCity}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-pincode" className="font-semibold text-foreground">Delivery Pincode</Label>
              <Input
                id="delivery-pincode"
                value={deliveryPincode}
                onChange={(e) => onInputChange('deliveryPincode', e.target.value)}
                placeholder="e.g., 400001"
                maxLength={6}
              />
              {isLoadingDeliveryCity ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Looking up city...
                </p>
              ) : deliveryCity ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {deliveryCity}
                </p>
              ) : null}
            </div>
          </div>
          <PincodeSwapButton
            onSwap={() => {
              const p = pickupPincode;
              onInputChange('pickupPincode', deliveryPincode);
              onInputChange('deliveryPincode', p);
            }}
            disabled={!pickupPincode && !deliveryPincode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 md:p-6 pb-2 md:pb-4">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg font-bold">
            <Package className="h-5 w-5 text-primary" />
            Package Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 md:space-y-6 p-4 md:p-6 pt-0">
          <div className="space-y-3">
            <Label className="font-semibold text-foreground">Type of Good *</Label>
            <div className="grid grid-cols-2 gap-2">
              {goodsTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = goodsType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => onInputChange('goodsType', type.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted bg-muted/50 text-muted-foreground hover:border-primary/50 hover:bg-muted"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-bold text-center">{type.label}</span>
                    <span className="text-[10px] text-foreground font-medium">{type.weightHint}</span>
                  </button>
                );
              })}
            </div>
            {goodsType === 'box' && (
              <div className="space-y-2 mt-3">
                <Label htmlFor="custom-goods-type" className="font-semibold text-foreground">Goods specification — what's inside the box? *</Label>
                <Input
                  id="custom-goods-type"
                  value={customGoodsType}
                  onChange={(e) => setCustomGoodsType(e.target.value)}
                  placeholder="e.g., Electronics, Clothing, Books, Cosmetics"
                  maxLength={80}
                />
                <p className="text-[11px] text-foreground font-medium">
                  Required by courier partners. Please describe the contents accurately.
                </p>
              </div>
            )}
          </div>

          {weightRequired ? (
            <div className="space-y-2">
              <Label htmlFor="package-weight" className="font-semibold text-foreground">Weight (g)</Label>
              <Input
                id="package-weight"
                type="number"
                value={packageWeight}
                onChange={(e) => onInputChange('packageWeight', e.target.value)}
                placeholder="e.g., 500"
                min="1"
                step="1"
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                <span>Enter weight in grams. Discrepancies may lead to additional charges or pickup cancellation by the courier partner.</span>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              ✉️ Weight fixed at 250g for documents/envelopes — no input needed.
            </p>
          )}
          {dimensionsRequired ? (
            <div className="space-y-2">
              <Label className="font-semibold text-foreground">Dimensions (cm)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="length" className="text-xs text-foreground font-medium">Length</Label>
                  <Input id="length" type="number" value={dimensions.length} onChange={(e) => onDimensionChange('length', e.target.value)} placeholder="L" min="1" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="width" className="text-xs text-foreground font-medium">Breadth</Label>
                  <Input id="width" type="number" value={dimensions.width} onChange={(e) => onDimensionChange('width', e.target.value)} placeholder="B" min="1" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="height" className="text-xs text-foreground font-medium">Height</Label>
                  <Input id="height" type="number" value={dimensions.height} onChange={(e) => onDimensionChange('height', e.target.value)} placeholder="H" min="1" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              📄 Dimensions not required for documents/envelopes.
            </p>
          )}

          {/* Chargeable weight — the single number couriers bill on.
              Dead vs volumetric internals are hidden from the user. */}
          {(() => {
            const deadKg = (parseFloat(packageWeight) || 0) / 1000;
            const { chargeableKg } = computeChargeableKg(
              deadKg,
              dimensions.length,
              dimensions.width,
              dimensions.height,
              { isDocument: isDocuments },
            );
            const shouldShow = deadKg > 0 && (
              isDocuments ||
              (dimensions.length && dimensions.width && dimensions.height)
            );
            if (!shouldShow) return null;
            const fmt = (kg: number) => `${Math.round(kg * 1000).toLocaleString()} g`;
            return (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex justify-between items-center text-sm">
                <span className="font-semibold">Chargeable weight</span>
                <span className="font-bold text-primary text-base">{fmt(chargeableKg)}</span>
              </div>
            );
          })()}
        </CardContent>
      </Card>



      {isServiceable && (
        <Alert className="border-green-500/50 bg-green-500/10">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <AlertDescription className="text-foreground">
            <strong>Serviceability Confirmed!</strong> Delivery is available between these pincodes. 
            Continue to enter package details.
          </AlertDescription>
        </Alert>
      )}

      {pricingData && isServiceable && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold">
              <CheckCircle className="h-5 w-5 text-success" />
              Estimated Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground font-medium">Base Price</span>
              <span className="font-semibold">₹{pricingData.basePrice}</span>
            </div>
            <div className="border-t pt-2 flex justify-between items-center">
              <span className="font-bold">Total Estimated Cost</span>
              <span className="text-xl font-bold text-primary">₹{pricingData.totalPrice}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">
              * Price is inclusive of all taxes, pickup and delivery charges
            </p>
            <div className="text-xs text-muted-foreground mt-2">
              <p>Service Type: {pricingData.serviceType}</p>
              <p>Weight Range: {pricingData.weightRange}</p>
              <p>Location Type: {pricingData.locationType}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          Back
        </Button>
        <Button 
          onClick={handleContinue} 
          disabled={!isValid || isCheckingServiceability}
          className="flex-1 h-12"
        >
          {isCheckingServiceability ? "Checking..." : "Check & Continue"}
        </Button>
      </div>
    </div>
  );
};

export default BookingStep2;
