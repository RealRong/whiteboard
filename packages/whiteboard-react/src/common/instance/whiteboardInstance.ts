import type {
  Core,
  DispatchResult,
  Document,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  EdgePatch,
  NodeId,
  NodeInput,
  NodePatch,
  Point,
  Viewport
} from '@whiteboard/core'
import type { RefObject } from 'react'
import { createNodeSizeObserverService } from './nodeSizeObserverService'
import type { NodeSizeObserverService } from './nodeSizeObserverService'
import type { SelectionMode } from '../state/whiteboardAtoms'
import { createShortcutManager } from '../shortcuts/shortcutManager'
import type { ShortcutManager } from '../shortcuts/shortcutManager'

export type WhiteboardCommands = {
  selection: {
    select: (ids: NodeId[], mode?: SelectionMode) => void
    toggle: (ids: NodeId[]) => void
    clear: () => void
    getSelectedNodeIds: () => NodeId[]
  }
  tool: {
    setTool: (tool: string) => void
  }
  interaction: {
    clearHover: () => void
  }
  viewport: {
    set: (viewport: Viewport) => Promise<DispatchResult>
    panBy: (delta: { x: number; y: number }) => Promise<DispatchResult>
    zoomBy: (factor: number, anchor?: Point) => Promise<DispatchResult>
    zoomTo: (zoom: number, anchor?: Point) => Promise<DispatchResult>
    reset: () => Promise<DispatchResult>
  }
  node: {
    create: (payload: NodeInput) => Promise<DispatchResult>
    update: (id: NodeId, patch: NodePatch) => Promise<DispatchResult>
    delete: (ids: NodeId[]) => Promise<DispatchResult>
    move: (ids: NodeId[], delta: { x: number; y: number }) => Promise<DispatchResult>
    resize: (id: NodeId, size: { width: number; height: number }) => Promise<DispatchResult>
    rotate: (id: NodeId, angle: number) => Promise<DispatchResult>
  }
  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<DispatchResult>
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
    connect: (source: { nodeId: NodeId; anchor?: EdgeAnchor }, target: { nodeId: NodeId; anchor?: EdgeAnchor }) => Promise<DispatchResult>
    reconnect: (id: EdgeId, end: 'source' | 'target', ref: { nodeId: NodeId; anchor?: EdgeAnchor }) => Promise<DispatchResult>
    select: (id?: EdgeId) => void
  }
  edgeConnect: {
    startFromHandle: (nodeId: NodeId, side: EdgeAnchor['side'], pointerId?: number) => void
    startFromPoint: (nodeId: NodeId, pointWorld: Point, pointerId?: number) => void
    startReconnect: (edgeId: EdgeId, end: 'source' | 'target', pointerId?: number) => void
    updateTo: (pointWorld: Point) => void
    commitTo: (pointWorld: Point) => void
    cancel: () => void
  }
  group: Core['commands']['group']
  mindmap: Core['commands']['mindmap']
}

const createEmptyDispatch = (..._args: unknown[]): Promise<DispatchResult> =>
  Promise.resolve({ ok: false, reason: 'invalid', message: 'Instance commands not ready.' })

export const createEmptyCommands = (): WhiteboardCommands => ({
  selection: {
    select: () => {},
    toggle: () => {},
    clear: () => {},
    getSelectedNodeIds: () => []
  },
  tool: {
    setTool: () => {}
  },
  interaction: {
    clearHover: () => {}
  },
  viewport: {
    set: createEmptyDispatch,
    panBy: createEmptyDispatch,
    zoomBy: createEmptyDispatch,
    zoomTo: createEmptyDispatch,
    reset: createEmptyDispatch
  },
  node: {
    create: createEmptyDispatch,
    update: createEmptyDispatch,
    delete: createEmptyDispatch,
    move: createEmptyDispatch,
    resize: createEmptyDispatch,
    rotate: createEmptyDispatch
  },
  edge: {
    create: createEmptyDispatch,
    update: createEmptyDispatch,
    delete: createEmptyDispatch,
    connect: createEmptyDispatch,
    reconnect: createEmptyDispatch,
    select: () => {}
  },
  edgeConnect: {
    startFromHandle: () => {},
    startFromPoint: () => {},
    startReconnect: () => {},
    updateTo: () => {},
    commitTo: () => {},
    cancel: () => {}
  },
  group: {
    create: createEmptyDispatch,
    ungroup: createEmptyDispatch
  },
  mindmap: {
    create: createEmptyDispatch,
    replace: createEmptyDispatch,
    delete: createEmptyDispatch,
    addChild: createEmptyDispatch,
    addSibling: createEmptyDispatch,
    moveSubtree: createEmptyDispatch,
    removeSubtree: createEmptyDispatch,
    cloneSubtree: createEmptyDispatch,
    toggleCollapse: createEmptyDispatch,
    setNodeData: createEmptyDispatch,
    reorderChild: createEmptyDispatch,
    setSide: createEmptyDispatch,
    attachExternal: createEmptyDispatch
  }
})

export type WhiteboardInstance = {
  core: Core
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement>
  getContainer: () => HTMLDivElement | null
  services: {
    nodeSizeObserver: NodeSizeObserverService
  }
  shortcutManager: ShortcutManager
  commands: WhiteboardCommands
  setCommands: (partial: Partial<WhiteboardCommands>) => void
  addWindowEventListener: <K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
  addContainerEventListener: <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
}

export type CreateWhiteboardInstanceOptions = {
  core: Core
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement>
  shortcutManager?: ShortcutManager
}

export const createWhiteboardInstance = ({
  core,
  docRef,
  containerRef,
  shortcutManager: externalShortcutManager
}: CreateWhiteboardInstanceOptions): WhiteboardInstance => {
  const getContainer = () => containerRef.current
  const services = {
    nodeSizeObserver: createNodeSizeObserverService(core, containerRef)
  }
  const shortcutManager = externalShortcutManager ?? createShortcutManager()
  const commands = createEmptyCommands()
  const setCommands: WhiteboardInstance['setCommands'] = (partial) => {
    Object.assign(commands, partial)
  }
  const addWindowEventListener: WhiteboardInstance['addWindowEventListener'] = (type, listener, options) => {
    window.addEventListener(type, listener as EventListener, options)
    return () => {
      window.removeEventListener(type, listener as EventListener, options)
    }
  }
  const addContainerEventListener: WhiteboardInstance['addContainerEventListener'] = (
    type,
    listener,
    options
  ) => {
    const container = containerRef.current
    if (!container) return () => {}
    container.addEventListener(type, listener as EventListener, options)
    return () => {
      container.removeEventListener(type, listener as EventListener, options)
    }
  }

  return {
    core,
    docRef,
    containerRef,
    getContainer,
    services,
    shortcutManager,
    commands,
    setCommands,
    addWindowEventListener,
    addContainerEventListener
  }
}
