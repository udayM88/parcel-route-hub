import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,RefreshCw,TrendingUp} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Badge} from '@/components/ui/badge';
import {businessPricingSummary,formatBusinessMoney,type PricingSummary} from '@/lib/business-pricing';
import {isBusinessDemoSession} from '@/lib/business-demo';
import PageSeo from '@/components/PageSeo';
const money=(p:number|null)=>p==null?'Custom':formatBusinessMoney(p/100);
export function BusinessTierSummary({compact=false}:{compact?:boolean}) {
  const [summary,setSummary]=useState<PricingSummary|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);setError('');try{if(isBusinessDemoSession()){setError('Live tier assessment is unavailable in the sample account.');return;}setSummary(await businessPricingSummary());}catch(e){setError(e instanceof Error?e.message:'Pricing unavailable');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  if(loading) return <p className="py-4 text-sm text-muted-foreground">Loading pricing…</p>;
  if(error) return <div className="flex items-center justify-between gap-3 border-b py-4"><p className="text-sm text-muted-foreground">{error}</p><Button variant="ghost" size="icon" aria-label="Retry pricing" onClick={load}><RefreshCw className="size-4"/></Button></div>;
  if(!summary) return null;
  return <section className="space-y-6 border-y py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><TrendingUp className="size-5 text-primary"/>{summary.tier_name} pricing <Badge variant="outline">Tier {summary.tier}</Badge></h2>{summary.override && <p className="mt-1 text-sm text-muted-foreground">Approved tier override active</p>}</div>{compact && <Button variant="outline" asChild><Link to="/viasetuforbusinesses/pricing">Pricing &amp; Tiers<ArrowRight className="size-4"/></Link></Button>}</div>
    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">{[['Previous month completed',summary.previous_completed],['This month completed',summary.current_completed],['Booking fee',money(summary.booking_fee_paise)],['To next tier',summary.next_tier?`${summary.shipments_to_next} shipments`:'Custom Enterprise Pricing']].map(([label,value])=><div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>)}</div>
    {summary.next_tier && <p className="text-sm text-muted-foreground">Complete {summary.shipments_to_next} more shipments this month to qualify for {summary.next_tier} next month.</p>}
    {summary.tier===4 && !summary.custom_cards.some(c=>c.kind==='enterprise') && <p className="text-sm text-destructive">An approved Enterprise rate card is required before booking. Contact your account manager.</p>}
    {!compact && <TierComparison summary={summary}/>}
  </section>;
}
function TierComparison({summary}:{summary:PricingSummary}) {
  const [weight,setWeight]=useState('1');
  const earnings=(t:PricingSummary['tiers'][number])=>{
    if(t.booking_fee_paise==null || Number(weight)>25 || !(Number(weight)>0)) return 'Custom quote';
    let lower=0,total=t.booking_fee_paise;const g=Math.ceil(Number(weight)*2)*500;
    for(const slab of [...t.slabs].sort((a,b)=>a.upper_weight_g-b.upper_weight_g)){total+=Math.max(0,Math.min(g,slab.upper_weight_g)-lower)/500*slab.fee_per_500g_paise;lower=slab.upper_weight_g;}
    return money(total);
  };
  return <div className="space-y-6"><div className="flex items-end gap-3"><div className="space-y-2"><Label htmlFor="tier-estimate">Chargeable weight (kg)</Label><Input id="tier-estimate" type="number" min="0.01" step="0.5" value={weight} onChange={e=>setWeight(e.target.value)} className="max-w-48"/></div><Button asChild variant="outline"><Link to="/viasetuforbusinesses/module/rate-calculator">Shipping estimate<ArrowRight className="size-4"/></Link></Button></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{summary.tiers.map(t=><article key={t.tier} className="space-y-4 rounded-lg border bg-card p-5"><div className="flex justify-between"><h3 className="font-semibold">{t.name}</h3>{summary.tier===t.tier && <Badge>Current</Badge>}</div><p className="text-sm text-muted-foreground">{t.max_shipments==null?`${t.min_shipments}+`:`${t.min_shipments}–${t.max_shipments}`} completed / month</p><p className="text-sm">Booking fee <strong>{money(t.booking_fee_paise)}</strong></p><div className="border-t pt-3"><p className="text-xs text-muted-foreground">Service charges at {weight || '0'} kg, excl. GST</p><p className="mt-1 text-xl font-semibold">{earnings(t)}</p></div><dl className="space-y-2 text-xs">{[...t.slabs].sort((a,b)=>a.upper_weight_g-b.upper_weight_g).map((s,i,array)=><div key={s.upper_weight_g} className="flex justify-between gap-2"><dt>{i?`${array[i-1].upper_weight_g/1000}–`:'First '}{s.upper_weight_g/1000} kg</dt><dd>{money(s.fee_per_500g_paise)} / 500g</dd></div>)}</dl>{!t.enabled && <Badge variant="destructive">Disabled</Badge>}</article>)}</div>
    <p className="text-sm text-muted-foreground">Charges are progressive and exclude courier freight and GST. Above 25 kg requires approved heavy-shipment pricing. The booking fee is charged once per shipment.</p>
    {summary.custom_cards.map(c=><div key={c.name} className="border-t py-4"><h3 className="font-semibold">{c.name}</h3><p className="text-sm text-muted-foreground">Approved {c.kind} card · booking fee {money(c.booking_fee_paise)}{c.effective_until?` · valid until ${new Date(c.effective_until).toLocaleDateString('en-IN')}`:''}</p></div>)}
  </div>;
}
export default function BusinessPricing(){return <main className="space-y-6"><PageSeo title="Pricing & Tiers | ViaSetu for Businesses" description="Your business shipping tiers and progressive service charges." path="/viasetuforbusinesses/pricing"/><h1 className="text-2xl font-bold">Pricing &amp; Tiers</h1><BusinessTierSummary/></main>;}