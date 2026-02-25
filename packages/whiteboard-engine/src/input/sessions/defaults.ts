import type { PointerSession } from '@engine-types/input'
import { createEdgeConnect } from './EdgeConnect'
import { createEdgePath } from './EdgePath'
import { createMindmapDrag } from './MindmapDrag'
import { createNodeDrag } from './NodeDrag'
import { createRoutingDrag } from './RoutingDrag'
import { createSelectionBox } from './SelectionBox'

export const createDefaultPointerSessions = (): PointerSession[] => [
  createNodeDrag(),
  createEdgeConnect(),
  createEdgePath(),
  createRoutingDrag(),
  createMindmapDrag(),
  createSelectionBox()
]
