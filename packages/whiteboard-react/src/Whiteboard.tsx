import { forwardRef, useImperativeHandle, useMemo } from 'react'
import type { WhiteboardProps } from './types/common/board'
import { BoardProvider } from './board/context'
import type { WhiteboardInstance as Editor } from './types/runtime'
import { WhiteboardLifecycle } from './board/Lifecycle'
import { useBoardRootController } from './board/controller'
import { Surface } from './surface/Surface'

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
  const {
    controller,
    resolvedConfig,
    runtimeConfig,
    inputDocument,
    lastOutboundDocumentRef,
    onDocumentChangeRef
  } = useBoardRootController({
    document,
    onDocumentChange,
    coreRegistries,
    nodeRegistry,
    options
  })
  const board = useMemo(
    () => ({
      controller,
      resolvedConfig
    }),
    [controller, resolvedConfig]
  )

  useImperativeHandle(ref, () => controller.editor, [controller])

  return (
    <BoardProvider value={board}>
      <WhiteboardLifecycle
        controller={controller}
        runtimeConfig={runtimeConfig}
        document={document}
        inputDocument={inputDocument}
        lastOutboundDocumentRef={lastOutboundDocumentRef}
        onDocumentChangeRef={onDocumentChangeRef}
        collab={collab}
      />
      <Surface />
    </BoardProvider>
  )
})

export const Whiteboard = WhiteboardInner
