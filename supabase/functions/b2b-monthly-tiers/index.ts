import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders} from 'npm:@supabase/supabase-js@2/cors';
import {pricingContext} from '../_shared/b2b-quotes.ts';
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  const secret=Deno.env.get('CRON_SECRET');
  if(!secret || req.headers.get('x-cron-secret')!==secret) return new Response('Unauthorized',{status:401,headers:corsHeaders});
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url || !key) return new Response('Unavailable',{status:503,headers:corsHeaders});
  const db=createClient(url,key);let count=0;const errors:string[]=[];
  for(let from=0;;from+=1000) {
    const {data,error}=await db.from('business_accounts').select('id').eq('is_active',true).eq('status','approved').range(from,from+999);
    if(error) throw error;
    for(const b of data || []) {try {await pricingContext(db,b.id);count++;}catch(e){errors.push(e instanceof Error?e.message:'Tier failed');}}
    if(!data || data.length<1000) break;
  }
  return new Response(JSON.stringify({processed:count,errors}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
});