import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { WhiteboardProps } from './types/common/board'
import { EditorProvider } from './runtime/hooks/useEditor'
import { HostProvider } from './runtime/hooks/useHost'
import type { WhiteboardInstance as Editor } from './types/runtime'
import { Surface } from './canvas/Surface'
import { DocumentSync } from './runtime/whiteboard/DocumentSync'
import { CollabLifecycle } from './runtime/whiteboard/CollabLifecycle'
import { EditorLifecycle } from './runtime/whiteboard/EditorLifecycle'
import { useWhiteboardConfig } from './runtime/whiteboard/config'
import { useWhiteboardRuntime } from './runtime/whiteboard/runtime'

const WhiteboardInner = forwardRef<Editor | null, WhiteboardProps>(function WhiteboardInner(
  {
    document,
    onDocumentChange,
    coreRegistries,
    nodeRegistry,
    collab,
    options
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const {
    resolvedConfig,
    boardConfig,
    runtimeConfig
  } = useWhiteboardConfig(options)
  const {
    editor,
    host,
    engine,
    inputDocument,
    lastOutboundDocumentRef,
    onDocumentChangeRef
  } = useWhiteboardRuntime({
    document,
    onDocumentChange,
    coreRegistries,
    nodeRegistry,
    resolvedConfig,
    boardConfig
  })

  useImperativeHandle(ref, () => editor, [editor])

  return (
    <EditorProvider value={editor}>
      <HostProvider value={host}>
        <DocumentSync
          editor={editor}
          document={document}
          inputDocument={inputDocument}
          lastOutboundDocumentRef={lastOutboundDocumentRef}
          onDocumentChangeRef={onDocumentChangeRef}
        />
        <CollabLifecycle
          collab={collab}
          engine={engine}
        />
        <EditorLifecycle
          editor={editor}
          runtimeConfig={runtimeConfig}
        />
        <Surface
          resolvedConfig={resolvedConfig}
          containerRef={containerRef}
          containerStyle={resolvedConfig.style}
        />
      </HostProvider>
    </EditorProvider>
  )
})

export const Whiteboard = WhiteboardInner
