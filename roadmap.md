# Pricing breakdown correction
- [x] Correct future pricing metadata without changing charged prices.
- [x] Apply evidence-based historical breakdowns across admin views and Excel reports.
- [x] Distinguish quoted courier cost from payable on failed/refunded orders.
- [x] Verify regression tests and preview build (9 tests pass; build OK).

# Business wallet and merchant API
- [ ] Finish wallet safety and authenticated verification — blocked by declined refund-safety migration and unavailable external Supabase test session; wallet shipment creation is paused.
- [x] Diagnose Atulit login role mismatch: active Operations role; use /ops/login.
