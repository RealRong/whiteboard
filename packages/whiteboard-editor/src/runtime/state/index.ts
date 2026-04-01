import { createValueStore, type ValueStore } from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { Tool } from '../../types/tool'
import type { Editor } from '../../types/editor'
import type { PointerSnapshot } from '../input/pointer/snapshot'
import type { EditorInputPolicy, EditorViewportRuntime } from '../editor/types'
import { createEditState, type EditState } from './edit'
import {
  createSelectionState,
  type SelectionState
} from './selection'
import {
  createDrawPreferencesState,
  type DrawPreferencesState
} from './draw'
import {
  createViewport,
  type ViewportRuntime
} from '../viewport'
import type { DrawPreferences } from '../../types/draw'
import type { NodeRegistry } from '../../types/node'
import type { ViewportLimits } from '@whiteboard/core/geometry'

type ReadNodeEdge = Pick<Editor['read'], 'node' | 'edge'>

const uniqueNodeIds = (
  nodeIds: readonly string[]
) => {
  const seen = new Set<string>()
  const next: string[] = []

  nodeIds.forEach((nodeId) => {
    if (seen.has(nodeId)) {
      return
    }
    seen.add(nodeId)
    next.push(nodeId)
  })

  return next
}

const uniqueEdgeIds = (
  edgeIds: readonly string[]
) => {
  const seen = new Set<string>()
  const next: string[] = []

  edgeIds.forEach((edgeId) => {
    if (seen.has(edgeId)) {
      return
    }
    seen.add(edgeId)
    next.push(edgeId)
  })

  return next
}

const isOrderedEqual = (
  left: readonly string[],
  right: readonly string[]
) => (
  left.length === right.length
  && left.every((value, index) => value === right[index])
)

export type EditorRuntimeState = {
  tool: ValueStore<Tool>
  selection: SelectionState
  edit: EditState
  viewport: ViewportRuntime
  pointer: ValueStore<PointerSnapshot | null>
  inputPolicy: ValueStore<EditorInputPolicy>
  drawPreferences: DrawPreferencesState
}

export type RuntimeStateController = {
  state: EditorRuntimeState
  public: {
    state: Editor['state']
    viewport: EditorViewportRuntime
  }
  resetLocal: () => void
  reconcileAfterCommit: (read: ReadNodeEdge) => void
}

export const createRuntimeState = ({
  engine: _engine,
  registry: _registry,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  initialDrawPreferences
}: {
  engine: EngineInstance
  registry: NodeRegistry
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: ViewportLimits
  inputPolicy: EditorInputPolicy
  initialDrawPreferences: DrawPreferences
}): RuntimeStateController => {
  const tool = createValueStore<Tool>(initialTool)
  const selection = createSelectionState()
  const edit = createEditState()
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const pointer = createValueStore<PointerSnapshot | null>(null)
  const inputPolicy = createValueStore<EditorInputPolicy>({
    panEnabled: initialInputPolicy.panEnabled,
    wheelEnabled: initialInputPolicy.wheelEnabled,
    wheelSensitivity: initialInputPolicy.wheelSensitivity
  })
  const drawPreferences = createDrawPreferencesState(initialDrawPreferences)

  const publicState: Editor['state'] = {
    tool,
    edit: edit.source,
    selection: selection.source
  }

  const publicViewport: EditorViewportRuntime = {
    get: viewport.read.get,
    subscribe: viewport.read.subscribe,
    pointer: viewport.read.pointer,
    worldToScreen: viewport.read.worldToScreen,
    input: viewport.input,
    setRect: viewport.setRect,
    setLimits: viewport.setLimits
  }

  return {
    state: {
      tool,
      selection,
      edit,
      viewport,
      pointer,
      inputPolicy,
      drawPreferences
    },
    public: {
      state: publicState,
      viewport: publicViewport
    },
    resetLocal: () => {
      pointer.set(null)
      edit.mutate.clear()
      selection.mutate.clear()
    },
    reconcileAfterCommit: (read) => {
      const currentSelection = selection.source.get()
      const nextNodeIds = uniqueNodeIds(
        currentSelection.nodeIds.filter((nodeId) => (
          Boolean(read.node.item.get(nodeId))
        ))
      )
      const nextEdgeIds = uniqueEdgeIds(
        currentSelection.edgeIds.filter((edgeId) => (
          Boolean(read.edge.item.get(edgeId))
        ))
      )

      if (
        !isOrderedEqual(nextNodeIds, currentSelection.nodeIds)
        || !isOrderedEqual(nextEdgeIds, currentSelection.edgeIds)
      ) {
        if (nextNodeIds.length > 0 || nextEdgeIds.length > 0) {
          selection.mutate.replace({
            nodeIds: nextNodeIds,
            edgeIds: nextEdgeIds
          })
        } else {
          selection.mutate.clear()
        }
      }

      const currentEdit = edit.source.get()
      if (currentEdit && !read.node.item.get(currentEdit.nodeId)) {
        edit.mutate.clear()
      }
    }
  }
}
