// Currency is integer paise; all configuration is supplied by the pricing database.
export type Slab = { upper_weight_g: number; fee_per_500g_paise: number };
export type Card = { booking_fee_paise: number; slabs: Slab[] };
export type Parcel = { weight_kg: number; length_cm?: number; width_cm?: number; height_cm?: number };
export type BillingRule = { volumetric_divisor: number; minimum_weight_g: number; billing_increment_g: number; package_rule: string; freight_tax_treatment: string; freight_gst_bps: number };
export const paise = (amount: number) => Math.round(amount * 100);
export const tax = (amount: number, bps: number) => Math.round(amount * bps / 10000);
export function tierFor(count: number, tiers: { tier: number; min_shipments: number; max_shipments: number | null }[]) {
  const tier = [...tiers].sort((a, b) => b.min_shipments - a.min_shipments).find(t => count >= t.min_shipments && (t.max_shipments == null || count <= t.max_shipments));
  if (!tier) throw new Error('No pricing tier configured for this volume');
  return tier.tier;
}
export function validateCard(card: Card) {
  if (!Number.isSafeInteger(card.booking_fee_paise) || card.booking_fee_paise < 0 || !card.slabs.length) throw new Error('Invalid booking fee or missing weight slabs');
  let previous = 0;
  for (const slab of card.slabs) {
    if (!Number.isSafeInteger(slab.upper_weight_g) || slab.upper_weight_g <= previous || slab.upper_weight_g % 500 || !Number.isSafeInteger(slab.fee_per_500g_paise) || slab.fee_per_500g_paise < 0) throw new Error('Slabs must increase in 500g increments with non-negative paise charges');
    previous = slab.upper_weight_g;
  }
}
export function progressiveFee(weightG: number, card: Card) {
  validateCard(card);
  if (!Number.isFinite(weightG) || weightG <= 0) throw new Error('Shipment weight must be positive');
  const rounded = Math.ceil(weightG / 500) * 500;
  let lower = 0, fee = 0;
  const breakdown: { from_g: number; to_g: number; increments: number; fee_paise: number }[] = [];
  for (const slab of card.slabs) {
    const portion = Math.max(0, Math.min(rounded, slab.upper_weight_g) - lower);
    if (portion) {
      const part = portion / 500 * slab.fee_per_500g_paise;
      fee += part;
      breakdown.push({ from_g: lower, to_g: lower + portion, increments: portion / 500, fee_paise: part });
    }
    lower = slab.upper_weight_g;
  }
  if (rounded > lower) throw new Error('Approved heavy-shipment rate card required');
  return { rounded_weight_g: rounded, weight_fee_paise: fee, platform_fee_paise: fee + card.booking_fee_paise, breakdown };
}
export function billableWeight(parcel: Parcel, rule: BillingRule, reportedG?: number) {
  if (!(parcel.weight_kg > 0) || !(rule.volumetric_divisor > 0) || !(rule.billing_increment_g > 0)) throw new Error('Missing courier weight configuration');
  const actual = Math.ceil(parcel.weight_kg * 1000);
  const volumetric = Math.ceil((parcel.length_cm || 0) * (parcel.width_cm || 0) * (parcel.height_cm || 0) / rule.volumetric_divisor * 1000);
  const raw = Math.max(actual, volumetric, rule.minimum_weight_g);
  const billed = reportedG && reportedG >= raw ? Math.ceil(reportedG) : Math.ceil(raw / rule.billing_increment_g) * rule.billing_increment_g;
  return { actual_weight_g: actual, volumetric_weight_g: volumetric, billed_weight_g: billed };
}
export function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a,b) => a+b,0);
  if (!Number.isSafeInteger(total) || total < 0 || !sum) throw new Error('Invalid price allocation');
  const result = weights.map(w => Math.floor(total * w / sum));
  let remainder = total - result.reduce((a,b) => a+b,0);
  for (let i=0; remainder>0; i=(i+1)%result.length, remainder--) result[i]++;
  return result;
}
export function calculateB2B(input: { parcels: Parcel[]; freight_paise: number[]; reported_weights_g?: number[]; rule: BillingRule; card: Card; service_gst_bps: number }) {
  const { parcels, freight_paise, rule, card } = input;
  if (!parcels.length || parcels.length !== freight_paise.length || freight_paise.some(r => !Number.isSafeInteger(r) || r < 0)) throw new Error('Invalid freight or parcel count');
  if (!['exclusive','inclusive'].includes(rule.freight_tax_treatment)) throw new Error('Missing freight GST treatment');
  const weights = parcels.map((p,i) => billableWeight(p,rule,input.reported_weights_g?.[i]));
  const billed = weights.map(w => w.billed_weight_g);
  const combined = billed.reduce((a,b) => a+b,0);
  const fee = progressiveFee(combined, card);
  if (rule.package_rule === 'per_package') {
    fee.weight_fee_paise = billed.reduce((sum,w) => sum + progressiveFee(w,card).weight_fee_paise,0);
    fee.platform_fee_paise = fee.weight_fee_paise + card.booking_fee_paise;
  } else if (rule.package_rule !== 'sum_billed') throw new Error('Unsupported multi-package billing rule');
  const freightNet = freight_paise.map(r => rule.freight_tax_treatment === 'inclusive' ? Math.round(r * 10000 / (10000 + rule.freight_gst_bps)) : r);
  const freightGst = freight_paise.map((r,i) => rule.freight_tax_treatment === 'inclusive' ? r-freightNet[i] : tax(r,rule.freight_gst_bps));
  const serviceGst = tax(fee.platform_fee_paise,input.service_gst_bps);
  const platformAllocation = allocate(fee.platform_fee_paise,billed);
  const serviceTaxAllocation = allocate(serviceGst,billed);
  const boxes = parcels.map((p,i) => ({ ...p, ...weights[i], freight_net_paise: freightNet[i], freight_gst_paise: freightGst[i], platform_fee_paise: platformAllocation[i], total_paise: freightNet[i]+freightGst[i]+platformAllocation[i]+serviceTaxAllocation[i] }));
  const freight_net_paise = freightNet.reduce((a,b)=>a+b,0);
  const gst_paise = freightGst.reduce((a,b)=>a+b,0)+serviceGst;
  const net_paise = freight_net_paise+fee.platform_fee_paise;
  return { ...fee, booking_fee_paise: card.booking_fee_paise, chargeable_weight_g: combined, freight_net_paise, gst_paise, service_gst_paise: serviceGst, net_paise, total_paise: net_paise+gst_paise, boxes };
}
export function approvedCard(cards: any[], tier: number, weightG: number, now = new Date()) {
  const eligible = cards.filter(c => c.enabled && c.status === 'approved' && c.approved_by && new Date(c.effective_from) <= now && (!c.effective_until || new Date(c.effective_until)>now)).sort((a,b)=>new Date(b.effective_from).getTime()-new Date(a.effective_from).getTime());
  const required = weightG>25000 ? 'heavy' : tier===4 ? 'enterprise' : 'customer';
  const card = eligible.find(c => c.kind === required);
  if ((tier===4 || weightG>25000) && !card) throw new Error('Approved custom Enterprise/heavy rate card required');
  if(tier===4 && weightG>25000 && !eligible.some(c=>c.kind==='enterprise')) throw new Error('Approved Enterprise agreement required for heavy pricing');
  return card;
}