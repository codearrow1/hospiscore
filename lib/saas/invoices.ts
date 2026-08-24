/**
 * SaaS Invoices — boundary (Phase D)
 * Re-exports billing invoice read helpers. Invoice CREATION lives only in
 * lib/saas/gateway.ts (createInvoice) so coupons, audit and transactions
 * cannot be bypassed.
 */
export { listInvoices } from "./billing";
