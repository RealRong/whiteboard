import type { Node } from '@whiteboard/core/types'
import type { Editor } from '../../../runtime/instance'
import {
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_PLACEHOLDER,
  measureTextNodeSize
} from '../../node/text'

type NodeToolbarTextInstance = Pick<Editor, 'commands' | 'read'>

const queryNodeTextSource = ({
  container,
  nodeId,
  field
}: {
  container: HTMLDivElement | null
  nodeId: string
  field: 'title' | 'text'
}) => {
  if (!container) {
    return undefined
  }

  const element = container.querySelector(
    `[data-node-id="${nodeId}"] [data-node-editable-field="${field}"]`
  )

  return element instanceof HTMLElement
    ? element
    : undefined
}

export const commitNodeToolbarText = ({
  instance,
  container,
  node,
  field,
  value
}: {
  instance: NodeToolbarTextInstance
  container: HTMLDivElement | null
  node: Node
  field: 'title' | 'text'
  value: string
}) => {
  if (node.type !== 'text') {
    instance.commands.node.text.commit({
      nodeId: node.id,
      field,
      value
    })
    return
  }

  const source = queryNodeTextSource({
    container,
    nodeId: node.id,
    field
  })
  const committedRect = instance.read.node.committedItem.get(node.id)?.rect
  const size = source && committedRect
    ? measureTextNodeSize({
        node,
        content: value,
        placeholder: TEXT_PLACEHOLDER,
        source,
        width: committedRect.width
      })
    : undefined

  instance.commands.node.text.commit({
    nodeId: node.id,
    field,
    value,
    measuredSize:
      size
      && committedRect
      && (size.width !== committedRect.width || size.height !== committedRect.height)
        ? size
        : undefined
  })
}

export const updateNodeToolbarTextFontSize = ({
  instance,
  container,
  node,
  field,
  value
}: {
  instance: NodeToolbarTextInstance
  container: HTMLDivElement | null
  node: Node
  field: 'title' | 'text'
  value: number | undefined
}) => {
  const source = queryNodeTextSource({
    container,
    nodeId: node.id,
    field
  })
  const committedRect = instance.read.node.committedItem.get(node.id)?.rect
  const textValue = typeof node.data?.[field] === 'string'
    ? node.data[field] as string
    : ''
  const size = source && committedRect
    ? measureTextNodeSize({
        node,
        content: textValue,
        placeholder: TEXT_PLACEHOLDER,
        source,
        width: committedRect.width,
        fontSize: value ?? TEXT_DEFAULT_FONT_SIZE
      })
    : undefined

  instance.commands.node.text.setFontSize({
    nodeIds: [node.id],
    value,
    measuredSizeById:
      size
      && committedRect
      && (size.width !== committedRect.width || size.height !== committedRect.height)
        ? {
            [node.id]: size
          }
        : undefined
  })
}
