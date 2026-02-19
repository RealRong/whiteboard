import type { PointerSessionHandler } from '../pointerSession'

export type InteractionHandler = PointerSessionHandler

export const readPointerId = (active: unknown) =>
  (active as { pointerId?: number | null }).pointerId

export const readTransformPointerId = (active: unknown) =>
  (active as { drag?: { pointerId?: number | null } }).drag?.pointerId
