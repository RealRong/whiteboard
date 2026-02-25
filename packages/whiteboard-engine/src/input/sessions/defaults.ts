import type { PointerSession } from '@engine-types/input'
import { createEdgeConnect } from './EdgeConnect'
import { createEdgePath } from './EdgePath'
import { createMindmapDrag } from './MindmapDrag'
import { createSelectionBox } from './SelectionBox'

export const createDefaultPointerSessions = (): PointerSession[] => [
  createEdgeConnect(),
  createEdgePath(),
  createMindmapDrag(),
  createSelectionBox()
]
