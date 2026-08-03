// Single source of truth for ViaSetu pricing math.
//
// CONSUMER (regular) shipments:
//   viasetu price = courier API rate x 1.70, plus 18% GST on top.
//   The displayed amount is therefore all-inclusive (GST already added).

//   retail (strike-through) price = courier API rate x 3.
//   savings % = (retail - viasetu) / retail.
//
// BUSINESS shipments:
//   price per box = courier API rate + ₹15 flat (ViaSetu revenue), ALL-INCLUSIVE.
//   No retail strike-through / savings badge.

export const CONSUMER_MARGIN_PCT = 0.70;   // 70% margin over courier rate
export const RETAIL_MULTIPLIER = 4;        // struck-through "retail" price
export const BUSINESS_FLAT_MARGIN = 15;    // ₹15 revenue per business shipment
export const GST_RATE = 0.18;

export type AccountType = 'consumer' | 'business';

/** GST component already contained inside an all-inclusive amount. */
export function extractGst(inclusiveAmount: number): number {
  const amt = Number(inclusiveAmount) || 0;
  return Math.round(amt - amt / (1 + GST_RATE));
}

/** All-inclusive consumer price: rate x 1.70, then 18% GST added on top. */
export function computeConsumerPrice(courierRate: number): number {
  const rate = Number(courierRate) || 0;
  return Math.round(rate * (1 + CONSUMER_MARGIN_PCT) * (1 + GST_RATE));
}

/** Struck-through retail reference price. */
export function computeRetailPrice(courierRate: number): number {
  const rate = Number(courierRate) || 0;
  return Math.round(rate * RETAIL_MULTIPLIER);
}

/** All-inclusive business price for a single box. */
export function computeBusinessPrice(courierRate: number): number {
  const rate = Number(courierRate) || 0;
  return Math.round(rate) + BUSINESS_FLAT_MARGIN;
}

/** Price for either account type. */
export function computePrice(courierRate: number, accountType: AccountType = 'consumer'): number {
  return accountType === 'business'
    ? computeBusinessPrice(courierRate)
    : computeConsumerPrice(courierRate);
}

/**
 * Back-compat alias used across the booking UI. Returns the all-inclusive
 * ViaSetu consumer price (GST included — do NOT add GST on top of this).
 */
export function computeBaseFare(courierRate: number): number {
  return computeConsumerPrice(courierRate);
}

/** GST portion contained inside an all-inclusive total. */
export function computeGst(inclusiveTotal: number): number {
  return extractGst(inclusiveTotal);
}

export function computeTotal(courierRate: number, accountType: AccountType = 'consumer'): number {
  return computePrice(courierRate, accountType);
}

export function computeSavingsPct(retail: number, price: number): number {
  const r = Number(retail) || 0;
  if (r <= 0) return 0;
  return Math.max(0, Math.round(((r - (Number(price) || 0)) / r) * 100));
}

export interface PriceBreakdown {
  accountType: AccountType;
  courierRate: number;
  /** Amount charged to the customer, inclusive of GST and all charges. */
  total: number;
  /** Net amount excluding the GST contained inside `total`. */
  netAmount: number;
  /** GST already included inside `total`. */
  gst: number;
  /** ViaSetu revenue on this shipment. */
  margin: number;
  /** Struck-through retail price (consumer only; 0 for business). */
  retailPrice: number;
  /** Savings vs retail in % (consumer only; 0 for business). */
  savingsPct: number;
  // Legacy field names kept so existing call sites keep compiling.
  cardPrice: number;
  baseFare: number;
  platformFee: number;
}

export function computePriceBreakdown(
  courierRate: number,
  accountType: AccountType = 'consumer',
): PriceBreakdown {
  const rate = Math.round(Number(courierRate) || 0);
  const total = computePrice(rate, accountType);
  const gst = extractGst(total);
  const netAmount = total - gst;
  const retailPrice = accountType === 'business' ? 0 : computeRetailPrice(rate);
  return {
    accountType,
    courierRate: rate,
    total,
    netAmount,
    gst,
    margin: total - rate,
    retailPrice,
    savingsPct: accountType === 'business' ? 0 : computeSavingsPct(retailPrice, total),
    cardPrice: rate,
    baseFare: netAmount,
    platformFee: total - rate,
  };
}


// ─── Chargeable weight (dead vs volumetric) ───────────────────────────
// All Indian express partners (Delhivery, XpressBees, Shadowfax, UrbaneBolt,
// Shree Maruti) bill on max(dead, volumetric) using a 5000 divisor. We round
// the final chargeable weight UP to the next 0.5 kg slab so we never quote
// below what the partner will actually invoice us.
export const VOLUMETRIC_DIVISOR = 5000;
export const WEIGHT_SLAB_KG = 0.5;

export function computeVolumetricKg(
  lengthCm: number | string,
  widthCm: number | string,
  heightCm: number | string,
): number {
  const l = Number(lengthCm) || 0;
  const w = Number(widthCm) || 0;
  const h = Number(heightCm) || 0;
  if (l <= 0 || w <= 0 || h <= 0) return 0;
  return (l * w * h) / VOLUMETRIC_DIVISOR;
}

export interface ChargeableWeight {
  deadKg: number;
  volumetricKg: number;
  chargeableKg: number; // rounded up to next 0.5 kg slab
}

export function computeChargeableKg(
  deadKg: number,
  lengthCm: number | string,
  widthCm: number | string,
  heightCm: number | string,
  opts?: { isDocument?: boolean },
): ChargeableWeight {
  const dead = Math.max(0, Number(deadKg) || 0);
  // Documents/envelopes: no dimensions, chargeable == dead (typically 0.25 kg).
  if (opts?.isDocument) {
    return { deadKg: dead, volumetricKg: 0, chargeableKg: dead };
  }
  const vol = computeVolumetricKg(lengthCm, widthCm, heightCm);
  const raw = Math.max(dead, vol);
  // Round UP to next WEIGHT_SLAB_KG (0.5 kg).
  const chargeable = raw <= 0
    ? 0
    : Math.ceil(raw / WEIGHT_SLAB_KG) * WEIGHT_SLAB_KG;
  return { deadKg: dead, volumetricKg: vol, chargeableKg: chargeable };
}

