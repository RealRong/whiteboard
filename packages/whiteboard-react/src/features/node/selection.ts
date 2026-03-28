import { useMemo } from 'react'
import type { Node, Rect } from '@whiteboard/core/types'
import type { NodeMeta } from '../../types/node'
import {
  resolveNodeSelectionCan,
  summarizeNodes,
  type NodeSelectionCan,
  type NodeSummary
} from './summary'
import { resolveNodeMeta } from './registry'
import {
  useEdit,
  useInternalInstance,
  useTool
} from '../../runtime/hooks'
import { useStoreValue } from '../../runtime/hooks/useStoreValue'
import type { Editor } from '../../runtime/instance'

type EditTarget = ReturnType<Editor['state']['edit']['get']>
type InteractionMode = ReturnType<Editor['host']['interaction']['mode']['get']>
type BaseSelection = ReturnType<Editor['read']['selection']['get']>
type Tool = ReturnType<Editor['state']['tool']['get']>

type SelectionView = BaseSelection & {
  summary: NodeSummary
  can: NodeSelectionCan
  boxState: SelectionBoxState
}

type SelectionBoxState = {
  box?: Rect
  interactive: boolean
  frame: boolean
  handles: boolean
  canResize: boolean
}

type SelectionChrome = {
  toolbar: boolean
  transform: boolean
  connect: boolean
}

type SelectionPresentation = {
  selection: SelectionView
  chrome: SelectionChrome
  showToolbar: boolean
  singleTransformNodeId?: string
  showSelectionFrame: boolean
  showSelectionHandles: boolean
  hideSelectionFrameForSingleShape: boolean
  connectNodeIds: readonly string[]
}

const EMPTY_SUMMARY = summarizeNodes([])
const EMPTY_CAN = resolveNodeSelectionCan([])

const resolveSelectionBoxState = (
  selection: BaseSelection
): SelectionBoxState => {
  const box = selection.box
  const canResize = selection.transform.resize === 'scale'

  return {
    box,
    interactive: selection.boxInteractive,
    frame: Boolean(box) && selection.items.nodeCount > 0,
    handles: Boolean(box) && canResize,
    canResize
  }
}

const resolveSelectionChrome = ({
  tool,
  edit,
  selection,
  mode,
  chrome
}: {
  tool: Tool
  edit: EditTarget
  selection: BaseSelection
  mode: InteractionMode
  chrome: boolean
}): SelectionChrome => {
  const editing = edit !== null
  const pureNodeSelection =
    (selection.kind === 'node' || selection.kind === 'nodes')
    && selection.items.edgeCount === 0

  return {
    toolbar:
      tool.type === 'select'
      && !editing
      && chrome
      && pureNodeSelection,
    transform:
      tool.type === 'select'
      && !editing
      && pureNodeSelection
      && (
        mode === 'node-transform'
        || chrome
      ),
    connect:
      tool.type === 'edge'
      && !editing
      && chrome
      && selection.items.count > 0
  }
}

const resolveSelectionPresentation = (
  selection: SelectionView,
  chrome: SelectionChrome
): SelectionPresentation => ({
  selection,
  chrome,
  showToolbar: chrome.toolbar,
  singleTransformNodeId:
    selection.kind === 'node'
      ? selection.target.nodeIds[0]
      : undefined,
  showSelectionFrame: selection.boxState.frame,
  showSelectionHandles:
    chrome.transform
    && selection.boxState.handles,
  hideSelectionFrameForSingleShape:
    selection.kind === 'node'
    && selection.items.nodeCount === 1
    && selection.items.primaryNode?.type === 'shape',
  connectNodeIds:
    chrome.connect
      ? selection.target.nodeIds
      : []
})

const resolveSelectionView = (
  selection: BaseSelection,
  options?: {
    resolveMeta?: (node: Node) => NodeMeta | undefined
  }
): SelectionView => {
  const nodes = selection.items.nodes
  const boxState = resolveSelectionBoxState(selection)

  return {
    ...selection,
    summary: nodes.length > 0
      ? summarizeNodes(nodes, {
          resolveMeta: options?.resolveMeta
        })
      : EMPTY_SUMMARY,
    can: nodes.length > 0
      ? resolveNodeSelectionCan(nodes, {
          resolveMeta: options?.resolveMeta
        })
      : EMPTY_CAN,
    boxState
  }
}

export const useSelection = () => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveSelectionView(selection, {
    resolveMeta: (node) => resolveNodeMeta(instance.host.registry, node)
  }), [instance, selection])
}

export const useSelectionPresentation = () => {
  const instance = useInternalInstance()
  const selection = useSelection()
  const tool = useTool()
  const edit = useEdit()
  const mode = useStoreValue(instance.host.interaction.mode)
  const interaction = useStoreValue(instance.state.interaction)

  return useMemo(() => {
    const chrome = resolveSelectionChrome({
      tool,
      edit,
      selection,
      mode,
      chrome: interaction.chrome
    })

    return resolveSelectionPresentation(selection, chrome)
  }, [edit, interaction.chrome, mode, selection, tool])
}
