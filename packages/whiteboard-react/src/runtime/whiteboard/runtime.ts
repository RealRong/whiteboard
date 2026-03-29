import { useMemo, useRef } from 'react'
import type { BoardConfig as EngineBoardConfig } from '@whiteboard/core/config'
import type { Document } from '@whiteboard/core/types'
import { createEngine, normalizeDocument } from '@whiteboard/engine'
import { createDefaultNodeRegistry } from '../../features/node/registry'
import { createEditor, type WhiteboardRuntime as Editor } from '../editor'
import type { WhiteboardProps } from '../../types/common/board'
import type { ResolvedConfig } from '../../config/types'

type EngineRuntime = ReturnType<typeof createEngine>

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

export const useWhiteboardRuntime = ({
  document,
  onDocumentChange,
  coreRegistries,
  nodeRegistry,
  resolvedConfig,
  boardConfig
}: Pick<WhiteboardProps, 'document' | 'onDocumentChange' | 'coreRegistries' | 'nodeRegistry'> & {
  resolvedConfig: ResolvedConfig
  boardConfig: EngineBoardConfig
}) => {
  const inputDocument = useMemo(
    () => normalizeDocument(document, boardConfig),
    [document, boardConfig]
  )
  const onDocumentChangeRef = useRef(onDocumentChange)
  const lastOutboundDocumentRef = useRef<Document>(inputDocument)

  onDocumentChangeRef.current = onDocumentChange

  const engineRef = useRef<EngineRuntime | null>(null)
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
      inputPolicy: {
        panEnabled: resolvedConfig.viewport.enablePan,
        wheelEnabled: resolvedConfig.viewport.enableWheel,
        wheelSensitivity: resolvedConfig.viewport.wheelSensitivity
      },
      registry: nodeRegistry ?? createDefaultNodeRegistry()
    })
  }
  const editor = editorRef.current!

  return {
    editor,
    engine,
    inputDocument,
    lastOutboundDocumentRef,
    onDocumentChangeRef
  }
}
