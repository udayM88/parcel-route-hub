import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { retryBlockReason } from "./eligibility.ts";
Deno.test("paid failed booking without AWB can be retried", () => assertEquals(retryBlockReason({ status: "PAYMENT_RECEIVED", payment_status: "paid" }), null));
Deno.test("refunded booking cannot be retried", () => assert(retryBlockReason({ status: "FAILED", payment_status: "refunded", refund_id: "r" })));
Deno.test("booking with AWB cannot be retried", () => assert(retryBlockReason({ status: "PAYMENT_RECEIVED", payment_status: "paid", prayog_awb: "1" })));
Deno.test("unpaid booking cannot be retried", () => assert(retryBlockReason({ status: "PENDING_PAYMENT", payment_status: "pending" })));
