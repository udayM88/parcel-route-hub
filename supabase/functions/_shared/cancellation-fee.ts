// Stage-based customer cancellation charges. Pure logic (no Deno/Node APIs)
// so the same rules are unit-tested from the web project.

export type CancellationStage = "grace" | "pre_pickup" | "pickup_attempted" | "not_allowed";

export interface CancellationFeeSettings {
  enabled: boolean;
  grace_minutes: number;
  stages: Record<"grace" | "pre_pickup" | "pickup_attempted", { courier: number; platform: number }>;
}

export const DEFAULT_CANCELLATION_SETTINGS: CancellationFeeSettings = {
  enabled: true,
  grace_minutes: 30,
  stages: {
    grace: { courier: 0, platform: 35 },
    pre_pickup: { courier: 30, platform: 35 },
    pickup_attempted: { courier: 60, platform: 39 },
  },
};

export const STAGE_LABELS: Record<CancellationStage, string> = {
  grace: "Label generated — within free-change window",
  pre_pickup: "Label generated, awaiting pickup",
  pickup_attempted: "Courier assigned / pickup attempted",
  not_allowed: "Parcel already picked up",
};

export interface CancellationQuote {
  stage: CancellationStage;
  stageLabel: string;
  amountPaid: number;
  courierCharge: number;
  platformFee: number;
  deduction: number;
  gstOnFee: number;
  refundAmount: number;
  waived: boolean;
  minutesSinceBooking: number;
  graceMinutes: number;
}

const norm = (s: string | null | undefined) => String(s || "").toLowerCase().replace(/[\s-]+/g, "_");

const PICKUP_ATTEMPTED = ["out_for_pickup", "rider_assigned", "pickup_assigned", "not_picked", "pickup_failed", "pickup_attempted"];
const AFTER_PICKUP = ["picked", "in_transit", "transit", "reached_hub", "out_for_delivery", "deliver", "rto", "return"];

export function stageForStatus(status: string | null | undefined, minutesSinceBooking: number, graceMinutes: number): CancellationStage {
  const s = norm(status);
  if (PICKUP_ATTEMPTED.some((p) => s.includes(p))) return "pickup_attempted";
  if (AFTER_PICKUP.some((p) => s.includes(p))) return "not_allowed";
  return minutesSinceBooking <= graceMinutes ? "grace" : "pre_pickup";
}

export function mergeSettings(raw: unknown): CancellationFeeSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CancellationFeeSettings>;
  const d = DEFAULT_CANCELLATION_SETTINGS;
  const st = (r.stages || {}) as Partial<CancellationFeeSettings["stages"]>;
  const pick = (k: keyof CancellationFeeSettings["stages"]) => ({
    courier: Math.max(0, Number(st[k]?.courier ?? d.stages[k].courier) || 0),
    platform: Math.max(0, Number(st[k]?.platform ?? d.stages[k].platform) || 0),
  });
  return {
    enabled: r.enabled !== false,
    grace_minutes: Math.max(0, Number(r.grace_minutes ?? d.grace_minutes) || 0),
    stages: { grace: pick("grace"), pre_pickup: pick("pre_pickup"), pickup_attempted: pick("pickup_attempted") },
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fee is charged once per order (not per box) and never exceeds the amount paid. */
export function computeCancellationQuote(input: {
  amountPaid: number;
  createdAt: string | Date;
  status: string | null | undefined;
  settings?: CancellationFeeSettings;
  waived?: boolean;
  now?: Date;
}): CancellationQuote {
  const settings = input.settings || DEFAULT_CANCELLATION_SETTINGS;
  const now = input.now || new Date();
  const paid = Math.max(0, Number(input.amountPaid) || 0);
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(input.createdAt).getTime()) / 60000));
  const stage = stageForStatus(input.status, minutes, settings.grace_minutes);
  const waived = Boolean(input.waived) || !settings.enabled;
  let courier = 0, platform = 0;
  if (!waived && stage !== "not_allowed") {
    courier = settings.stages[stage].courier;
    platform = settings.stages[stage].platform;
  }
  let deduction = Math.min(paid, courier + platform);
  if (deduction < courier + platform) {
    courier = Math.min(courier, deduction);
    platform = deduction - courier;
  }
  deduction = r2(deduction);
  return {
    stage,
    stageLabel: STAGE_LABELS[stage],
    amountPaid: paid,
    courierCharge: r2(courier),
    platformFee: r2(platform),
    deduction,
    gstOnFee: r2((deduction * 18) / 118),
    refundAmount: r2(paid - deduction),
    waived,
    minutesSinceBooking: minutes,
    graceMinutes: settings.grace_minutes,
  };
}
