import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { WhiteboardProps } from './types/common/board'
import {
  EditorProvider
} from './runtime/hooks'
import {
  type WhiteboardInstance as Editor
} from './runtime/editor'
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
    </EditorProvider>
  )
})

export const Whiteboard = WhiteboardInner
