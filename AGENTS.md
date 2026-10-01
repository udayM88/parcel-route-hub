# Project Architecture Rules

- All Shree Maruti operations use the documented Innofulfill gateway v2 through one shared authenticated client, so endpoint authentication, retries, and environment isolation remain consistent.
- Courier partner detection in edge functions uses `_shared/partner-key.ts`, so aliases resolve identically across consumer, business, admin, and retry flows.
- Partner booking responses persist the courier-generated order ID separately from the AWB, because labels and cancellations require the upstream order ID.