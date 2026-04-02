import { useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import { createEngine, normalizeDocument, type EngineInstance } from '@whiteboard/engine'
import {
  createEditor,
  type Editor,
  type NodeRegistry as BoardRuntimeNodeRegistry
} from '../boardRuntime'
import { normalizeConfig, toBoardConfig } from '../config'
import { createDefaultNodeRegistry } from '../features/node/registry'
import { DEFAULT_DRAW_PREFERENCES } from '../features/toolbox/drawPreferences'
import { INSERT_PRESET_CATALOG } from '../features/toolbox/presets'
import {
  createInteractionController,
  type InteractionController
} from '../interactions/controller'
import { createHostRuntime, type WhiteboardHostRuntime } from '../runtime/host/runtime'
import type { WhiteboardProps } from '../types/common/board'
import type { ResolvedConfig } from '../types/common/config'
import type { NodeRegistry } from '../types/node'

export type BoardRuntimeConfig = {
  tool: Parameters<Editor['configure']>[0]['tool']
  viewport: Parameters<Editor['configure']>[0]['viewport'] & {
    enablePan: boolean
    enableWheel: boolean
    wheelSensitivity: number
  }
  mindmapLayout: Parameters<Editor['configure']>[0]['mindmapLayout']
  history?: Parameters<Editor['configure']>[0]['history']
}

export type BoardController = {
  editor: Editor
  interaction: InteractionController
  host: WhiteboardHostRuntime
  registry: NodeRegistry
  engine: EngineInstance
  configure: (config: BoardRuntimeConfig) => void
  dispose: () => void
}

export type UseBoardRootControllerResult = {
  controller: BoardController
  resolvedConfig: ResolvedConfig
  runtimeConfig: BoardRuntimeConfig
  inputDocument: Document
  lastOutboundDocumentRef: {
    current: Document
  }
  onDocumentChangeRef: {
    current: (document: Document) => void
  }
}

export const isMirroredDocumentFromEngine = (
  outbound: Document,
  inbound: Document
) => (
  outbound.id === inbound.id
  && outbound.name === inbound.name
  && outbound.nodes === inbound.nodes
  && outbound.edges === inbound.edges
  && outbound.background === inbound.background
  && outbound.meta === inbound.meta
)

export const useBoardRootController = ({
  document,
  onDocumentChange,
  coreRegistries,
  nodeRegistry,
  options
}: Pick<
  WhiteboardProps,
  'document' | 'onDocumentChange' | 'coreRegistries' | 'nodeRegistry' | 'options'
>): UseBoardRootControllerResult => {
  const resolvedConfig = useMemo(
    () => normalizeConfig(options),
    [options]
  )
  const boardConfig = useMemo(
    () => toBoardConfig(resolvedConfig),
    [resolvedConfig]
  )
  const runtimeConfig = useMemo<BoardRuntimeConfig>(
    () => ({
      tool: resolvedConfig.tool,
      viewport: {
        minZoom: resolvedConfig.viewport.minZoom,
        maxZoom: resolvedConfig.viewport.maxZoom,
        enablePan: resolvedConfig.viewport.enablePan,
        enableWheel: resolvedConfig.viewport.enableWheel,
        wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
      },
      mindmapLayout: resolvedConfig.mindmapLayout,
      history: resolvedConfig.history
    }),
    [resolvedConfig]
  )
  const inputDocument = useMemo(
    () => normalizeDocument(document, boardConfig),
    [document, boardConfig]
  )
  const onDocumentChangeRef = useRef(onDocumentChange)
  const lastOutboundDocumentRef = useRef<Document>(inputDocument)
  const registryRef = useRef(nodeRegistry ?? createDefaultNodeRegistry())

  onDocumentChangeRef.current = onDocumentChange

  const engineRef = useRef<EngineInstance | null>(null)
  if (!engineRef.current) {
    engineRef.current = createEngine({
      registries: coreRegistries,
      document: inputDocument,
      onDocumentChange: (nextDocument) => {
        lastOutboundDocumentRef.current = nextDocument
        onDocumentChangeRef.current(nextDocument)
      },
      config: boardConfig
    })
  }
  const engine = engineRef.current!

  const editorRef = useRef<Editor | null>(null)
  if (!editorRef.current) {
    editorRef.current = createEditor({
      engine,
      initialTool: resolvedConfig.tool,
      initialViewport: resolvedConfig.viewport.initial,
      viewportLimits: {
        minZoom: resolvedConfig.viewport.minZoom,
        maxZoom: resolvedConfig.viewport.maxZoom
      },
      registry: registryRef.current as unknown as BoardRuntimeNodeRegistry,
      insertPresetCatalog: INSERT_PRESET_CATALOG,
      initialDrawPreferences: DEFAULT_DRAW_PREFERENCES
    })
  }
  const editor = editorRef.current!

  const interactionRef = useRef<InteractionController | null>(null)
  if (!interactionRef.current) {
    interactionRef.current = createInteractionController({
      editor,
      engine,
      boardConfig,
      inputPolicy: {
        panEnabled: resolvedConfig.viewport.enablePan,
        wheelEnabled: resolvedConfig.viewport.enableWheel,
        wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
      }
    })
  }
  const interaction = interactionRef.current!

  const hostRef = useRef<WhiteboardHostRuntime | null>(null)
  if (!hostRef.current) {
    hostRef.current = createHostRuntime()
  }
  const host = hostRef.current!

  const controllerRef = useRef<BoardController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = {
      editor,
      interaction,
      host,
      registry: registryRef.current,
      engine,
      configure: (config) => {
        interaction.configure({
          panEnabled: config.viewport.enablePan,
          wheelEnabled: config.viewport.enableWheel,
          wheelSensitivity: config.viewport.wheelSensitivity
        })

        editor.configure({
          tool: config.tool,
          viewport: {
            minZoom: config.viewport.minZoom,
            maxZoom: config.viewport.maxZoom
          },
          mindmapLayout: config.mindmapLayout,
          history: config.history
        })
      },
      dispose: () => {
        interaction.dispose()
        editor.dispose()
      }
    }
  }

  return {
    controller: controllerRef.current!,
    resolvedConfig,
    runtimeConfig,
    inputDocument,
    lastOutboundDocumentRef,
    onDocumentChangeRef
  }
}
