import type { Document, Viewport } from '@whiteboard/core/types'
import type {
  StateKey,
  State,
  WritableStateKey,
  WritableStateSnapshot
} from '@engine-types/instance/state'
import { ProjectionStore } from '../../runtime/projection/Store'
import { WritableStore } from '../store'
import { createInitialState } from '../initialState'

type Result = {
  state: State
  projection: ProjectionStore
  syncDocument: () => void
}

type Options = {
  getDoc: () => Document
  readViewport: () => Viewport
}

type ViewStateSnapshot = Pick<
  WritableStateSnapshot,
  'tool' | 'selection' | 'mindmapLayout'
>
type ViewStateKey = keyof ViewStateSnapshot
type RenderStateSnapshot = Omit<
  WritableStateSnapshot,
  ViewStateKey
>
type RenderStateKey = keyof RenderStateSnapshot

type RenderBuckets = {
  interaction: Pick<RenderStateSnapshot, 'interaction' | 'interactionSession'>
  selection: Pick<RenderStateSnapshot, 'selectionBox'>
  edge: Pick<RenderStateSnapshot, 'edgeConnect' | 'routingDrag'>
  viewport: Pick<RenderStateSnapshot, 'viewportGesture'>
  mindmap: Pick<RenderStateSnapshot, 'mindmapDrag'>
  node: Pick<RenderStateSnapshot, 'nodeDrag' | 'nodeTransform' | 'nodePreview' | 'dragGuides'>
  keyboard: Pick<RenderStateSnapshot, 'spacePressed'>
}
type RenderBucketKey = keyof RenderBuckets

const RENDER_BUCKET_BY_KEY: Record<RenderStateKey, RenderBucketKey> = {
  interaction: 'interaction',
  interactionSession: 'interaction',
  selectionBox: 'selection',
  edgeConnect: 'edge',
  routingDrag: 'edge',
  viewportGesture: 'viewport',
  mindmapDrag: 'mindmap',
  nodeDrag: 'node',
  nodeTransform: 'node',
  nodePreview: 'node',
  spacePressed: 'keyboard',
  dragGuides: 'node'
}

const RENDER_KEYS_BY_BUCKET: Record<RenderBucketKey, readonly RenderStateKey[]> = {
  interaction: ['interaction', 'interactionSession'],
  selection: ['selectionBox'],
  edge: ['edgeConnect', 'routingDrag'],
  viewport: ['viewportGesture'],
  mindmap: ['mindmapDrag'],
  node: ['nodeDrag', 'nodeTransform', 'nodePreview', 'dragGuides'],
  keyboard: ['spacePressed']
}

const createInitialRenderSnapshot = (
  initial: WritableStateSnapshot
): RenderStateSnapshot => ({
  interaction: initial.interaction,
  interactionSession: initial.interactionSession,
  selectionBox: initial.selectionBox,
  edgeConnect: initial.edgeConnect,
  routingDrag: initial.routingDrag,
  viewportGesture: initial.viewportGesture,
  mindmapDrag: initial.mindmapDrag,
  nodeDrag: initial.nodeDrag,
  nodeTransform: initial.nodeTransform,
  nodePreview: initial.nodePreview,
  spacePressed: initial.spacePressed,
  dragGuides: initial.dragGuides
})

const createRenderBuckets = (
  snapshot: RenderStateSnapshot
): RenderBuckets => ({
  interaction: {
    interaction: snapshot.interaction,
    interactionSession: snapshot.interactionSession
  },
  selection: {
    selectionBox: snapshot.selectionBox
  },
  edge: {
    edgeConnect: snapshot.edgeConnect,
    routingDrag: snapshot.routingDrag
  },
  viewport: {
    viewportGesture: snapshot.viewportGesture
  },
  mindmap: {
    mindmapDrag: snapshot.mindmapDrag
  },
  node: {
    nodeDrag: snapshot.nodeDrag,
    nodeTransform: snapshot.nodeTransform,
    nodePreview: snapshot.nodePreview,
    dragGuides: snapshot.dragGuides
  },
  keyboard: {
    spacePressed: snapshot.spacePressed
  }
})

const resolveRenderNext = <K extends RenderStateKey>(
  prev: RenderStateSnapshot[K],
  next:
    | RenderStateSnapshot[K]
    | ((value: RenderStateSnapshot[K]) => RenderStateSnapshot[K])
): RenderStateSnapshot[K] =>
  typeof next === 'function'
    ? (next as (value: RenderStateSnapshot[K]) => RenderStateSnapshot[K])(prev)
    : next

