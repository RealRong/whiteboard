import { InnerNodeProps } from '../WrapperNode'
import { IEditorInstance, IWhiteboardNode } from '~/typings'
import SimpleEditor from '@/core/components/editor/SimpleEditor'
import { useRef, memo, useMemo, useLayoutEffect } from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { BaseSelection, Descendant, Editor, Node, Transforms } from 'slate'
import { ReactEditor } from '@/core'

const TextNode = ({ node, onClick, nodeState, setNodeState }: InnerNodeProps & { onClick: VoidFunction }) => {
  const textNode = node as IWhiteboardNode & { type: 'text' }
  const instance = useWhiteboardInstance()
  const selectionRef = useRef<BaseSelection>()
  const i = useRef<IEditorInstance>()
  useLayoutEffect(() => {
    const currC = i.current?.getSlateEditor?.().children
    if (currC && currC !== textNode.content) {
      i.current?.replaceChildren?.(textNode.content)
    }
  }, [textNode.content])
  useLayoutEffect(() => {
    if (nodeState?.focused) {
      return () => {
        selectionRef.current = i.current?.getSlateEditor?.().selection
        i.current?.getSlateEditor?.().deselect()
      }
    }
  }, [nodeState?.focused])
  const handleChangeValue = (newValue: Descendant[]) => {
    if (newValue !== textNode.content) {
      instance.updateNode?.(textNode.id, n => ({ ...n, content: newValue }), false)
    }
  }
  const initialOkay = useMemo(() => Node.isNodeList(textNode.content), [])
  if (!initialOkay) {
    instance.deleteNode?.(node.id!)
    return null
  }
  const assignFocus = (i: IEditorInstance) => {
    const funcs = instance.nodeOps?.getNodeFuncs?.(node.id!)
    if (funcs) {
      funcs.focusText = () => {
        const e = i.getSlateEditor?.()
        setNodeState?.(s => ({ ...s, focused: true, selected: true }))
        if (e) {
          if (!ReactEditor.isFocused(e)) {
            ReactEditor.focus(e)
            Transforms.select(e, selectionRef.current || e.selection || Editor.end(e, []))
          }
        }
      }
    }
  }
  const padding = node.type === 'mindmap' ? '6px 12px' : '3px 8px'
  const renderEditor = () => (
    <SimpleEditor
      textareaMode={true}
      placeholder={node.type === 'mindmap' || node.rootId ? '' : undefined}
      virtualizer={false}
      onInstanceInitialized={ins => {
        i.current = ins
        assignFocus(ins)
      }}
      value={textNode.content}
      onClick={onClick}
      containerStyle={{
        width: node.resized ? undefined : node.type === 'mindmap' || node.rootId ? undefined : '200px',
        height: '100%',
        position: 'relative',
        background: 'transparent',
        minWidth: '100%',
        maxWidth: '100%',
        minHeight: '100%',
        maxHeight: '100%',
        pointerEvents: 'auto',
        padding: node.resized ? undefined : padding,
        fontWeight: node.type === 'mindmap' ? 600 : undefined
      }}
      fontSize={node.type === 'mindmap' ? 24 : undefined}
      onChange={v => {
        handleChangeValue(v)
      }}
    />
  )
  if (node.resized) {
    // extra div wrapper, prevent lose padding
    return (
      <div
        style={{
          height: '100%',
          background: 'transparent',
          width: node.type === 'mindmap' || node.rootId ? undefined : '200px',
          minWidth: '100%',
          maxWidth: '100%',
          minHeight: '100%',
          maxHeight: '100%',
          padding,
          pointerEvents: 'auto'
        }}
      >
        {renderEditor()}
      </div>
    )
  }
  return renderEditor()
}

export default memo(
  TextNode,
  (curr, prev) => curr.node === prev.node && prev.nodeState?.focused === curr.nodeState?.focused && prev.node.resized === curr.node.resized
)
