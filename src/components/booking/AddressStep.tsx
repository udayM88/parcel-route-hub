import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { AlertTriangle, Package, User, Users, BookmarkPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import SavedAddressPicker, { useSaveAddress } from "./SavedAddressPicker";
import { supabase } from "@/integrations/supabase/client";

// Validate 10-digit phone number (digits only, no country code)
const validatePhone = (phone: string): boolean => {
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10;
};

const formatPhoneDisplay = (phone: string): string => {
  // Remove any non-digit characters except for display
  return phone.replace(/[^\d]/g, '').slice(0, 10);
};

const parseJwtPayload = (token?: string): Record<string, any> | null => {
  if (!token) return null;

  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const getSelfAutofillSource = () => {
  try {
    const prayogAuth = localStorage.getItem('prayog_auth');
    if (!prayogAuth) return null;

    const auth = JSON.parse(prayogAuth);
    const tokenPayload = parseJwtPayload(auth.id_token || auth.token);
    const rawPhone = auth.phone || auth.phone_number || tokenPayload?.phone_number || '';
    const nameFromAuth = [auth.userName, auth.full_name, auth.name]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0) || '';

    return {
      auth,
      userId: auth.user_id || auth.customer_id || tokenPayload?.sub || '',
      phone: formatPhoneDisplay(String(rawPhone).replace(/^\+91/, '')),
      nameFromAuth: nameFromAuth.trim(),
    };
  } catch (error) {
    console.error('Failed to parse Prayog auth for self autofill:', error);
    return null;
  }
};

import AddressInput from "./AddressInput";

interface PincodeMismatch {
  expected: string;
  actual: string;
}

interface AddressStepProps {
  senderData: {
    name: string;
    phone: string;
    flatNo: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  receiverData: {
    name: string;
    phone: string;
    flatNo: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  pickupPincode: string;
  deliveryPincode: string;
  shipmentValue: string;
  packageDescription: string;
  onSenderChange: (field: string, value: string) => void;
  onReceiverChange: (field: string, value: string) => void;
  onPackageChange: (field: string, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onGoToStep?: (step: number) => void;
}

const AddressStep = ({
  senderData,
  receiverData,
  pickupPincode,
  deliveryPincode,
  shipmentValue,
  packageDescription,
  onSenderChange,
  onReceiverChange,
  onPackageChange,
  onNext,
  onBack,
  onGoToStep,
}: AddressStepProps) => {
  const { toast } = useToast();
  const [senderPincodeMismatch, setSenderPincodeMismatch] = useState<PincodeMismatch | null>(null);
  const [receiverPincodeMismatch, setReceiverPincodeMismatch] = useState<PincodeMismatch | null>(null);
  const [bookingFor, setBookingFor] = useState<'self' | 'other'>('other');
  const [submitted, setSubmitted] = useState(false);
  const [saveSender, setSaveSender] = useState(false);
  const [saveReceiver, setSaveReceiver] = useState(false);
  const { saveAddress } = useSaveAddress();

  // Modal mismatch dialog — used by autocomplete + saved-address picker
  const [mismatchDialog, setMismatchDialog] = useState<{
    type: 'sender' | 'receiver';
    expected: string;
    actual: string;
    apply: () => void;
  } | null>(null);

  // Auto-fill sender from profile when "Self" is selected
  useEffect(() => {
    if (bookingFor !== 'self') return;

    let isActive = true;

    const fillSelfDetails = async () => {
      const autofillSource = getSelfAutofillSource();
      if (!autofillSource) return;

      if (autofillSource.phone) {
        onSenderChange('phone', autofillSource.phone);
      }

      if (autofillSource.nameFromAuth) {
        onSenderChange('name', autofillSource.nameFromAuth);
      }

      if (!autofillSource.userId) return;

      try {
        const { data, error } = await supabase.functions.invoke('get-profile', {
          body: { user_id: autofillSource.userId }
        });

        if (error) throw error;
        if (!isActive) return;

        const profileName = data?.profile?.full_name?.trim();
        if (!profileName) return;

        onSenderChange('name', profileName);
        localStorage.setItem('prayog_auth', JSON.stringify({
          ...autofillSource.auth,
          userName: profileName,
          full_name: profileName,
        }));
      } catch (error) {
        console.error('Failed to fetch profile for self autofill:', error);
      }
    };

    void fillSelfDetails();

    return () => {
      isActive = false;
    };
  }, [bookingFor]);

  const isSenderPhoneValid = validatePhone(senderData.phone);
  const isReceiverPhoneValid = validatePhone(receiverData.phone);

  const isSenderValid = 
    senderData.name && 
    senderData.phone && 
    isSenderPhoneValid &&
    senderData.flatNo &&
    senderData.address && 
    senderData.city && 
    senderData.state && 
    senderData.pincode;

  const isReceiverValid = 
    receiverData.name && 
    receiverData.phone && 
    isReceiverPhoneValid &&
    receiverData.flatNo &&
    receiverData.address && 
    receiverData.city && 
    receiverData.state && 
    receiverData.pincode;

  const hasPincodeMismatch = senderPincodeMismatch !== null || receiverPincodeMismatch !== null;
  const isValid = isSenderValid && isReceiverValid && !hasPincodeMismatch;

  // Get missing fields for validation messages
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!senderData.name) missing.push('Sender Name');
    if (!senderData.phone) missing.push('Sender Phone');
    else if (!isSenderPhoneValid) missing.push('Valid Sender Phone');
    if (!senderData.flatNo) missing.push('Sender Flat/House No.');
    if (!senderData.address) missing.push('Sender Address');
    if (!senderData.city) missing.push('Sender City');
    if (!senderData.state) missing.push('Sender State');
    if (!receiverData.name) missing.push('Receiver Name');
    if (!receiverData.phone) missing.push('Receiver Phone');
    else if (!isReceiverPhoneValid) missing.push('Valid Receiver Phone');
    if (!receiverData.flatNo) missing.push('Receiver Flat/House No.');
    if (!receiverData.address) missing.push('Receiver Address');
    if (!receiverData.city) missing.push('Receiver City');
    if (!receiverData.state) missing.push('Receiver State');
    return missing;
  };

  const handleContinue = () => {
    setSubmitted(true);
    if (!isValid) {
      const missing = getMissingFields();
      toast({
        title: "Missing Fields",
        description: `Please fill: ${missing.join(', ')}`,
        variant: "destructive",
      });
      return;
    }
    // Defensive submit-time pincode guard
    if (senderData.pincode !== pickupPincode || receiverData.pincode !== deliveryPincode) {
      toast({
        title: "Pincode Mismatch",
        description: "Address pincodes don't match Step 2. Please go back and re-check.",
        variant: "destructive",
      });
      return;
    }
    if (saveSender) {
      saveAddress({ ...senderData, label: 'Sender' });
    }
    if (saveReceiver) {
      saveAddress({ ...receiverData, label: 'Receiver' });
    }
    onNext();
  };

  const handlePhoneChange = (type: 'sender' | 'receiver', value: string) => {
    // Only allow digits, limit to 10
    const formatted = formatPhoneDisplay(value);
    if (type === 'sender') {
      onSenderChange("phone", formatted);
    } else {
      onReceiverChange("phone", formatted);
    }
  };

  const handleSenderAddressSelect = (components: { address: string; city?: string; state?: string; pincode?: string }) => {
    // If pincode mismatch — block apply, open modal
    if (components.pincode && components.pincode !== pickupPincode) {
      setMismatchDialog({
        type: 'sender',
        expected: pickupPincode,
        actual: components.pincode,
        apply: () => {
          // User chose "Update pincode and go back to Step 2" — go to step 2 with new pincode
          onGoToStep?.(2);
        },
      });
      return; // do NOT apply address/city/state from a mismatched suggestion
    }
    onSenderChange("address", components.address);
    if (components.city) onSenderChange("city", components.city);
    if (components.state) onSenderChange("state", components.state);
    setSenderPincodeMismatch(null);
  };

  const handleReceiverAddressSelect = (components: { address: string; city?: string; state?: string; pincode?: string }) => {
    if (components.pincode && components.pincode !== deliveryPincode) {
      setMismatchDialog({
        type: 'receiver',
        expected: deliveryPincode,
        actual: components.pincode,
        apply: () => {
          onGoToStep?.(2);
        },
      });
      return;
    }
    onReceiverChange("address", components.address);
    if (components.city) onReceiverChange("city", components.city);
    if (components.state) onReceiverChange("state", components.state);
    setReceiverPincodeMismatch(null);
  };

  const fieldError = (condition: boolean) => submitted && condition ? "border-destructive" : "";

  return (
    <div className="space-y-6">
      {/* Self / Someone Else Toggle */}
      <Card className="p-4">
        <Label className="text-sm font-semibold text-foreground mb-3 block">Sending for</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={bookingFor === 'self' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBookingFor('self')}
            className="flex-1"
          >
            <User className="h-4 w-4 mr-1.5" /> Self
          </Button>
          <Button
            type="button"
            variant={bookingFor === 'other' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBookingFor('other')}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1.5" /> Someone Else
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold">Sender Details</h2>
          <SavedAddressPicker type="sender" onSelect={(addr) => {
            // Pincode mismatch — block apply, open dialog
            if (addr.pincode && addr.pincode !== pickupPincode) {
              setMismatchDialog({
                type: 'sender',
                expected: pickupPincode,
                actual: addr.pincode,
                apply: () => onGoToStep?.(2),
              });
              return;
            }
            onSenderChange('name', addr.name);
            onSenderChange('phone', addr.phone);
            onSenderChange('flatNo', addr.flatNo);
            onSenderChange('address', addr.address);
            onSenderChange('city', addr.city);
            onSenderChange('state', addr.state);
          }} />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sender-name" className="font-semibold text-foreground">Full Name *</Label>
              <Input
                id="sender-name"
                value={senderData.name}
                onChange={(e) => onSenderChange("name", e.target.value)}
                placeholder="Enter sender name"
                readOnly={bookingFor === 'self'}
                className={`${fieldError(!senderData.name)} ${bookingFor === 'self' ? 'bg-muted' : ''}`}
              />
              {submitted && !senderData.name && <p className="text-xs text-destructive mt-1">Name is required</p>}
            </div>
            <div>
              <Label htmlFor="sender-phone" className="font-semibold text-foreground">Phone Number * (10 digits)</Label>
              <Input
                id="sender-phone"
                type="tel"
                value={senderData.phone}
                onChange={(e) => handlePhoneChange('sender', e.target.value)}
                placeholder="1234567890"
                maxLength={10}
                readOnly={bookingFor === 'self'}
                className={`${(senderData.phone && !isSenderPhoneValid) || (submitted && !senderData.phone) ? "border-destructive" : ""} ${bookingFor === 'self' ? 'bg-muted' : ''}`}
              />
              {senderData.phone && !isSenderPhoneValid && (
                <p className="text-xs text-destructive mt-1">
                  Please enter a valid 10-digit phone number
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="sender-flatNo" className="font-semibold text-foreground">Flat No./Building Name/House No. *</Label>
            <Input
              id="sender-flatNo"
              value={senderData.flatNo}
              onChange={(e) => onSenderChange("flatNo", e.target.value)}
              placeholder="Enter flat no., building name, or house no."
              className={fieldError(!senderData.flatNo)}
            />
            {submitted && !senderData.flatNo && <p className="text-xs text-destructive mt-1">Required</p>}
          </div>

          <AddressInput
            id="sender-address"
            label="Complete Address *"
            value={senderData.address}
            onChange={(value) => {
              onSenderChange("address", value);
              setSenderPincodeMismatch(null);
            }}
            onAddressSelect={handleSenderAddressSelect}
            placeholder="Start typing address..."
            restrictToPincode={pickupPincode}
          />

          {senderPincodeMismatch && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pincode Mismatch</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  The address you selected has pincode <strong>{senderPincodeMismatch.actual}</strong>, 
                  but you entered <strong>{senderPincodeMismatch.expected}</strong> for pickup.
                </p>
                <p className="text-sm">
                  Please select an address within pincode {senderPincodeMismatch.expected} or go back to update the pincode.
                </p>
                <Button variant="outline" size="sm" onClick={() => onGoToStep?.(2)} className="mt-2">
                  Go Back to Change Pincode
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="sender-city" className="font-semibold text-foreground">City *</Label>
              <Input
                id="sender-city"
                value={senderData.city}
                onChange={(e) => onSenderChange("city", e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="sender-state" className="font-semibold text-foreground">State *</Label>
              <Input
                id="sender-state"
                value={senderData.state}
                onChange={(e) => onSenderChange("state", e.target.value)}
                placeholder="State"
              />
            </div>
            <div>
              <Label htmlFor="sender-pincode" className="font-semibold text-foreground">Pincode *</Label>
              <Input
                id="sender-pincode"
                value={senderData.pincode}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Checkbox id="save-sender" checked={saveSender} onCheckedChange={(v) => setSaveSender(!!v)} />
            <Label htmlFor="save-sender" className="text-sm text-foreground font-medium cursor-pointer">Save this address</Label>
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold">Receiver Details</h2>
          <SavedAddressPicker type="receiver" onSelect={(addr) => {
            if (addr.pincode && addr.pincode !== deliveryPincode) {
              setMismatchDialog({
                type: 'receiver',
                expected: deliveryPincode,
                actual: addr.pincode,
                apply: () => onGoToStep?.(2),
              });
              return;
            }
            onReceiverChange('name', addr.name);
            onReceiverChange('phone', addr.phone);
            onReceiverChange('flatNo', addr.flatNo);
            onReceiverChange('address', addr.address);
            onReceiverChange('city', addr.city);
            onReceiverChange('state', addr.state);
          }} />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="receiver-name" className="font-semibold text-foreground">Full Name *</Label>
              <Input
                id="receiver-name"
                value={receiverData.name}
                onChange={(e) => onReceiverChange("name", e.target.value)}
                placeholder="Enter receiver name"
                className={fieldError(!receiverData.name)}
              />
              {submitted && !receiverData.name && <p className="text-xs text-destructive mt-1">Name is required</p>}
            </div>
            <div>
              <Label htmlFor="receiver-phone" className="font-semibold text-foreground">Phone Number * (10 digits)</Label>
              <Input
                id="receiver-phone"
                type="tel"
                value={receiverData.phone}
                onChange={(e) => handlePhoneChange('receiver', e.target.value)}
                placeholder="1234567890"
                maxLength={10}
                className={`${(receiverData.phone && !isReceiverPhoneValid) || (submitted && !receiverData.phone) ? "border-destructive" : ""}`}
              />
              {receiverData.phone && !isReceiverPhoneValid && (
                <p className="text-xs text-destructive mt-1">
                  Please enter a valid 10-digit phone number
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="receiver-flatNo" className="font-semibold text-foreground">Flat No./Building Name/House No. *</Label>
            <Input
              id="receiver-flatNo"
              value={receiverData.flatNo}
              onChange={(e) => onReceiverChange("flatNo", e.target.value)}
              placeholder="Enter flat no., building name, or house no."
              className={fieldError(!receiverData.flatNo)}
            />
            {submitted && !receiverData.flatNo && <p className="text-xs text-destructive mt-1">Required</p>}
          </div>

          <AddressInput
            id="receiver-address"
            label="Complete Address *"
            value={receiverData.address}
            onChange={(value) => {
              onReceiverChange("address", value);
              setReceiverPincodeMismatch(null);
            }}
            onAddressSelect={handleReceiverAddressSelect}
            placeholder="Start typing address..."
            restrictToPincode={deliveryPincode}
          />

          {receiverPincodeMismatch && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pincode Mismatch</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  The address you selected has pincode <strong>{receiverPincodeMismatch.actual}</strong>, 
                  but you entered <strong>{receiverPincodeMismatch.expected}</strong> for delivery.
                </p>
                <p className="text-sm">
                  Please select an address within pincode {receiverPincodeMismatch.expected} or go back to update the pincode.
                </p>
                <Button variant="outline" size="sm" onClick={() => onGoToStep?.(2)} className="mt-2">
                  Go Back to Change Pincode
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="receiver-city" className="font-semibold text-foreground">City *</Label>
              <Input
                id="receiver-city"
                value={receiverData.city}
                onChange={(e) => onReceiverChange("city", e.target.value)}
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="receiver-state" className="font-semibold text-foreground">State *</Label>
              <Input
                id="receiver-state"
                value={receiverData.state}
                onChange={(e) => onReceiverChange("state", e.target.value)}
                placeholder="State"
              />
            </div>
            <div>
              <Label htmlFor="receiver-pincode" className="font-semibold text-foreground">Pincode *</Label>
              <Input
                id="receiver-pincode"
                value={receiverData.pincode}
                readOnly
                disabled
                className="bg-muted cursor-not-allowed"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Checkbox id="save-receiver" checked={saveReceiver} onCheckedChange={(v) => setSaveReceiver(!!v)} />
            <Label htmlFor="save-receiver" className="text-sm text-foreground font-medium cursor-pointer">Save this address</Label>
          </div>
        </div>
      </Card>

      {/* Package Information Card */}
      <Card className="p-4 md:p-6">
        <h2 className="text-lg md:text-xl font-bold mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Package Information
        </h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="shipment-value" className="font-semibold text-foreground">Shipment Value (₹)</Label>
            <Input
              id="shipment-value"
              type="number"
              value={shipmentValue}
              onChange={(e) => onPackageChange("shipmentValue", e.target.value)}
              placeholder="Enter value for insurance"
              min="0"
            />
            <p className="text-xs text-foreground font-medium mt-1">
              Optional: For insurance purposes
            </p>
          </div>

          <div>
            <Label htmlFor="package-description" className="font-semibold text-foreground">Package Contents *</Label>
            <Input
              id="package-description"
              value={packageDescription}
              onChange={(e) => onPackageChange("packageDescription", e.target.value)}
              placeholder="e.g., Documents, Electronics, Clothing"
            />
            <p className="text-xs text-foreground font-medium mt-1">
              Describe the contents of your package
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-row gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1 h-12">
          Back
        </Button>
        <Button onClick={handleContinue} className="flex-1 h-12">
          Continue
        </Button>
      </div>

      <AlertDialog open={!!mismatchDialog} onOpenChange={(open) => { if (!open) setMismatchDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Pincode Mismatch
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 pt-2">
                <p>
                  The address you selected belongs to pincode{' '}
                  <strong className="text-foreground">{mismatchDialog?.actual}</strong>, but you entered{' '}
                  <strong className="text-foreground">{mismatchDialog?.expected}</strong> for{' '}
                  {mismatchDialog?.type === 'sender' ? 'pickup' : 'delivery'} in Step 2.
                </p>
                <p className="text-sm">
                  To keep rates &amp; serviceability accurate, please pick a different address within{' '}
                  {mismatchDialog?.expected}, or update Step 2 to use {mismatchDialog?.actual}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMismatchDialog(null)}>
              Keep my Step-2 pincode
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const cb = mismatchDialog?.apply;
                setMismatchDialog(null);
                cb?.();
              }}
            >
              Update pincode &amp; go to Step 2
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AddressStep;
