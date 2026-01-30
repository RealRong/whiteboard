import { FC, memo, useMemo, useRef } from 'react'
import { IWhiteboardNode } from '~/typings/data'
import { InnerNodeProps } from '../WrapperNode'
import NoteEditor from '@/core/components/editor/noteEditor/NoteEditor'
import { IEditorInstance } from '~/typings'

const NoteNode: FC<InnerNodeProps> = ({ node: n, onNameChange, metaId }) => {
  const node = n as IWhiteboardNode & { type: 'note' }
  const instance = useRef<IEditorInstance>()

  return (
    <NoteEditor
      metaId={metaId}
      onInstanceInitialized={i => (instance.current = i)}
      on={event => {
        if (event.type === 'titleChange') {
          onNameChange?.(event.value)
        }
      }}
      initialHeight={useMemo(() => n.height, [])}
      layout={{
        virtualizer: true,
        showHeader: false,
        showBottomPadding: true,
        disableOverscanInReadOnly: false,
        showBlockHandleAdd: false
      }}
      title={{
        titleContainerStyle: {
          padding: '24px 0px 5px',
          maxWidth: '100%',
          width: '100%'
        },
        titleStyle: {
          fontSize: '2.4rem'
        }
      }}
      styles={{
        bottomPadding: 30,
        pageMinPadding: '0px 30px 0px',
        containerHeight: '100%',
        containerMaxHeight: 'inherit',
        containerStyle: {
          width: '520px',
          minHeight: 'max(100%, 50px)',
          maxWidth: '100%',
          minWidth: '100%'
        }
      }}
      state={{
        fontSize: 17,
        pageWidth: 'Max'
      }}
      noteId={node.noteId}
    />
  )
}

export default memo(NoteNode, (prev, curr) => prev.node === curr.node)
