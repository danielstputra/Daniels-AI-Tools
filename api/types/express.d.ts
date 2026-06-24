/**
 * Extend Express Request with DANIELS AI middleware properties.
 * Eliminates unsafe `(req as any)` casts throughout the codebase.
 */

import type { Tier, TierConfig } from '../lib/tiers'

declare global {
  namespace Express {
    interface Request {
      /** Hashed API key identifier for rate-limit bucketing */
      apiKeyId?: string
      /** Resolved tier for this request */
      tier?: Tier
      /** Full tier configuration */
      tierConfig?: TierConfig
    }
  }
}
