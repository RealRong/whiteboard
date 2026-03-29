import { createValueStore } from '@whiteboard/engine'
import type { EdgeConnectCandidate } from '@whiteboard/core/edge'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type { EditorPlatformBridge } from '../../types/public/editor'
import type { Tool } from '../tool'
import { normalizeTool } from '../tool'
import {
  createState as createFrameState
} from '../frame'
import {
  createState as createEditState
} from '../edit'
import {
  createState as createSelectionState
} from '../selection'
import {
  createInteractionCoordinator,
  createSnapRuntime
} from '../interaction'
import { createPickRuntime } from '../pick'
import { createViewport } from '../viewport/createViewport'
import type {
  EditorInputPolicy,
  EditorKernel,
  EditorViewportRuntime
} from '../../types/internal/editor'
import type { Editor } from '../../types/public/editor'
import { createPlatform } from './platform'

export const createKernel = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
  registry,
  platform: platformBridge
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  inputPolicy: EditorInputPolicy
  registry: NodeRegistry
  platform?: EditorPlatformBridge
}): {
  kernel: EditorKernel
  state: Editor['state']
  viewport: EditorViewportRuntime
} => {
  const platform = createPlatform(platformBridge)
  const inputPolicy = createValueStore<EditorInputPolicy>({
    panEnabled: initialInputPolicy.panEnabled,
    wheelEnabled: initialInputPolicy.wheelEnabled,
    wheelSensitivity: initialInputPolicy.wheelSensitivity
  })
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input,
    pointerContinuation: platform.pointerContinuation,
    selectionLock: platform.selectionLock
  })
  const pick = createPickRuntime()
  const snap = createSnapRuntime({
    readZoom: () => viewport.read.get().zoom,
    node: {
      config: engine.config.node,
      query: engine.read.index.snap.inRect
    },
    edge: {
      config: engine.config.edge,
      nodeSize: engine.config.nodeSize,
      query: (rect) => {
        const nodeIds = engine.read.index.node.idsInRect(rect)
        const candidates: EdgeConnectCandidate[] = []

        for (let index = 0; index < nodeIds.length; index += 1) {
          const entry = engine.read.index.node.get(nodeIds[index])
          if (!entry) {
            continue
          }

          if ((registry.get(entry.node.type)?.connect ?? true) === false) {
            continue
          }

          candidates.push({
            nodeId: entry.node.id,
            node: entry.node,
            rect: entry.rect,
            aabb: entry.aabb,
            rotation: entry.rotation
          })
        }

        return candidates
      }
    }
  })

  const tool = createValueStore<Tool>(normalizeTool(initialTool))
  const history = createValueStore(engine.commands.history.get())
  const edit = createEditState()
  const frame = createFrameState(engine.read)
  const selection = createSelectionState()

  const kernel: EditorKernel = {
    document: {
      engine,
      registry,
      history
    },
    interaction,
    spatial: {
      viewport,
      pick,
      snap
    },
    host: platform,
    state: {
      tool,
      edit,
      frame,
      selection
    },
    config: {
      inputPolicy
    }
  }

  const state: Editor['state'] = {
    tool,
    edit: edit.store,
    selection: selection.source,
    frame: frame.store
  }

  const editorViewport: EditorViewportRuntime = {
    get: viewport.read.get,
    subscribe: viewport.read.subscribe,
    pointer: viewport.read.pointer,
    worldToScreen: viewport.read.worldToScreen,
    input: viewport.input,
    setRect: viewport.setRect,
    setLimits: viewport.setLimits
  }

  return {
    kernel,
    state,
    viewport: editorViewport
  }
}
