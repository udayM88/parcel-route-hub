import { approvedCard, billableWeight, calculateB2B, paise, type Parcel } from './b2b-pricing.ts';
const PARTNERS = ['delhivery','shree_maruti','xpressbees','shadowfax','urbanebolt'];
export async function pricingContext(db: any, businessId: string) {
  const now = new Date().toISOString();
  const { data: versions, error } = await db.from('b2b_pricing_versions').select('*').eq('status','published').eq('enabled',true).lte('effective_from',now).order('effective_from',{ascending:false});
  if (error) throw error;
  const version = versions?.find((v:any) => !v.effective_until || v.effective_until>now);
  if (!version) throw new Error('Business pricing is not configured');
  const { data: tiers, error: te } = await db.from('b2b_pricing_tiers').select('*,b2b_pricing_slabs(*)').eq('version_id',version.id).order('tier');
  if (te) throw te;
  const { data: month, error: me } = await db.rpc('b2b_resolve_month',{_business_id:businessId,_version_id:version.id});
  if (me) throw me;
  const { data: overrides } = await db.from('b2b_tier_overrides').select('*').eq('business_account_id',businessId).lte('effective_from',now).order('effective_from',{ascending:false});
  const override = overrides?.find((o:any)=>!o.effective_until || o.effective_until>now);
  const tier = tiers?.find((t:any)=>t.tier===(override?.tier || month.tier));
  if (!tier || !tier.enabled) throw new Error('Applicable business tier is disabled or unavailable');
  const {data:cards} = await db.from('b2b_customer_rate_cards').select('*').eq('business_account_id',businessId);
  return {version,tiers,tier,month,cards:cards || [],override};
}
export async function requestFingerprint(request: unknown) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(request)));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function safeQuote(row:any) {
  const s=row.snapshot;
  return { quote_id:row.id, expires_at:row.expires_at, partner_code:s.partner_code, partner_id:s.partner_id, partner_name:s.partner_name, service_code:s.service_code, service_name:s.service_name, delivery_time:s.delivery_time, amount_excl_gst:s.net_paise/100, gst:s.gst_paise/100, total_amount:s.total_paise/100, chargeable_weight_kg:s.chargeable_weight_g/1000, tier:s.tier, currency:'INR' };
}
export async function createB2BQuotes(db:any, url:string, anon:string, businessId:string, environment:string, request:{pickup_pincode:string;delivery_pincode:string;boxes:Parcel[]}) {
  const context=await pricingContext(db,businessId);
  const now=new Date().toISOString();
  const {data:global,error:ge}=await db.from('system_settings').select('value').eq('key','courier_partners').maybeSingle();
  if(ge) throw new Error('Unable to load courier eligibility');
  const {data:preferences,error:pe}=await db.from('merchant_console_settings').select('settings').eq('business_account_id',businessId).eq('category','carrier_selection').maybeSingle();
  if(pe) throw new Error('Unable to load merchant courier eligibility');
  const {data:rules,error:re}=await db.from('b2b_courier_pricing_rules').select('*').eq('enabled',true).lte('effective_from',now).order('effective_from',{ascending:false});
  if(re) throw re;
  const active=PARTNERS.filter(code=>global?.value?.[code]?.enabled!==false && preferences?.settings?.[code]!==false);
  const fingerprint=await requestFingerprint(request);
  const blocked:string[]=[];
  const results=await Promise.all(active.map(async code=>{
    try {
      const applicable=rules?.filter((r:any)=>r.partner_code===code && (!r.effective_until || r.effective_until>now)) || [];
      if(!applicable.length) throw new Error('Courier billing/tax configuration required');
      const responses=await Promise.all(request.boxes.map(async box=>{
        const response=await fetch(`${url}/functions/v1/${code.replace(/_/g,'-')}-serviceability`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${anon}`,apikey:anon,'x-environment':environment},body:JSON.stringify({...box,pickup_pincode:request.pickup_pincode,delivery_pincode:request.delivery_pincode}),signal:AbortSignal.timeout(30000)});
        const d=await response.json();
        return response.ok && d.is_serviceable===true && d.partner ? d : null;
      }));
      if(responses.some(r=>!r)) return [];
      const first=responses[0];
      if(!first) return [];
      const quotes=[];
      for(const service of first.partner.services || []) {
        const matched=responses.map(d=>d?.partner.services?.find((s:any)=>s.service_code===service.service_code));
        if(matched.some(s=>!s)) continue;
        const rule=applicable.find((r:any)=>r.service_code===service.service_code) || applicable.find((r:any)=>r.service_code==='*');
        if(!rule) continue;
        const rates=matched.map(s=>paise(Number(s.rate?.price?.amount)));
        if(rates.some(r=>!Number.isSafeInteger(r) || r<=0)) continue;
        const reported=responses.map((d,i)=>{
          const m={...d?.partner.metadata,...matched[i]?.metadata};
          return Number(m.chargeable_g || m.chargeable_weight_g || (m.chargeable_weight_kg ? m.chargeable_weight_kg*1000 : 0));
        });
        const weight=request.boxes.reduce((sum,b,i)=>sum+billableWeight(b,rule,reported[i]).billed_weight_g,0);
        const custom=approvedCard(context.cards,context.tier.tier,weight);
        const card=custom || {booking_fee_paise:Number(context.tier.booking_fee_paise),slabs:[...(context.tier.b2b_pricing_slabs || [])].sort((a:any,b:any)=>a.upper_weight_g-b.upper_weight_g)};
        const calculated=calculateB2B({parcels:request.boxes,freight_paise:rates,reported_weights_g:reported,rule,card,service_gst_bps:context.version.service_gst_bps});
        const snapshot={...calculated,tier:context.tier.tier,version_id:context.version.id,custom_card_id:custom?.id || null,partner_code:code,partner_id:first.partner.partner_id,partner_name:first.partner.partner_name,service_code:service.service_code,service_name:service.service_name || 'Standard',delivery_time:service.delivery_label || (service.tat_days ? `${service.tat_days} days` : '2-5 days'),rule,quoted_at:now};
        const {data:row,error:qe}=await db.from('b2b_quotes').insert({business_account_id:businessId,version_id:context.version.id,environment,request_fingerprint:fingerprint,request,snapshot,expires_at:new Date(Date.now()+30*60*1000).toISOString()}).select('*').single();
        if(qe) throw qe;
        quotes.push(safeQuote(row));
      }
      return quotes;
    } catch(e) { blocked.push(`${code}: ${e instanceof Error ? e.message : 'Quote unavailable'}`); return []; }
  }));
  return {quotes:results.flat().sort((a,b)=>a.total_amount-b.total_amount),blocked};
}
export async function loadB2BQuote(db:any,id:string,businessId:string,environment:string) {
  const {data:q,error}=await db.from('b2b_quotes').select('*').eq('id',id).eq('business_account_id',businessId).eq('environment',environment).maybeSingle();
  if(error || !q) throw new Error('Business quote not found');
  if(!q.booking_id && new Date(q.expires_at)<=new Date()) throw new Error('Quote expired. Please fetch rates again.');
  return q;
}