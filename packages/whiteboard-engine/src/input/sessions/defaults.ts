import type { PointerSession } from '@engine-types/input'
import { createEdgePath } from './EdgePath'
import { createMindmapDrag } from './MindmapDrag'
import { createSelectionBox } from './SelectionBox'

export const createDefaultPointerSessions = (): PointerSession[] => [
  createEdgePath(),
  createMindmapDrag(),
  createSelectionBox()
]
