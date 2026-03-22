import {
  createDerivedStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import type { View as SelectionView } from '../selection'
import type { Tool } from '../tool'
import type { NodeChromeHidden } from '../../features/node/session/runtime'

export type NodeChrome = {
  selection: boolean
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
  left.selection === right.selection
  && left.toolbar === right.toolbar
  && left.transform === right.transform
  && left.connect === right.connect
)

const resolveNodeChrome = ({
  tool,
  edit,
  selection,
  interaction,
  chromeHidden
}: {
  tool: Tool
  edit: EditTarget
  selection: SelectionView
  interaction: InteractionMode
  chromeHidden: NodeChromeHidden
}): NodeChrome => {
  const selectionVisible = !chromeHidden
  const editing = edit !== null
  const edgeSelected = selection.target.edgeId !== undefined
  const idleLike = interaction === 'idle' || interaction === 'press'

  return {
    selection: selectionVisible,
    toolbar:
      tool.type === 'select'
      && !editing
      && idleLike
      && selectionVisible
      && !edgeSelected
      && selection.items.count > 0,
    transform:
      tool.type === 'select'
      && !editing
      && !edgeSelected
      && (
        interaction === 'node-transform'
        || (idleLike && selectionVisible)
      ),
    connect:
      tool.type === 'edge'
      && !editing
      && idleLike
      && selectionVisible
  }
}

export const createChromeRead = ({
  tool,
  edit,
  selection,
  interaction,
  chromeHidden
}: {
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
  chromeHidden: ReadStore<NodeChromeHidden>
}): ChromeRead => ({
  node: createDerivedStore<NodeChrome>({
    get: (readStore) => resolveNodeChrome({
      tool: readStore(tool),
      edit: readStore(edit),
      selection: readStore(selection),
      interaction: readStore(interaction),
      chromeHidden: readStore(chromeHidden)
    }),
    isEqual: isNodeChromeEqual
  })
})
