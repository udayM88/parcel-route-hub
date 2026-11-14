import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {z} from 'npm:zod@3';
import {calculateB2B,validateCard,tierFor} from '../_shared/b2b-pricing.ts';
const headers={...corsHeaders,'Content-Type':'application/json'};
const json=(b:unknown,status=200)=>new Response(JSON.stringify(b),{headers,status});
const slab=z.object({upper_weight_g:z.number().int().positive().max(1000000),fee_per_500g_paise:z.number().int().nonnegative().max(10000000)});
const tier=z.object({tier:z.number().int().min(1).max(4),name:z.string().min(1).max(60),min_shipments:z.number().int().nonnegative(),max_shipments:z.number().int().nonnegative().nullable(),booking_fee_paise:z.number().int().nonnegative().nullable(),enabled:z.boolean(),slabs:z.array(slab)});
const schemas={
  save_version:z.object({name:z.string().min(1).max(150),effective_from:z.string().datetime(),effective_until:z.string().datetime().nullable().optional(),enabled:z.boolean(),service_gst_bps:z.literal(1800),tiers:z.array(tier).length(4)}),
  publish:z.object({id:z.string().uuid()}),
  save_card:z.object({business_account_id:z.string().uuid(),name:z.string().min(1).max(150),kind:z.enum(['customer','enterprise','heavy']),booking_fee_paise:z.number().int().nonnegative(),slabs:z.array(slab).min(1),effective_from:z.string().datetime(),effective_until:z.string().datetime().nullable(),enabled:z.boolean(),status:z.enum(['draft','approved'])}),
  override:z.object({business_account_id:z.string().uuid(),tier:z.number().int().min(1).max(4),effective_from:z.string().datetime(),effective_until:z.string().datetime().nullable(),reason:z.string().min(3).max(500)}),
  save_rule:z.object({partner_code:z.enum(['delhivery','shree_maruti','xpressbees','shadowfax','urbanebolt']),service_code:z.string().min(1).max(100),volumetric_divisor:z.number().int().positive(),minimum_weight_g:z.number().int().positive(),billing_increment_g:z.number().int().positive(),package_rule:z.enum(['sum_billed','per_package']),freight_tax_treatment:z.enum(['inclusive','exclusive']),freight_gst_bps:z.literal(1800),enabled:z.boolean(),effective_from:z.string().datetime(),effective_until:z.string().datetime().nullable(),evidence:z.string().min(10).max(1000)}),
  preview:z.object({card:z.object({booking_fee_paise:z.number().int().nonnegative(),slabs:z.array(slab).min(1)}),weight_kg:z.number().positive().max(1000),freight:z.number().nonnegative(),freight_tax_treatment:z.enum(['inclusive','exclusive'])})
};
function validDates(b:any) {if(b.effective_until && new Date(b.effective_until)<=new Date(b.effective_from)) throw new Error('Expiry must be later than the effective date');}
function validateTiers(tiers:any[]) {
  const ordered=[...tiers].sort((a,b)=>a.tier-b.tier);
  let next=0;
  for(const [i,t] of ordered.entries()) {
    if(t.tier!==i+1 || t.min_shipments!==next || (i<3 && (t.max_shipments==null || t.max_shipments<t.min_shipments)) || (i===3 && t.max_shipments!==null)) throw new Error('Tier thresholds must be contiguous, start at zero and end with Enterprise');
    if(i<3) {validateCard({booking_fee_paise:t.booking_fee_paise,slabs:t.slabs}); if(t.slabs.at(-1)?.upper_weight_g!==25000) throw new Error('Standard tiers must end at 25kg');}
    else if(t.booking_fee_paise!==null || t.slabs.length) throw new Error('Enterprise requires approved custom rates');
    next=(t.max_shipments || 0)+1;
  }
  tierFor(0,ordered);
}
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers});
  if(req.method!=='POST') return json({error:'Use POST'},405);
  try {
    const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url || !key) return json({error:'Pricing unavailable'},503);
    const db=createClient(url,key);
    const {data:u,error:ue}=await db.auth.getUser((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i,''));
    if(ue || !u.user) return json({error:'Sign in required'},401);
    const {data:staff}=await db.from('admin_users').select('role').eq('user_id',u.user.id).eq('is_active',true).maybeSingle();
    if(staff?.role!=='super_admin') return json({error:'Super admin pricing permission required'},403);
    const body=await req.json();
    const action=body.action || 'list';
    if(action==='list') {
      const names=['b2b_pricing_versions','b2b_pricing_tiers','b2b_pricing_slabs','b2b_customer_rate_cards','b2b_tier_overrides','b2b_courier_pricing_rules','b2b_pricing_audit_logs'];
      const pairs=await Promise.all(names.map(async name=>{const {data,error}=await db.from(name).select('*').order('created_at',{ascending:false}).limit(500);if(error) throw error;return [name,data];}));
      const {data:businesses}=await db.from('business_accounts').select('id,company_name').eq('is_active',true).order('company_name').limit(1000);
      let revenue=0; let start=0;
      while(true) {const {data,error}=await db.from('bookings').select('platform_fee').eq('account_type','business').eq('payment_status','paid').not('status','in','(FAILED,CANCELLED,PENDING_PAYMENT,PAYMENT_ABANDONED)').range(start,start+999);if(error) throw error;revenue+=(data || []).reduce((sum,b)=>sum+Number(b.platform_fee || 0),0);if(!data || data.length<1000) break;start+=1000;}
      return json({...Object.fromEntries(pairs),businesses,platform_revenue:Math.round(revenue*100)/100});
    }
    const schema=schemas[action as keyof typeof schemas];
    if(!schema) return json({error:'Unknown pricing action'},400);
    const parsed=schema.safeParse(body.payload);
    if(!parsed.success) return json({error:parsed.error.flatten()},400);
    const b:any=parsed.data;
    if(action==='preview') {
      const result=calculateB2B({parcels:[{weight_kg:b.weight_kg}],freight_paise:[Math.round(b.freight*100)],card:b.card,rule:{volumetric_divisor:5000,minimum_weight_g:500,billing_increment_g:500,package_rule:'sum_billed',freight_tax_treatment:b.freight_tax_treatment,freight_gst_bps:1800},service_gst_bps:1800});
      return json({preview:result});
    }
    if(action==='publish') {
      const {data:v}=await db.from('b2b_pricing_versions').select('*').eq('id',b.id).single();
      if(!v || v.status!=='draft') throw new Error('Only a draft version can be published');
      const {data:tiers}=await db.from('b2b_pricing_tiers').select('*,b2b_pricing_slabs(*)').eq('version_id',b.id);
      validateTiers((tiers || []).map(t=>({...t,slabs:t.b2b_pricing_slabs.sort((a:any,b:any)=>a.upper_weight_g-b.upper_weight_g)})));
      const {error}=await db.from('b2b_pricing_versions').update({status:'published',approved_by:u.user.id}).eq('id',b.id).eq('status','draft');if(error) throw error;
    } else if(action==='save_version') {
      validDates(b);validateTiers(b.tiers);
      const {tiers,...values}=b;
      const {data:v,error}=await db.from('b2b_pricing_versions').insert({...values,created_by:u.user.id}).select('id').single();if(error) throw error;
      for(const t of tiers) {
        const {slabs,...fields}=t;
        const {data:row,error:te}=await db.from('b2b_pricing_tiers').insert({...fields,version_id:v.id}).select('id').single();if(te) throw te;
        if(slabs.length) {const {error:se}=await db.from('b2b_pricing_slabs').insert(slabs.map((s:any)=>({...s,tier_id:row.id})));if(se) throw se;}
      }
      return json({success:true,id:v.id});
    } else {
      validDates(b);
      const table=action==='save_card'?'b2b_customer_rate_cards':action==='override'?'b2b_tier_overrides':'b2b_courier_pricing_rules';
      if(action==='save_card') validateCard(b);
      const values={...b,...(action!=='save_rule'?{created_by:u.user.id}:{}),...(action==='save_card' && b.status==='approved'?{approved_by:u.user.id}:{})};
      const {error}=await db.from(table).insert(values);if(error) throw error;
    }
    const {error:ae}=await db.from('b2b_pricing_audit_logs').insert({actor_user_id:u.user.id,resource_type:'admin_pricing',resource_id:b.id || b.business_account_id || action,action,after_value:b});if(ae) throw ae;
    return json({success:true});
  } catch(e) {return json({error:e instanceof Error?e.message:'Pricing action failed'},400);}
});