import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator, SnapRuntime } from '../interaction'
import type { ViewportRuntime } from '../viewport/createViewport'
import type { PickRuntime } from '../pick'
import type { MarqueeSession } from '../../features/selection/marquee'
import type { SelectionGesture } from '../../features/selection/gesture'
import type { DrawInputRuntime } from '../../features/draw/input'
import type { NodeTransformSession } from '../../features/node/session/transform'
import type { EdgeConnectSession } from '../../features/edge/connectSession'
import type { EdgeInputRuntime } from '../../features/edge/input'
import type { MindmapDragController } from '../../features/mindmap/dragSession'
import type { EditorRuntime } from './types'
import type { EditorInternals } from './createEditorStores'

export const createEditorHost = ({
  registry,
  interaction,
  viewport,
  pick,
  snap,
  marquee,
  gesture,
  draw,
  internals,
  transform,
  edgeConnect,
  edgeInput,
  mindmapDragController
}: {
  registry: NodeRegistry
  interaction: InteractionCoordinator
  viewport: ViewportRuntime
  pick: PickRuntime
  snap: SnapRuntime
  marquee: MarqueeSession
  gesture: SelectionGesture
  draw: DrawInputRuntime
  internals: EditorInternals
  transform: NodeTransformSession
  edgeConnect: EdgeConnectSession
  edgeInput: EdgeInputRuntime
  mindmapDragController: MindmapDragController
}): EditorRuntime['host'] => ({
  registry,
  interaction,
  viewport,
  pick,
  snap,
  selection: {
    marquee,
    gesture
  },
  draw,
  node: {
    ...internals.node,
    transform
  },
  edge: {
    ...internals.edge,
    connect: edgeConnect,
    input: edgeInput
  },
  mindmap: {
    drag: internals.mindmapDrag,
    controller: mindmapDragController
  }
})
