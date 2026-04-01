import { rectFromPoints, isPointEqual } from '@whiteboard/core/geometry'
import type {
  Guide,
  NodeProjectionPatch as CoreNodeProjectionPatch
} from '@whiteboard/core/node'
import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type {
  EdgeId,
  EdgePatch,
  MindmapNodeId,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import {
  createDerivedStore,
  createRafKeyedStore,
  createRafValueStore,
  createStagedKeyedStore,
  createValueStore,
  type KeyedReadStore,
  type ReadStore,
  type StagedKeyedStore
} from '@whiteboard/engine'
import type { DrawPreview } from '../types/draw'
import type { EditorViewportRuntime } from './editor/types'
import { isEdgePatchEqual } from '@whiteboard/core/edge'

export type NodePatch = CoreNodeProjectionPatch

export type NodePatchEntry = {
  id: NodeId
  patch: NodePatch
}

export type NodeSelectionOverlayState = {
  patches: readonly NodePatchEntry[]
  hovered?: NodeId
}

export type NodeTextOverlayState = {
  patches: readonly NodePatchEntry[]
}

export type NodeOverlayState = {
  text: NodeTextOverlayState
  hidden: readonly NodeId[]
}

export type NodeOverlayProjection = {
  patch?: NodePatch
  hovered: boolean
  hidden: boolean
}

export type EdgeOverlayEntry = {
  id: EdgeId
  patch?: EdgePatch
  activeRouteIndex?: number
}

export type EdgeOverlayProjection = {
  patch?: EdgePatch
  activeRouteIndex?: number
}

export type EdgeOverlayState = {
  interaction: readonly EdgeOverlayEntry[]
  guide?: EdgeGuide
}

export type MarqueeOverlayState = {
  worldRect: Rect
  match: import('@whiteboard/core/selection').MarqueeMatch
}

export type MarqueeFeedback = {
  rect: Rect
  match: import('@whiteboard/core/selection').MarqueeMatch
}

type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragFeedback = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type EdgeGuide = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

export type SelectionOverlayState = {
  node: NodeSelectionOverlayState
  edge: readonly EdgeOverlayEntry[]
  marquee?: MarqueeOverlayState
  guides: readonly Guide[]
}

export type EditorOverlayState = {
  node: NodeOverlayState
  edge: EdgeOverlayState
  draw: {
    preview: DrawPreview | null
  }
  selection: SelectionOverlayState
  mindmap: {
    drag?: MindmapDragFeedback
  }
}

export type EditorOverlay = Pick<ReadStore<EditorOverlayState>, 'get' | 'subscribe'> & {
  set: (
    next:
      | EditorOverlayState
      | ((current: EditorOverlayState) => EditorOverlayState)
  ) => void
  reset: () => void
  selectors: {
    node: KeyedReadStore<NodeId, NodeOverlayProjection>
    edge: KeyedReadStore<EdgeId, EdgeOverlayProjection>
    feedback: {
      draw: ReadStore<DrawPreview | null>
      marquee: ReadStore<MarqueeFeedback | undefined>
      mindmapDrag: ReadStore<MindmapDragFeedback | undefined>
      edgeGuide: ReadStore<EdgeGuide>
      snap: ReadStore<readonly Guide[]>
    }
  }
}

type NodeOverlayStore =
  Pick<StagedKeyedStore<NodeId, NodeOverlayProjection, EditorOverlayState>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

const EMPTY_NODE_PATCHES: readonly NodePatchEntry[] = []
const EMPTY_NODE_HIDDEN: readonly NodeId[] = []
const EMPTY_EDGE_PATCHES: readonly EdgeOverlayEntry[] = []
const EMPTY_GUIDES: readonly Guide[] = []
const EMPTY_EDGE_GUIDE: EdgeGuide = {}

const EMPTY_NODE_SELECTION_OVERLAY: NodeSelectionOverlayState = {
  patches: EMPTY_NODE_PATCHES
}

const EMPTY_NODE_TEXT_OVERLAY: NodeTextOverlayState = {
  patches: EMPTY_NODE_PATCHES
}

const EMPTY_NODE_OVERLAY: NodeOverlayState = {
  text: EMPTY_NODE_TEXT_OVERLAY,
  hidden: EMPTY_NODE_HIDDEN
}

const EMPTY_EDGE_OVERLAY: EdgeOverlayState = {
  interaction: EMPTY_EDGE_PATCHES
}

const EMPTY_SELECTION_OVERLAY: SelectionOverlayState = {
  node: EMPTY_NODE_SELECTION_OVERLAY,
  edge: EMPTY_EDGE_PATCHES,
  guides: EMPTY_GUIDES
}

const EMPTY_OVERLAY_STATE: EditorOverlayState = {
  node: EMPTY_NODE_OVERLAY,
  edge: EMPTY_EDGE_OVERLAY,
  draw: {
    preview: null
  },
  selection: EMPTY_SELECTION_OVERLAY,
  mindmap: {}
}

const EMPTY_NODE_OVERLAY_PROJECTION: NodeOverlayProjection = {
  hovered: false,
  hidden: false
}

const EMPTY_EDGE_OVERLAY_PROJECTION: EdgeOverlayProjection = {}
const EMPTY_NODE_OVERLAY_MAP = new Map<NodeId, NodeOverlayProjection>()
const EMPTY_EDGE_OVERLAY_MAP = new Map<EdgeId, EdgeOverlayProjection>()

const isSameSize = (
  left: { width: number, height: number } | undefined,
  right: { width: number, height: number } | undefined
) => (
  left?.width === right?.width
  && left?.height === right?.height
)

const isSameNodePatch = (
  left: NodePatch | undefined,
  right: NodePatch | undefined
) => (
  isPointEqual(left?.position, right?.position)
  && isSameSize(left?.size, right?.size)
  && left?.rotation === right?.rotation
)

const isSameNodeOverlayState = (
  left: NodeOverlayState,
  right: NodeOverlayState
) => (
  left.text.patches === right.text.patches
  && left.hidden === right.hidden
)

const isSameSelectionOverlayState = (
  left: SelectionOverlayState,
  right: SelectionOverlayState
) => (
  left.node.patches === right.node.patches
  && left.node.hovered === right.node.hovered
  && left.edge === right.edge
  && isSameMarquee(left.marquee, right.marquee)
  && left.guides === right.guides
)

const isSameNodeProjection = (
  left: NodeOverlayProjection,
  right: NodeOverlayProjection
) => (
  isSameNodePatch(left.patch, right.patch)
  && left.hovered === right.hovered
  && left.hidden === right.hidden
)

const isSameEdgeGuide = (
  left: EdgeGuide,
  right: EdgeGuide
) => (
  isPointEqual(left.line?.from, right.line?.from)
  && isPointEqual(left.line?.to, right.line?.to)
  && isPointEqual(left.snap, right.snap)
)

const isEdgeGuideEmpty = (
  guide: EdgeGuide | undefined
) => (
  guide === undefined
  || (!guide.line && !guide.snap)
)

const normalizeNodeOverlayState = (
  state: NodeOverlayState
): NodeOverlayState => {
  const textPatches = state.text.patches.length > 0
    ? state.text.patches
    : EMPTY_NODE_PATCHES
  const hidden = state.hidden.length > 0
    ? state.hidden
    : EMPTY_NODE_HIDDEN

  if (
    textPatches === EMPTY_NODE_PATCHES
    && hidden === EMPTY_NODE_HIDDEN
  ) {
    return EMPTY_NODE_OVERLAY
  }

  return {
    text:
      textPatches === EMPTY_NODE_PATCHES
        ? EMPTY_NODE_TEXT_OVERLAY
        : {
            patches: textPatches
          },
    hidden
  }
}

const normalizeEdgeOverlayState = (
  state: EdgeOverlayState
): EdgeOverlayState => {
  const interaction = state.interaction.length > 0
    ? state.interaction
    : EMPTY_EDGE_PATCHES
  const guide = isEdgeGuideEmpty(state.guide)
    ? undefined
    : state.guide

  if (
    interaction === EMPTY_EDGE_PATCHES
    && guide === undefined
  ) {
    return EMPTY_EDGE_OVERLAY
  }

  return {
    interaction,
    guide
  }
}

const normalizeSelectionOverlayState = (
  state: SelectionOverlayState
): SelectionOverlayState => {
  const nodePatches = state.node.patches.length > 0
    ? state.node.patches
    : EMPTY_NODE_PATCHES
  const edge = state.edge.length > 0
    ? state.edge
    : EMPTY_EDGE_PATCHES
  const guides = state.guides.length > 0
    ? state.guides
    : EMPTY_GUIDES
  const marquee = state.marquee

  if (
    nodePatches === EMPTY_NODE_PATCHES
    && state.node.hovered === undefined
    && edge === EMPTY_EDGE_PATCHES
    && guides === EMPTY_GUIDES
    && marquee === undefined
  ) {
    return EMPTY_SELECTION_OVERLAY
  }

  return {
    node:
      nodePatches === EMPTY_NODE_PATCHES && state.node.hovered === undefined
        ? EMPTY_NODE_SELECTION_OVERLAY
        : {
            patches: nodePatches,
            hovered: state.node.hovered
          },
    edge,
    marquee,
    guides
  }
}

const normalizeOverlayState = (
  state: EditorOverlayState
): EditorOverlayState => {
  const node = normalizeNodeOverlayState(state.node)
  const edge = normalizeEdgeOverlayState(state.edge)
  const selection = normalizeSelectionOverlayState(state.selection)
  const drawPreview = state.draw.preview ?? null
  const mindmapDrag = state.mindmap.drag

  if (
    node === EMPTY_NODE_OVERLAY
    && edge === EMPTY_EDGE_OVERLAY
    && selection === EMPTY_SELECTION_OVERLAY
    && drawPreview === null
    && mindmapDrag === undefined
  ) {
    return EMPTY_OVERLAY_STATE
  }

  return {
    node,
    edge,
    draw: {
      preview: drawPreview
    },
    selection,
    mindmap: {
      drag: mindmapDrag
    },
  }
}

const isSameMarquee = (
  left: MarqueeOverlayState | undefined,
  right: MarqueeOverlayState | undefined
) => (
  left === right
  || (
    left?.match === right?.match
    && left?.worldRect.x === right?.worldRect.x
    && left?.worldRect.y === right?.worldRect.y
    && left?.worldRect.width === right?.worldRect.width
    && left?.worldRect.height === right?.worldRect.height
  )
)

const isSameOverlayState = (
  left: EditorOverlayState,
  right: EditorOverlayState
) => (
  isSameNodeOverlayState(left.node, right.node)
  && left.edge.interaction === right.edge.interaction
  && isSameEdgeGuide(left.edge.guide ?? EMPTY_EDGE_GUIDE, right.edge.guide ?? EMPTY_EDGE_GUIDE)
  && left.draw.preview === right.draw.preview
  && isSameSelectionOverlayState(left.selection, right.selection)
  && left.mindmap.drag === right.mindmap.drag
)

const toNodeOverlayMap = (
  state: EditorOverlayState
) => {
  if (
    state.selection.node.patches.length === 0
    && state.node.text.patches.length === 0
    && state.node.hidden.length === 0
    && state.selection.node.hovered === undefined
  ) {
    return EMPTY_NODE_OVERLAY_MAP
  }

  const next = new Map<NodeId, NodeOverlayProjection>()
  const hiddenSet = new Set(state.node.hidden)

  for (let index = 0; index < state.node.text.patches.length; index += 1) {
    const entry = state.node.text.patches[index]!
    next.set(entry.id, {
      patch: entry.patch,
      hovered: false,
      hidden: hiddenSet.has(entry.id)
    })
  }

  for (let index = 0; index < state.selection.node.patches.length; index += 1) {
    const entry = state.selection.node.patches[index]!
    const current = next.get(entry.id)
    next.set(entry.id, {
      patch: current?.patch
        ? {
            ...current.patch,
            ...entry.patch
          }
        : entry.patch,
      hovered: state.selection.node.hovered === entry.id,
      hidden: hiddenSet.has(entry.id)
    })
  }

  if (state.selection.node.hovered !== undefined) {
    const current = next.get(state.selection.node.hovered)
    next.set(state.selection.node.hovered, {
      patch: current?.patch,
      hovered: true,
      hidden: hiddenSet.has(state.selection.node.hovered)
    })
  }

  for (let index = 0; index < state.node.hidden.length; index += 1) {
    const nodeId = state.node.hidden[index]!
    if (next.has(nodeId)) {
      continue
    }

    next.set(nodeId, {
      hovered: false,
      hidden: true
    })
  }

  return next
}

const createNodeOverlayStore = (): NodeOverlayStore => {
  let scheduled = false
  let token = 0

  const store = createStagedKeyedStore<NodeId, NodeOverlayProjection, EditorOverlayState>({
    schedule: () => {
      if (scheduled) {
        return
      }

      scheduled = true
      const currentToken = token + 1
      token = currentToken
      queueMicrotask(() => {
        if (!scheduled || currentToken !== token) {
          return
        }

        scheduled = false
        store.flush()
      })
    },
    emptyState: EMPTY_NODE_OVERLAY_MAP,
    emptyValue: EMPTY_NODE_OVERLAY_PROJECTION,
    build: toNodeOverlayMap,
    isEqual: isSameNodeProjection
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    write: store.write,
    clear: () => {
      scheduled = false
      token += 1
      store.clear()
    },
    flush: store.flush
  }
}

const toEdgeOverlayMap = (
  state: EditorOverlayState
) => {
  if (
    state.selection.edge.length === 0
    && state.edge.interaction.length === 0
  ) {
    return EMPTY_EDGE_OVERLAY_MAP
  }

  const next = new Map<EdgeId, EdgeOverlayProjection>()

  const writeEntry = (
    entry: EdgeOverlayEntry
  ) => {
    const current = next.get(entry.id)
    const patch = current?.patch
      ? {
          ...current.patch,
          ...entry.patch
        }
      : entry.patch
    const activeRouteIndex = entry.activeRouteIndex ?? current?.activeRouteIndex

    if (!patch && activeRouteIndex === undefined) {
      return
    }

    next.set(entry.id, {
      patch,
      activeRouteIndex
    })
  }

  for (let index = 0; index < state.selection.edge.length; index += 1) {
    writeEntry(state.selection.edge[index]!)
  }

  for (let index = 0; index < state.edge.interaction.length; index += 1) {
    writeEntry(state.edge.interaction[index]!)
  }

  return next.size > 0
    ? next
    : EMPTY_EDGE_OVERLAY_MAP
}

const projectWorldRect = (
  viewport: Pick<EditorViewportRuntime, 'worldToScreen'>,
  worldRect: Rect
): Rect => {
  const topLeft = viewport.worldToScreen({
    x: worldRect.x,
    y: worldRect.y
  })
  const bottomRight = viewport.worldToScreen({
    x: worldRect.x + worldRect.width,
    y: worldRect.y + worldRect.height
  })

  return rectFromPoints(topLeft, bottomRight)
}

export const createOverlay = ({
  viewport
}: {
  viewport: Pick<EditorViewportRuntime, 'worldToScreen'> & ReadStore<unknown>
}): EditorOverlay => {
  const state = createValueStore<EditorOverlayState>(EMPTY_OVERLAY_STATE, {
    isEqual: isSameOverlayState
  })
  const nodeStore = createNodeOverlayStore()
  const edgeStore = createRafKeyedStore<EdgeId, EdgeOverlayProjection, EditorOverlayState>({
    emptyState: EMPTY_EDGE_OVERLAY_MAP,
    emptyValue: EMPTY_EDGE_OVERLAY_PROJECTION,
    build: toEdgeOverlayMap,
    isEqual: (left, right) => (
      isEdgePatchEqual(left.patch, right.patch)
      && left.activeRouteIndex === right.activeRouteIndex
    )
  })
  const drawPreview = createRafValueStore<DrawPreview | null>({
    initial: null,
    isEqual: (left, right) => left === right
  })
  const edgeGuide = createRafValueStore<EdgeGuide>({
    initial: EMPTY_EDGE_GUIDE,
    isEqual: isSameEdgeGuide
  })
  const mindmapDrag = createRafValueStore<MindmapDragFeedback | undefined>({
    initial: undefined,
    isEqual: (left, right) => left === right
  })
  const snapGuides = createRafValueStore<readonly Guide[]>({
    initial: EMPTY_GUIDES,
    isEqual: (left, right) => left === right
  })

  const marquee = createDerivedStore<MarqueeFeedback | undefined>({
    get: (read) => {
      const next = read(state).selection.marquee
      read(viewport)
      if (!next) {
        return undefined
      }

      return {
        rect: projectWorldRect(viewport, next.worldRect),
        match: next.match
      }
    },
    isEqual: (left, right) => (
      left === right
      || (
        left?.match === right?.match
        && left?.rect.x === right?.rect.x
        && left?.rect.y === right?.rect.y
        && left?.rect.width === right?.rect.width
        && left?.rect.height === right?.rect.height
      )
    )
  })

  let current = EMPTY_OVERLAY_STATE

  const syncStores = (
    next: EditorOverlayState
  ) => {
    nodeStore.write(next)
    edgeStore.write(next)

    if (next.draw.preview === null) {
      drawPreview.clear()
    } else {
      drawPreview.write(next.draw.preview)
    }

    if (next.edge.guide === undefined) {
      edgeGuide.clear()
    } else {
      edgeGuide.write(next.edge.guide)
    }

    if (next.mindmap.drag === undefined) {
      mindmapDrag.clear()
    } else {
      mindmapDrag.write(next.mindmap.drag)
    }

    if (next.selection.guides === EMPTY_GUIDES) {
      snapGuides.clear()
    } else {
      snapGuides.write(next.selection.guides)
    }
  }

  const write = (
    next: EditorOverlayState
  ) => {
    const normalized = normalizeOverlayState(next)
    if (isSameOverlayState(current, normalized)) {
      return
    }

    current = normalized
    state.set(normalized)
    syncStores(normalized)
  }

  return {
    get: state.get,
    subscribe: state.subscribe,
    set: (next) => {
      const resolved = typeof next === 'function'
        ? next(current)
        : next
      write(resolved)
    },
    reset: () => {
      write(EMPTY_OVERLAY_STATE)
    },
    selectors: {
      node: {
        get: nodeStore.get,
        subscribe: nodeStore.subscribe
      },
      edge: {
        get: edgeStore.get,
        subscribe: edgeStore.subscribe
      },
      feedback: {
        draw: {
          get: drawPreview.get,
          subscribe: drawPreview.subscribe
        },
        marquee: {
          get: marquee.get,
          subscribe: marquee.subscribe
        },
        mindmapDrag: {
          get: mindmapDrag.get,
          subscribe: mindmapDrag.subscribe
        },
        edgeGuide: {
          get: edgeGuide.get,
          subscribe: edgeGuide.subscribe
        },
        snap: {
          get: snapGuides.get,
          subscribe: snapGuides.subscribe
        }
      }
    }
  }
}
