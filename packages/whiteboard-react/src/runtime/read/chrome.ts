import {
  createDerivedStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import type { View as SelectionView } from '../selection'
import type { Tool } from '../tool'

export type NodeChrome = {
  toolbar: boolean
  transform: boolean
  connect: boolean
}

export type ChromeRead = {
  node: ReadStore<NodeChrome>
}

const isNodeChromeEqual = (
  left: NodeChrome,
  right: NodeChrome
) => (
  left.toolbar === right.toolbar
  && left.transform === right.transform
  && left.connect === right.connect
)

const resolveNodeChrome = ({
  tool,
  edit,
  selection,
  interaction
}: {
  tool: Tool
  edit: EditTarget
  selection: SelectionView
  interaction: InteractionMode
}): NodeChrome => {
  const editing = edit !== null
  const idleLike = interaction === 'idle' || interaction === 'press'
  const pureNodeSelection =
    (selection.kind === 'node' || selection.kind === 'nodes')
    && selection.items.edgeCount === 0

  return {
    toolbar:
      tool.type === 'select'
      && !editing
      && idleLike
      && pureNodeSelection,
    transform:
      tool.type === 'select'
      && !editing
      && pureNodeSelection
      && (
        interaction === 'node-transform'
        || idleLike
      ),
    connect:
      tool.type === 'edge'
      && !editing
      && idleLike
      && selection.items.count > 0
  }
}

export const createChromeRead = ({
  tool,
  edit,
  selection,
  interaction
}: {
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
}): ChromeRead => ({
  node: createDerivedStore<NodeChrome>({
    get: (readStore) => resolveNodeChrome({
      tool: readStore(tool),
      edit: readStore(edit),
      selection: readStore(selection),
      interaction: readStore(interaction)
    }),
    isEqual: isNodeChromeEqual
  })
})
