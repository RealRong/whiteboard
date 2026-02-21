import type { Guide } from '@engine-types/node/snap'
import type { GraphChange, GraphProjector, NodeViewUpdate } from '@engine-types/graph'
import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type {
  NodeDragCancelOptions,
  NodeDragStartOptions,
  NodeResizeStartOptions,
  NodeRotateStartOptions,
  NodeTransformCancelOptions
} from '@engine-types/commands'
import type { Core, Document, NodeId, Point } from '@whiteboard/core'
import type { Size } from '@engine-types/common'
import { isPointEqual, isSizeEqual } from '../../../runtime/common/geometry'
import { Drag } from './Drag'
import { Transform } from './Transform'

type ActorOptions = {
  state: Pick<State, 'write'>
  graph: GraphProjector
  syncGraph: (change: GraphChange) => void
  core: Core
  readDoc: () => Document | null
  instance: Pick<InternalInstance, 'state' | 'graph' | 'runtime' | 'query' | 'commands' | 'apply'>
}

export class Actor {
  readonly name = 'Node'

  private readonly state: Pick<State, 'write'>
  private readonly graph: GraphProjector
  private readonly syncGraph: (change: GraphChange) => void
  private readonly core: Core
  private readonly readDoc: () => Document | null
  private readonly drag: Drag
  private readonly transform: Transform

  constructor({
    state,
    graph,
    syncGraph,
    core,
    readDoc,
    instance
  }: ActorOptions) {
    this.state = state
    this.graph = graph
    this.syncGraph = syncGraph
    this.core = core
    this.readDoc = readDoc
    this.drag = new Drag({
      instance
    })
    this.transform = new Transform({
      instance
    })
  }

  private flushGraphChange = (change: GraphChange | undefined) => {
    if (!change) return
    this.syncGraph(change)
  }

  setDragGuides = (guides: Guide[]) => {
    this.state.write('dragGuides', guides)
  }

  clearDragGuides = () => {
    this.state.write('dragGuides', [])
  }

  setOverrides = (updates: NodeViewUpdate[]) => {
    this.flushGraphChange(this.graph.patchNodeOverrides(updates))
  }

  clearOverrides = (ids?: NodeId[]) => {
    this.flushGraphChange(this.graph.clearNodeOverrides(ids))
  }

  commitOverrides = (updates?: NodeViewUpdate[]) => {
    const list: NodeViewUpdate[] = updates ?? this.graph.readNodeOverrides()
    if (!list.length) return

    const currentDoc = this.readDoc()
    const ops = list
      .map((item) => {
        const patch: { position?: Point; size?: Size } = {}
        if (item.position) patch.position = item.position
        if (item.size) patch.size = item.size
        if (!patch.position && !patch.size) return null

        const currentNode = currentDoc?.nodes.find((node) => node.id === item.id)
        if (currentNode) {
          const samePosition = patch.position === undefined || isPointEqual(patch.position, currentNode.position)
          const sameSize = patch.size === undefined || isSizeEqual(patch.size, currentNode.size)
          if (samePosition && sameSize) return null
        }

        return {
          id: item.id,
          patch
        }
      })
      .filter((item): item is { id: NodeId; patch: { position?: Point; size?: Size } } => Boolean(item))

    if (!ops.length) {
      if (updates) {
        this.clearOverrides(updates.map((item) => item.id))
      } else {
        this.clearOverrides()
      }
      return
    }

    this.core.model.node.updateMany(ops)
    if (updates) {
      this.clearOverrides(updates.map((item) => item.id))
    } else {
      this.clearOverrides()
    }
  }

  resetTransientState = () => {
    this.clearDragGuides()
    this.state.write('groupHovered', undefined)
    this.clearOverrides()
    this.state.write('nodeDrag', {})
    this.state.write('nodeTransform', {})
  }

  cancelDrag = (options?: NodeDragCancelOptions) =>
    this.drag.cancel(options)

  cancelTransform = (options?: NodeTransformCancelOptions) =>
    this.transform.cancel(options)

  startDrag = (options: NodeDragStartOptions) =>
    this.drag.start(options)

  startResize = (options: NodeResizeStartOptions) =>
    this.transform.startResize(options)

  startRotate = (options: NodeRotateStartOptions) =>
    this.transform.startRotate(options)

  updateDrag = (pointer: PointerInput) =>
    this.drag.update({ pointer })

  endDrag = (pointer: PointerInput) =>
    this.drag.end({ pointer })

  updateTransform = (pointer: PointerInput, minSize?: Size) =>
    this.transform.update({ pointer, minSize })

  endTransform = (pointer: PointerInput) =>
    this.transform.end({ pointer })

  cancelInteractions = () => {
    this.cancelDrag()
    this.cancelTransform()
  }
}
