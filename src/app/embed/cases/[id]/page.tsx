/**
 * /embed/cases/[id] — same Case Workspace, rendered without the app shell so
 * it can be hosted inside the Planning Board drawer (doc 13 §7). Re-exports
 * the canonical page module to preserve SSoT — no parallel implementation.
 */
export { default } from '../../../(app)/cases/[id]/page';

export const dynamic = 'force-dynamic';
