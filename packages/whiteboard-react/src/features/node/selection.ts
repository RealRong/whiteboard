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
import type { InternalEditor } from '../../runtime/instance'

type EditTarget = ReturnType<InternalEditor['state']['edit']['get']>
type InteractionMode = ReturnType<InternalEditor['interaction']['mode']['get']>
type SelectionView = ReturnType<InternalEditor['read']['selection']['get']>
type Tool = ReturnType<InternalEditor['state']['tool']['get']>

export type NodeSelectionView = SelectionView & {
  summary: NodeSummary
  can: NodeSelectionCan
  selectionBox: SelectionBoxView
}

export type SelectionBoxView = {
  box?: Rect
  interactive: boolean
  frame: boolean
  handles: boolean
  canResize: boolean
}

export type NodeChromeView = {
  toolbar: boolean
  transform: boolean
  connect: boolean
}

export type SelectionPresentation = {
  selection: NodeSelectionView
  chrome: NodeChromeView
  showToolbar: boolean
  singleTransformNodeId?: string
  showSelectionFrame: boolean
  showSelectionHandles: boolean
  hideSelectionFrameForSingleShape: boolean
  connectNodeIds: readonly string[]
}

const EMPTY_SUMMARY = summarizeNodes([])
const EMPTY_CAN = resolveNodeSelectionCan([])

const isSelectionBoxInteractive = (
  selection: Pick<SelectionView, 'box' | 'kind' | 'transform' | 'items'>
) => {
  if (!selection.box) {
    return false
  }

  if (selection.items.count > 1) {
    return true
  }

  return (
    selection.transform.resize === 'scale'
    && !(
      selection.kind === 'node'
      && selection.items.primaryNode?.type === 'group'
    )
  )
}

export const resolveSelectionBoxView = (
  selection: SelectionView
): SelectionBoxView => {
  const box = selection.box
  const canResize = selection.transform.resize === 'scale'

  return {
    box,
    interactive: isSelectionBoxInteractive(selection),
    frame: Boolean(box) && selection.items.nodeCount > 0,
    handles: Boolean(box) && canResize,
    canResize
  }
}

export const resolveNodeChromeView = ({
  tool,
  edit,
  selection,
  mode,
  chrome
}: {
  tool: Tool
  edit: EditTarget
  selection: SelectionView
  mode: InteractionMode
  chrome: boolean
}): NodeChromeView => {
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

export const resolveSelectionPresentation = (
  selection: NodeSelectionView,
  chrome: NodeChromeView
): SelectionPresentation => ({
  selection,
  chrome,
  showToolbar: chrome.toolbar,
  singleTransformNodeId:
    selection.kind === 'node'
      ? selection.target.nodeIds[0]
      : undefined,
  showSelectionFrame: selection.selectionBox.frame,
  showSelectionHandles:
    chrome.transform
    && selection.selectionBox.handles,
  hideSelectionFrameForSingleShape:
    selection.kind === 'node'
    && selection.items.nodeCount === 1
    && selection.items.primaryNode?.type === 'shape',
  connectNodeIds:
    chrome.connect
      ? selection.target.nodeIds
      : []
})

export const resolveNodeSelectionView = (
  selection: SelectionView,
  options?: {
    resolveMeta?: (node: Node) => NodeMeta | undefined
  }
): NodeSelectionView => {
  const nodes = selection.items.nodes
  const box = resolveSelectionBoxView(selection)

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
    selectionBox: box
  }
}

export const useSelection = (): NodeSelectionView => {
  const instance = useInternalInstance()
  const selection = useStoreValue(instance.read.selection)

  return useMemo(() => resolveNodeSelectionView(selection, {
    resolveMeta: (node) => resolveNodeMeta(instance.registry, node)
  }), [instance, selection])
}

export const useNodeChrome = (): NodeChromeView => {
  const instance = useInternalInstance()
  const tool = useTool()
  const edit = useEdit()
  const selection = useStoreValue(instance.read.selection)
  const mode = useStoreValue(instance.interaction.mode)
  const interaction = useStoreValue(instance.state.interaction)

  return useMemo(() => resolveNodeChromeView({
    tool,
    edit,
    selection,
    mode,
    chrome: interaction.chrome
  }), [edit, interaction.chrome, mode, selection, tool])
}

export const useSelectionPresentation = (): SelectionPresentation => {
  const selection = useSelection()
  const chrome = useNodeChrome()

  return useMemo(
    () => resolveSelectionPresentation(selection, chrome),
    [chrome, selection]
  )
}