const readRenderValueFromBucket = <K extends RenderStateKey>(
  bucket: RenderBuckets[RenderBucketKey],
  key: K
): RenderStateSnapshot[K] => {
  switch (key) {
    case 'interaction':
      return (bucket as RenderBuckets['interaction']).interaction as RenderStateSnapshot[K]
    case 'interactionSession':
      return (bucket as RenderBuckets['interaction']).interactionSession as RenderStateSnapshot[K]
    case 'selectionBox':
      return (bucket as RenderBuckets['selection']).selectionBox as RenderStateSnapshot[K]
    case 'edgeConnect':
      return (bucket as RenderBuckets['edge']).edgeConnect as RenderStateSnapshot[K]
    case 'routingDrag':
      return (bucket as RenderBuckets['edge']).routingDrag as RenderStateSnapshot[K]
    case 'viewportGesture':
      return (bucket as RenderBuckets['viewport']).viewportGesture as RenderStateSnapshot[K]
    case 'mindmapDrag':
      return (bucket as RenderBuckets['mindmap']).mindmapDrag as RenderStateSnapshot[K]
    case 'nodeDrag':
      return (bucket as RenderBuckets['node']).nodeDrag as RenderStateSnapshot[K]
    case 'nodeTransform':
      return (bucket as RenderBuckets['node']).nodeTransform as RenderStateSnapshot[K]
    case 'nodePreview':
      return (bucket as RenderBuckets['node']).nodePreview as RenderStateSnapshot[K]
    case 'spacePressed':
      return (bucket as RenderBuckets['keyboard']).spacePressed as RenderStateSnapshot[K]
    case 'dragGuides':
      return (bucket as RenderBuckets['node']).dragGuides as RenderStateSnapshot[K]
    default: {
      const _never: never = key
      throw new Error(`Unknown render state key: ${String(_never)}`)
    }
  }
}

const writeRenderValueToBucket = <K extends RenderStateKey>(
  bucket: RenderBuckets[RenderBucketKey],
  key: K,
  value: RenderStateSnapshot[K]
): RenderBuckets[RenderBucketKey] => {
  switch (key) {
    case 'interaction':
      return {
        ...(bucket as RenderBuckets['interaction']),
        interaction: value as RenderStateSnapshot['interaction']
      }
    case 'interactionSession':
      return {
        ...(bucket as RenderBuckets['interaction']),
        interactionSession: value as RenderStateSnapshot['interactionSession']
      }
    case 'selectionBox':
      return {
        ...(bucket as RenderBuckets['selection']),
        selectionBox: value as RenderStateSnapshot['selectionBox']
      }
    case 'edgeConnect':
      return {
        ...(bucket as RenderBuckets['edge']),
        edgeConnect: value as RenderStateSnapshot['edgeConnect']
      }
    case 'routingDrag':
      return {
        ...(bucket as RenderBuckets['edge']),
        routingDrag: value as RenderStateSnapshot['routingDrag']
      }
    case 'viewportGesture':
      return {
        ...(bucket as RenderBuckets['viewport']),
        viewportGesture: value as RenderStateSnapshot['viewportGesture']
      }
    case 'mindmapDrag':
      return {
        ...(bucket as RenderBuckets['mindmap']),
        mindmapDrag: value as RenderStateSnapshot['mindmapDrag']
      }
    case 'nodeDrag':
      return {
        ...(bucket as RenderBuckets['node']),
        nodeDrag: value as RenderStateSnapshot['nodeDrag']
      }
    case 'nodeTransform':
      return {
        ...(bucket as RenderBuckets['node']),
        nodeTransform: value as RenderStateSnapshot['nodeTransform']
      }
    case 'nodePreview':
      return {
        ...(bucket as RenderBuckets['node']),
        nodePreview: value as RenderStateSnapshot['nodePreview']
      }
    case 'spacePressed':
      return {
        ...(bucket as RenderBuckets['keyboard']),
        spacePressed: value as RenderStateSnapshot['spacePressed']
      }
    case 'dragGuides':
      return {
        ...(bucket as RenderBuckets['node']),
        dragGuides: value as RenderStateSnapshot['dragGuides']
      }
    default: {
      const _never: never = key
      throw new Error(`Unknown render state key: ${String(_never)}`)
    }
  }
}

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const isSameViewport = (left: Viewport, right: Viewport) =>
  left.zoom === right.zoom
  && left.center.x === right.center.x
  && left.center.y === right.center.y

