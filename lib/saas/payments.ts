/**
 * SaaS Payments — boundary (Phase D)
 * Gateway abstraction (stripe|razorpay|manual) — do not couple billing to one provider.
 * Stub — Phase D will implement gateway interface + webhook verification.
 */
export { listPayments } from "./billing";
