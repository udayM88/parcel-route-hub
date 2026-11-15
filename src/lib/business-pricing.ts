import {supabase} from '@/integrations/supabase/client';
import {CURRENT_ENV} from '@/config/environment';
export interface BusinessQuote { quote_id:string;partner_id:string;partner_code:string;partner_name:string;service_code:string;service_name:string;delivery_time:string;amount_excl_gst:number;gst:number;total_amount:number;chargeable_weight_kg:number;expires_at:string }
export interface BusinessTier {tier:number;name:string;min_shipments:number;max_shipments:number|null;booking_fee_paise:number|null;enabled:boolean;slabs:{upper_weight_g:number;fee_per_500g_paise:number}[]}
export interface PricingSummary {monthly_shipping_expenditure?:number;tier:number;tier_name:string;booking_fee_paise:number|null;previous_completed:number;current_completed:number;shipments_to_next:number;next_tier:string|null;missing_completion_evidence:number;tiers:BusinessTier[];custom_cards:{name:string;kind:string;booking_fee_paise:number;slabs:{upper_weight_g:number;fee_per_500g_paise:number}[];effective_until:string|null}[];override:boolean}
export async function businessPricingSummary():Promise<PricingSummary> {
  const {data,error}=await supabase.functions.invoke('business-pricing',{body:{action:'summary'}});
  if(error || data?.error) throw new Error(data?.error || error?.message || 'Pricing unavailable');
  return data;
}
export async function businessQuotes(request:{pickup_pincode:string;delivery_pincode:string;boxes:{weight_kg:number;length_cm?:number;width_cm?:number;height_cm?:number}[]}):Promise<BusinessQuote[]> {
  const {data,error}=await supabase.functions.invoke('business-pricing',{body:{action:'quote',...request},headers:{'x-environment':CURRENT_ENV}});
  if(error || data?.error) throw new Error(data?.error || error?.message || 'Could not fetch business quotes');
  if(!data.quotes?.length && data.blocked?.length) throw new Error(data.blocked.join('; '));
  return data.quotes || [];
}
export const formatBusinessMoney=(value:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(value);