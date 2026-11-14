import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {z} from 'npm:zod@3';
import {resolveMerchantAccess,merchantCan} from '../_shared/merchant-access.ts';
import {pricingContext,createB2BQuotes} from '../_shared/b2b-quotes.ts';
const bodySchema=z.object({action:z.enum(['summary','quote']).default('summary'),pickup_pincode:z.string().regex(/^\d{6}$/).optional(),delivery_pincode:z.string().regex(/^\d{6}$/).optional(),boxes:z.array(z.object({weight_kg:z.number().positive().max(100),length_cm:z.number().positive().max(300).optional(),width_cm:z.number().positive().max(300).optional(),height_cm:z.number().positive().max(300).optional()})).min(1).max(50).optional()});
const headers={...corsHeaders,'Access-Control-Allow-Headers':`${corsHeaders['Access-Control-Allow-Headers']}, x-environment`,'Content-Type':'application/json'};
const json=(b:unknown,status=200)=>new Response(JSON.stringify(b),{status,headers});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return json({error:'Use POST'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anon=Deno.env.get('SUPABASE_ANON_KEY');
    if(!url || !service || !anon) return json({error:'Pricing service unavailable'},503);
    const db=createClient(url,service);
    const token=(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i,'');
    const {data,error}=await db.auth.getUser(token);
    if(error || !data.user) return json({error:'Sign in required'},401);
    const access=await resolveMerchantAccess(db,data.user);
    if(!access || !merchantCan(access,'orders:read')) return json({error:'Business pricing access required'},403);
    const parsed=bodySchema.safeParse(await req.json());
    if(!parsed.success) return json({error:parsed.error.flatten()},400);
    const b=parsed.data;
    if(b.action==='quote') {
      if(!b.boxes || !b.pickup_pincode || !b.delivery_pincode) return json({error:'Pincodes and parcels required'},400);
      const environment=req.headers.get('x-environment')==='sandbox'?'sandbox':'production';
      return json(await createB2BQuotes(db,url,anon,access.business_account_id,environment,{pickup_pincode:b.pickup_pincode,delivery_pincode:b.delivery_pincode,boxes:b.boxes}));
    }
    const c=await pricingContext(db,access.business_account_id);
    const next=c.tiers?.find((t:any)=>t.tier===c.tier.tier+1);
    const cards=c.cards.filter((card:any)=>card.enabled && card.status==='approved' && card.approved_by && new Date(card.effective_from)<=new Date() && (!card.effective_until || new Date(card.effective_until)>new Date()));
    return json({tier:c.tier.tier,tier_name:c.tier.name,booking_fee_paise:c.tier.booking_fee_paise,previous_completed:c.month.completed_shipments,current_completed:c.month.current_completed,missing_completion_evidence:c.month.missing_completion_evidence,next_tier:next?.name || null,shipments_to_next:next?Math.max(0,next.min_shipments-c.month.current_completed):0,tiers:c.tiers.map((t:any)=>({tier:t.tier,name:t.name,min_shipments:t.min_shipments,max_shipments:t.max_shipments,booking_fee_paise:t.booking_fee_paise,enabled:t.enabled,slabs:t.b2b_pricing_slabs})),custom_cards:cards.map((card:any)=>({name:card.name,kind:card.kind,booking_fee_paise:card.booking_fee_paise,slabs:card.slabs,effective_until:card.effective_until})),override:!!c.override});
  } catch(e) { return json({error:e instanceof Error?e.message:'Pricing unavailable'},422); }
});