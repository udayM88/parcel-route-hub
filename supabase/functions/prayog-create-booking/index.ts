import { getEnvironmentFromRequest, getPrayogConfig } from "../_shared/environment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment-specific Prayog config
    const env = getEnvironmentFromRequest(req);
    const prayogConfig = getPrayogConfig(env);
    
    console.log(`Using ${env} environment for Prayog booking`);

    const tenantId = prayogConfig.tenantId;
    if (!tenantId) {
      throw new Error(`PRAYOG_TENANT_ID not configured for ${env} environment`);
    }

    const bookingData = await req.json();
    console.log('Creating Prayog booking with data:', JSON.stringify(bookingData, null, 2));

    // Generate orderId in Prayog format: YYMMDDHHMMSS + 6 random alphanumeric
    const now = new Date();
    const timestamp = [
      now.getFullYear().toString().slice(-2),
      (now.getMonth() + 1).toString().padStart(2, '0'),
      now.getDate().toString().padStart(2, '0'),
      now.getHours().toString().padStart(2, '0'),
      now.getMinutes().toString().padStart(2, '0'),
      now.getSeconds().toString().padStart(2, '0'),
    ].join('');
    
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomPart = Array.from({ length: 6 }, () => 
      charset[Math.floor(Math.random() * charset.length)]
    ).join('');
    
    const orderId = timestamp + randomPart;

    // Extract selected service details from serviceabilityData
    const selectedService = bookingData.selectedService;
    
    // Calculate volumetric weight (L x W x H / 5000)
    const length = parseFloat(bookingData.dimensions?.length) || 10;
    const width = parseFloat(bookingData.dimensions?.width) || 10;
    const height = parseFloat(bookingData.dimensions?.height) || 10;
    const volumetricWeight = (length * width * height) / 5000;
    const physicalWeight = parseFloat(bookingData.packageWeight) || 1;
    
    // Get base amount from selected service
    const baseAmount = selectedService?.rate?.price?.amount || 0;
    
    const pickupAddress = bookingData.sender;
    const deliveryAddress = bookingData.receiver;
    const billingAddress = deliveryAddress;
    const returnAddress = pickupAddress;

    // Helper to combine flatNo + address
    const buildStreet = (addr: any) => 
      [addr.flatNo, addr.address].filter(Boolean).join(', ');

    // Prepare Prayog API payload
    const prayogPayload = {
      referenceId: orderId,
      orderDate: new Date().toISOString(),
      orderType: "FORWARD",
      orderStatus: "CREATED",
      parcelCategory: "ECOMM",
      autoManifest: true,
      carrierName: bookingData.carrierName || selectedService?.partner_code || "",
      carrierId: bookingData.carrierId || selectedService?.partner_id || "",
      eWaybills: [],
      deliveryPromise: selectedService?.service_name || "standard",
      metadata: { source: "WEB_APP" },
      documents: [],
      addresses: [
        {
          type: "PICKUP",
          zip: pickupAddress.pincode,
          name: pickupAddress.name,
          phone: pickupAddress.phone,
          street: buildStreet(pickupAddress),
          landmark: null,
          city: pickupAddress.city,
          state: pickupAddress.state,
          country: "India",
          latitude: 0,
          longitude: 0,
          addressName: buildStreet(pickupAddress)
        },
        {
          type: "DELIVERY",
          zip: deliveryAddress.pincode,
          name: deliveryAddress.name,
          phone: deliveryAddress.phone,
          street: buildStreet(deliveryAddress),
          landmark: null,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          country: "India",
          latitude: 0,
          longitude: 0,
          addressName: buildStreet(deliveryAddress)
        },
        {
          type: "BILLING",
          zip: billingAddress.pincode,
          name: billingAddress.name,
          phone: billingAddress.phone,
          street: buildStreet(billingAddress),
          landmark: null,
          city: billingAddress.city,
          state: billingAddress.state,
          country: "India",
          latitude: 0,
          longitude: 0,
          addressName: buildStreet(billingAddress)
        },
        {
          type: "RETURN",
          zip: returnAddress.pincode,
          name: returnAddress.name,
          phone: returnAddress.phone,
          street: buildStreet(returnAddress),
          landmark: null,
          city: returnAddress.city,
          state: returnAddress.state,
          country: "India",
          latitude: 0,
          longitude: 0,
          addressName: buildStreet(returnAddress)
        }
      ],
      shipments: [
        {
          dimensions: { 
            length: length, 
            width: width, 
            height: height 
          },
          shipmentStatus: "CONFIRMED",
          awbNumber: "",
          physicalWeight: physicalWeight,
          volumetricWeight: volumetricWeight,
          note: bookingData.note || "",
          items: [
            {
              name: bookingData.goodsType || "Package",
              description: bookingData.packageDescription || "Package"
            }
          ]
        }
      ],
      payment: {
        finalAmount: baseAmount,
        type: "PREPAID",
        // Add paymentMethod for Delhivery orders only
        ...((bookingData.carrierName || selectedService?.partner_code || "").toLowerCase().includes('delhivery') && { paymentMethod: "Pickup" }),
        breakdown: {
          otherCharges: [
            { name: "Base Rate", chargedAmount: baseAmount }
          ]
        }
      }
    };

    console.log('Sending to Prayog API:', JSON.stringify(prayogPayload, null, 2));

    // Call Prayog Booking API with environment-specific URL
    const prayogResponse = await fetch(
      `${prayogConfig.apiBaseUrl}/gateway/booking-service/orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': tenantId,
        },
        body: JSON.stringify(prayogPayload),
      }
    );

    const responseText = await prayogResponse.text();
    console.log('Prayog API response status:', prayogResponse.status);
    console.log('Prayog API response:', responseText);

    if (!prayogResponse.ok) {
      throw new Error(`Prayog API error: ${prayogResponse.status} - ${responseText}`);
    }

    const prayogResult = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: prayogResult.orderId || orderId,
        awbNumber: prayogResult.shipments?.[0]?.awbNumber || null,
        trackingId: prayogResult.shipments?.[0]?.awbNumber || orderId,
        status: prayogResult.orderStatus || 'CONFIRMED',
        message: 'Booking created successfully',
        prayogResponse: prayogResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error creating Prayog booking:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
