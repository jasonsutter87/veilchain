/**
 * VeilChain Services
 *
 * High-level service layer that combines core components
 * with storage, event handling, and idempotency.
 */

export { LedgerService } from './ledger.js';
export { IdempotencyService } from './idempotency.js';
export type { LedgerEvents, LedgerEventEmitter } from './ledger.js';
