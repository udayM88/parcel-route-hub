export interface ViaSetuClientOptions {
  apiKey: string;
  endpoint?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
}

export interface BoxInput {
  weight_kg: number;
  length_cm?: number;
  width_cm?: number;
  height_cm?: number;
}

export interface AddressInput {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface RateQuote {
  partner_code: string;
  partner_name: string;
  service_code: string;
  service_name: string;
  delivery_time: string;
  amount_excl_gst: number;
  gst: number;
  total_amount: number;
  currency: "INR";
}

export interface ApiSuccess { success: true }
export interface RatesResponse extends ApiSuccess { quotes: RateQuote[] }
export interface WalletResponse extends ApiSuccess { balance: number; currency: "INR" }

export class ViaSetuApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  retryAfter?: number;
}

export class ViaSetuClient {
  constructor(options: ViaSetuClientOptions);
  request<T = ApiSuccess>(action: string, input?: Record<string, unknown>, options?: { idempotencyKey?: string; retry?: boolean }): Promise<T>;
  rates(input: { pickup_pincode: string; delivery_pincode: string; boxes: BoxInput[] }): Promise<RatesResponse>;
  createShipment(input: { pickup: AddressInput; delivery: AddressInput; boxes: BoxInput[]; partner_code?: string; service_code?: string; goods_type?: string; declared_value?: number }, options: { idempotencyKey: string }): Promise<ApiSuccess & Record<string, unknown>>;
  track(input: { booking_id?: string; awb?: string }): Promise<ApiSuccess & Record<string, unknown>>;
  label(input: { booking_id: string; box_index?: number }): Promise<ApiSuccess & { label_url: string }>;
  cancel(input: { booking_id: string; reason?: string }): Promise<ApiSuccess & Record<string, unknown>>;
  wallet(): Promise<WalletResponse>;
}

export const DEFAULT_ENDPOINT: string;
export function createViaSetuClient(options: ViaSetuClientOptions): ViaSetuClient;
