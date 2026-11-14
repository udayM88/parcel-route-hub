import {assertEquals,assertRejects} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {requestFingerprint,loadB2BQuote,safeQuote} from '../_shared/b2b-quotes.ts';
import {merchantCan} from '../_shared/merchant-access.ts';
const request={pickup_pincode:'411001',delivery_pincode:'400001',boxes:[{weight_kg:1}]};
Deno.test('Quote identity changes when actual shipment weight changes',async()=>{
  const first=await requestFingerprint(request);const changed=await requestFingerprint({...request,boxes:[{weight_kg:2}]});assertEquals(first===changed,false);
});
Deno.test('Expired unaccepted quote is rejected',async()=>{
  const q={expires_at:'2000-01-01T00:00:00Z',booking_id:null};const db={from:()=>({select:()=>({eq:()=>({eq:()=>({eq:()=>({maybeSingle:()=>Promise.resolve({data:q})})})})})})};
  await assertRejects(()=>loadB2BQuote(db,'quote','business','sandbox'),Error,'expired');
});
Deno.test('Accepted quote survives expiry for checkout retries',async()=>{
  const q={expires_at:'2000-01-01T00:00:00Z',booking_id:'booking'};const db={from:()=>({select:()=>({eq:()=>({eq:()=>({eq:()=>({maybeSingle:()=>Promise.resolve({data:q})})})})})})};
  assertEquals((await loadB2BQuote(db,'quote','business','sandbox')).booking_id,'booking');
});
Deno.test('Public quote strips private procurement and platform earnings',()=>{
  const q=safeQuote({id:'q',expires_at:'2030-01-01',snapshot:{net_paise:13000,gst_paise:2340,total_paise:15340,chargeable_weight_g:500,freight_net_paise:10000,platform_fee_paise:3000}});
  assertEquals(q.total_amount,153.4);assertEquals('freight_net_paise' in q,false);assertEquals('platform_fee_paise' in q,false);
});
Deno.test('Viewer cannot edit pricing or create orders',()=>{
  const access={role:'viewer',permissions:['orders:read'],business_account_id:'biz',member_id:null,user:{} as any};
  assertEquals(merchantCan(access,'orders:read'),true);assertEquals(merchantCan(access,'orders:write'),false);assertEquals(merchantCan(null,'orders:read'),false);
});