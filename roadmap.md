# B2B tiered pricing replacement
- [x] Review and approve implementation plan; Growth uses listed slab rates (5kg ₹115, 10kg ₹165, 25kg ₹255).
- [x] Implement effective-dated pricing storage, monthly tiers, server quotes and immutable booking snapshots.
- [x] Connect business pricing/dashboard and super-admin pricing management without changing B2C or refund safety.
- [x] Verify tier/weight boundaries, tax, multi-package, custom rates, quote expiry, historical and consumer regressions.
- [ ] Verify signed-in quote → prepare → payment and admin publish end-to-end — external unmanaged Supabase cannot provide a test session.

# Pricing breakdown correction
- [x] Correct future pricing metadata without changing charged prices.
- [x] Apply evidence-based historical breakdowns across admin views and Excel reports.
- [x] Distinguish quoted courier cost from payable on failed/refunded orders.
- [x] Verify regression tests and preview build (9 tests pass; build OK).

# Business wallet and merchant API
- [ ] Finish wallet safety and authenticated verification — blocked by declined refund-safety migration and unavailable external Supabase test session; wallet shipment creation is paused.
- [x] Diagnose Atulit login role mismatch: active Operations role; use /ops/login.

# Stage-based cancellation charges
- [x] Server-side quote, partial refunds in all six cancel handlers, admin waiver, settings tab, refund policy, business/admin pop-up (6 tests pass).
- [ ] Consumer self-cancel button — consumers currently email support to cancel; needs a decision before adding.
