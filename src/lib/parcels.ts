// Multi-parcel helpers for consumer bookings.
// A consumer order may contain up to 10 parcels shipped with one courier;
// each parcel gets its own AWB and its own shipping label.

import { computeChargeableKg } from "@/lib/pricing";

export const MAX_PARCELS = 10;

export interface Parcel {
  /** Weight in grams (matches the booking UI, which captures grams). */
  weightG: string;
  length: string;
  width: string;
  height: string;
}

export const emptyParcel = (): Parcel => ({ weightG: "", length: "", width: "", height: "" });

export const isParcelComplete = (p: Parcel, isDocument = false): boolean => {
  const w = parseFloat(p.weightG);
  if (!w || w <= 0) return false;
  if (isDocument) return true;
  return !!(parseFloat(p.length) && parseFloat(p.width) && parseFloat(p.height));
};

/** Chargeable weight (kg) the courier bills this parcel on. */
export const parcelChargeableKg = (p: Parcel, isDocument = false): number => {
  const deadKg = (parseFloat(p.weightG) || 0) / 1000;
  const { chargeableKg } = computeChargeableKg(deadKg, p.length, p.width, p.height, {
    isDocument,
  });
  return chargeableKg > 0 ? chargeableKg : deadKg;
};

/** Payload shape stored on `booking_boxes` (weights in kg). */
export interface BoxPayload {
  weight_kg: number;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  chargeable_weight_kg: number;
  courier_rate?: number | null;
  price?: number | null;
}

export const toBoxPayload = (
  p: Parcel,
  isDocument = false,
  extra?: { courier_rate?: number | null; price?: number | null },
): BoxPayload => ({
  weight_kg: (parseFloat(p.weightG) || 0) / 1000,
  length_cm: parseFloat(p.length) || null,
  width_cm: parseFloat(p.width) || null,
  height_cm: parseFloat(p.height) || null,
  chargeable_weight_kg: parcelChargeableKg(p, isDocument),
  courier_rate: extra?.courier_rate ?? null,
  price: extra?.price ?? null,
});
