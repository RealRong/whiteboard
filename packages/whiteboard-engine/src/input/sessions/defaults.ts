import type { PointerSession } from '@engine-types/input'
import { createEdgeConnect } from './EdgeConnect'
import { createEdgePath } from './EdgePath'
import { createMindmapDrag } from './MindmapDrag'
import { createNodeDrag } from './NodeDrag'
import { createNodeTransform } from './NodeTransform'
import { createRoutingDrag } from './RoutingDrag'
import { createSelectionBox } from './SelectionBox'
import { createViewportPan } from './ViewportPan'

export const createDefaultPointerSessions = (): PointerSession[] => [
  createNodeTransform(),
  createNodeDrag(),
  createEdgeConnect(),
  createEdgePath(),
  createRoutingDrag(),
  createMindmapDrag(),
  createSelectionBox(),
  createViewportPan()
]
