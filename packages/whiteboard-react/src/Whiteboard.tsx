import { forwardRef, useImperativeHandle, useMemo } from 'react'
import type { WhiteboardProps } from './types/common/board'
import { BoardProvider, WhiteboardLifecycle, useBoardRootController } from './board'
import { Surface } from './surface'
import type { WhiteboardInstance as Editor } from './types/runtime'

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

  useImperativeHandle(ref, () => controller.runtime, [controller])

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
