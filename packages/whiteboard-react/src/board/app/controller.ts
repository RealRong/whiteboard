import { useMemo, useRef } from 'react'
import type { Document } from '@whiteboard/core/types'
import { createEngine, normalizeDocument, type EngineInstance } from '@whiteboard/engine'
import { createRuntime } from '../createRuntime'
import { normalizeConfig, toBoardConfig } from '../../config'
import { createDefaultNodeRegistry } from '../../features/node/registry'
import { DEFAULT_DRAW_PREFERENCES } from '../../features/toolbox/drawPreferences'
import { INSERT_PRESET_CATALOG } from '../../features/toolbox/presets'
import { createHostRuntime, type WhiteboardHostRuntime } from '../../surface'
import type { WhiteboardProps } from '../../types/common/board'
import type { ResolvedConfig } from '../../types/common/config'
import type { NodeRegistry } from '../../types/node'
import type { BoardRuntimeInternal } from '../types'

export type BoardRuntimeConfig = {
  tool: Parameters<BoardRuntimeInternal['configure']>[0]['tool']
  viewport: Parameters<BoardRuntimeInternal['configure']>[0]['viewport'] & {
    enablePan: boolean
    enableWheel: boolean
    wheelSensitivity: number
  }
  mindmapLayout: Parameters<BoardRuntimeInternal['configure']>[0]['mindmapLayout']
  history?: Parameters<BoardRuntimeInternal['configure']>[0]['history']
}

export type BoardController = {
  runtime: BoardRuntimeInternal
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

  const runtimeRef = useRef<BoardRuntimeInternal | null>(null)
  if (!runtimeRef.current) {
    runtimeRef.current = createRuntime({
      engine,
      boardConfig,
      initialTool: resolvedConfig.tool,
      initialViewport: resolvedConfig.viewport.initial,
      viewportLimits: {
        minZoom: resolvedConfig.viewport.minZoom,
        maxZoom: resolvedConfig.viewport.maxZoom
      },
      registry: registryRef.current,
      insertPresetCatalog: INSERT_PRESET_CATALOG,
      initialDrawPreferences: DEFAULT_DRAW_PREFERENCES,
      inputPolicy: {
        panEnabled: resolvedConfig.viewport.enablePan,
        wheelEnabled: resolvedConfig.viewport.enableWheel,
        wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
      }
    })
  }
  const runtime = runtimeRef.current!

  const hostRef = useRef<WhiteboardHostRuntime | null>(null)
  if (!hostRef.current) {
    hostRef.current = createHostRuntime()
  }
  const host = hostRef.current!

  const controllerRef = useRef<BoardController | null>(null)
  if (!controllerRef.current) {
    controllerRef.current = {
      runtime,
      host,
      registry: registryRef.current,
      engine,
      configure: (config) => {
        runtime.configure({
          tool: config.tool,
          viewport: config.viewport,
          mindmapLayout: config.mindmapLayout,
          history: config.history
        })
      },
      dispose: () => {
        runtime.dispose()
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
