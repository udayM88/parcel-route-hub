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
export interface MerchantWallet {
  balance: number;
  low_balance_threshold: number;
  currency: "INR";
  updated_at?: string | null;
}
export interface MerchantOrder extends Record<string, unknown> {
  id: string;
  created_at: string;
  status: string;
  tracking_id?: string | null;
  prayog_awb?: string | null;
  courier_name?: string | null;
  courier_price?: number | null;
}
export interface AccountResponse extends ApiSuccess {
  merchant: Record<string, unknown> | null;
  wallet: MerchantWallet;
  connection: Record<string, unknown> | null;
}
export interface DashboardResponse extends ApiSuccess {
  metrics: {
    total_shipments: number;
    active_shipments: number;
    delivered_shipments: number;
    exceptions: number;
  };
  wallet: MerchantWallet;
  recent_orders: MerchantOrder[];
}
export interface OrdersResponse extends ApiSuccess {
  orders: MerchantOrder[];
  pagination: { page: number; per_page: number; total: number; total_pages: number };
}
export interface BillingResponse extends ApiSuccess {
  wallet: MerchantWallet;
  transactions: Array<Record<string, unknown>>;
}

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
  account(): Promise<AccountResponse>;
  dashboard(): Promise<DashboardResponse>;
  orders(options?: { page?: number; perPage?: number; status?: string }): Promise<OrdersResponse>;
  billing(options?: { limit?: number }): Promise<BillingResponse>;
  disconnect(): Promise<ApiSuccess & { disconnected?: boolean }>;
}

export const DEFAULT_ENDPOINT: string;
export function createViaSetuClient(options: ViaSetuClientOptions): ViaSetuClient;