export const createState = ({ getDoc, readViewport }: Options): Result => {
  const initial = createInitialState()
  const initialRenderSnapshot = createInitialRenderSnapshot(initial)
  const viewStore = new WritableStore<ViewStateSnapshot>({
    tool: initial.tool,
    selection: initial.selection,
    mindmapLayout: initial.mindmapLayout
  })
  const renderStore = new WritableStore<RenderBuckets>(
    createRenderBuckets(initialRenderSnapshot)
  )

  const projection = new ProjectionStore(getDoc)

  const viewportListeners = new Set<() => void>()
  const changeListeners = new Set<(key: StateKey) => void>()
  let viewportSnapshot = cloneViewport(readViewport())
  const previousRenderValues: RenderStateSnapshot = {
    ...initialRenderSnapshot
  }

  const isViewStateKey = (key: StateKey): key is ViewStateKey =>
    key === 'tool' || key === 'selection' || key === 'mindmapLayout'

  const isViewWritableKey = (key: WritableStateKey): key is ViewStateKey =>
    key === 'tool' || key === 'selection' || key === 'mindmapLayout'

  const readRenderState = <K extends RenderStateKey>(
    key: K
  ): RenderStateSnapshot[K] => {
    const bucketKey = RENDER_BUCKET_BY_KEY[key]
    return readRenderValueFromBucket(renderStore.get(bucketKey), key)
  }

  const readState = ((key) => {
    if (key === 'viewport') {
      return readViewport()
    }
    if (isViewStateKey(key)) {
      return viewStore.get(key)
    }
    return readRenderState(key as RenderStateKey)
  }) as State['read']

  const syncViewport = () => {
    const nextViewport = readViewport()
    if (isSameViewport(nextViewport, viewportSnapshot)) return
    viewportSnapshot = cloneViewport(nextViewport)
    if (!viewportListeners.size) return
    viewportListeners.forEach((listener) => listener())
    notifyChange('viewport')
  }

  const syncDocDerived = () => {
    syncViewport()
  }

  const notifyChange = (key: StateKey) => {
    if (!changeListeners.size) return
    changeListeners.forEach((listener) => {
      listener(key)
    })
  }

  viewStore.watchChanges((key) => {
    notifyChange(key as StateKey)
  })
  renderStore.watchChanges((bucketKey) => {
    const bucket = renderStore.get(bucketKey)
    RENDER_KEYS_BY_BUCKET[bucketKey].forEach((renderKey) => {
      const nextValue = readRenderValueFromBucket(bucket, renderKey)
      const prevValue = previousRenderValues[renderKey]
      if (Object.is(prevValue, nextValue)) return
      notifyChange(renderKey)
      ;(previousRenderValues as Record<RenderStateKey, unknown>)[renderKey] = nextValue
    })
  })

  const watchState: State['watch'] = (key, listener) => {
    if (key === 'viewport') {
      viewportListeners.add(listener)
      return () => {
        viewportListeners.delete(listener)
      }
    }
    if (isViewStateKey(key)) {
      return viewStore.watch(key, listener)
    }
    const renderKey = key as RenderStateKey
    const bucketKey = RENDER_BUCKET_BY_KEY[renderKey]
    let previous = readRenderState(renderKey)
    return renderStore.watch(bucketKey, () => {
      const next = readRenderState(renderKey)
      if (Object.is(previous, next)) return
      previous = next
      listener()
    })
  }

  const writeState: State['write'] = (key, next) => {
    if (isViewWritableKey(key)) {
      viewStore.set(key, next as never)
      return
    }
    const renderKey = key as RenderStateKey
    const current = readRenderState(renderKey)
    const resolved = resolveRenderNext(
      current,
      next as
        | RenderStateSnapshot[typeof renderKey]
        | ((value: RenderStateSnapshot[typeof renderKey]) => RenderStateSnapshot[typeof renderKey])
    )
    if (Object.is(current, resolved)) return

    const bucketKey = RENDER_BUCKET_BY_KEY[renderKey]
    renderStore.set(bucketKey, (prev) =>
      writeRenderValueToBucket(
        prev,
        renderKey,
        resolved
      ) as RenderBuckets[typeof bucketKey]
    )
  }

  const batchState: State['batch'] = (action) => {
    viewStore.batch(() => {
      renderStore.batch(action)
    })
  }

  const batchFrameState: State['batchFrame'] = (action) => {
    viewStore.batchFrame(() => {
      renderStore.batchFrame(action)
    })
  }

  const state: State = {
    read: readState,
    write: writeState,
    batch: batchState,
    batchFrame: batchFrameState,
    watchChanges: (listener) => {
      changeListeners.add(listener)
      return () => {
        changeListeners.delete(listener)
      }
    },
    watch: watchState
  }

  return {
    state,
    projection,
    syncDocument: syncDocDerived
  }
}
