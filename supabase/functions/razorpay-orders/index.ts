import { getEnvironmentFromRequest, getRazorpayConfig } from "../_shared/environment.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-environment',
};

interface OrdersRequest {
  action: 'fetch' | 'fetchAll' | 'update' | 'fetchPayments' | 'fetchPayment';
  paymentId?: string;
  orderId?: string;
  notes?: Record<string, string>;
  filters?: {
    authorized?: number;
    receipt?: string;
    from?: number;
    to?: number;
    count?: number;
    skip?: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody: OrdersRequest = await req.json();
    const { action, orderId, notes, filters, paymentId } = requestBody as any;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required. Use: fetch, fetchAll, update, or fetchPayments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get environment-specific Razorpay config
    const env = getEnvironmentFromRequest(req);
    const razorpayConfig = getRazorpayConfig(env);
    
    console.log(`[razorpay-orders] Using ${env} environment, action: ${action}`);

    if (!razorpayConfig.keyId || !razorpayConfig.keySecret) {
      console.error(`Razorpay credentials not configured for ${env} environment`);
      return new Response(
        JSON.stringify({ error: `Payment service not configured for ${env} environment` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = btoa(`${razorpayConfig.keyId}:${razorpayConfig.keySecret}`);
    const baseHeaders = {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    };

    let response: Response;
    let endpoint: string;

    switch (action) {
      case 'fetch': {
        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required for fetch action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `https://api.razorpay.com/v1/orders/${orderId}`;
        console.log(`[razorpay-orders] Fetching order: ${orderId}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: baseHeaders,
        });
        break;
      }

      case 'fetchAll': {
        const queryParams = new URLSearchParams();
        if (filters) {
          if (filters.authorized !== undefined) queryParams.append('authorized', String(filters.authorized));
          if (filters.receipt) queryParams.append('receipt', filters.receipt);
          if (filters.from) queryParams.append('from', String(filters.from));
          if (filters.to) queryParams.append('to', String(filters.to));
          if (filters.count) queryParams.append('count', String(filters.count));
          if (filters.skip) queryParams.append('skip', String(filters.skip));
        }
        
        endpoint = `https://api.razorpay.com/v1/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        console.log(`[razorpay-orders] Fetching all orders with filters:`, filters);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: baseHeaders,
        });
        break;
      }

      case 'update': {
        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (!notes) {
          return new Response(
            JSON.stringify({ error: 'notes object is required for update action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        endpoint = `https://api.razorpay.com/v1/orders/${orderId}`;
        console.log(`[razorpay-orders] Updating order: ${orderId} with notes:`, notes);
        
        response = await fetch(endpoint, {
          method: 'PATCH',
          headers: baseHeaders,
          body: JSON.stringify({ notes }),
        });
        break;
      }

      case 'fetchPayments': {
        if (!orderId) {
          return new Response(
            JSON.stringify({ error: 'orderId is required for fetchPayments action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        endpoint = `https://api.razorpay.com/v1/orders/${orderId}/payments`;
        console.log(`[razorpay-orders] Fetching payments for order: ${orderId}`);
        
        response = await fetch(endpoint, {
          method: 'GET',
          headers: baseHeaders,
        });
        break;
      }

      case 'fetchPayment': {
        if (!paymentId) {
          return new Response(
            JSON.stringify({ error: 'paymentId is required for fetchPayment action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        endpoint = `https://api.razorpay.com/v1/payments/${paymentId}`;
        console.log(`[razorpay-orders] Fetching payment: ${paymentId}`);
        response = await fetch(endpoint, { method: 'GET', headers: baseHeaders });
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Invalid action: ${action}. Use: fetch, fetchAll, update, or fetchPayments` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error(`[razorpay-orders] API error for ${action}:`, data);
      return new Response(
        JSON.stringify({ error: data.error?.description || `Failed to ${action} order(s)` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[razorpay-orders] ${action} successful`);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[razorpay-orders] Error:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
