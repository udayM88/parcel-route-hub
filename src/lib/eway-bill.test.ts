import { test } from "node:test";
import assert from "node:assert/strict";
import { ewayBillError, requiresEwayBill } from "./eway-bill";
test("₹50,000 exactly does not need an e-way bill", () => assert.equal(requiresEwayBill(50000), false));
test("above ₹50,000 needs an e-way bill", () => assert.equal(requiresEwayBill(50001), true));
test("blocks booking above ₹50,000 without number", () => assert.notEqual(ewayBillError(60000, "", "x.pdf"), null));
test("blocks booking above ₹50,000 without upload", () => assert.notEqual(ewayBillError(60000, "123456789012", ""), null));
test("allows booking above ₹50,000 with number and upload", () => assert.equal(ewayBillError(60000, "123456789012", "a/b.pdf"), null));
