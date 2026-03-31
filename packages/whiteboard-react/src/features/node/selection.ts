import { useMemo } from 'react'
import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Rect } from '@whiteboard/core/types'
import type {
  NodeSelectionCan,
  NodeSummary,
  NodeTypeSummary
} from './summary'
import {
  readNodeLockLabel,
  readNodeSelectionCan,
  readNodeSummary
} from './summary'
import {
  useEdit,
  useEditor,
  useInteraction,
  useTool
} from '../../runtime/hooks/useEditor'
import { useStoreValue } from '../../runtime/hooks/useStoreValue'
import type { WhiteboardRuntime as Editor } from '../../types/runtime'
import { useClipboardActions } from '../../runtime/host/useClipboardActions'

type EditTarget = ReturnType<Editor['state']['edit']['get']>
type InteractionMode = ReturnType<Editor['interaction']['state']['get']>['mode']
type BaseSelection = ReturnType<Editor['read']['selection']['get']>
type Tool = ReturnType<Editor['state']['tool']['get']>

export type SelectionFilterView = {
  types: readonly NodeTypeSummary[]
  onSelect: (key: string) => unknown
}

export type SelectionMoreMenuItemView = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onSelect: () => unknown
}

export type SelectionMoreMenuSectionView = {
  key: string
  title: string
  items: readonly SelectionMoreMenuItemView[]
}

export type SelectionLayoutView = {
  canAlign: boolean
  canDistribute: boolean
  onAlign: (mode: NodeAlignMode) => unknown
  onDistribute: (mode: NodeDistributeMode) => unknown
}

export type SelectionMenuView = {
  summary: NodeSummary
  can: NodeSelectionCan
  filter?: SelectionFilterView
  moreSections: readonly SelectionMoreMenuSectionView[]
  layout: SelectionLayoutView
}

type SelectionView = BaseSelection & {
  menu?: SelectionMenuView
  nodeSummary: NodeSummary
  nodeCan: NodeSelectionCan
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

const EMPTY_SUMMARY: NodeSummary = {
  ids: [],
  count: 0,
  hasGroup: false,
  lock: 'none',
  types: [],
  mixed: false
}

const EMPTY_CAN: NodeSelectionCan = {
  fill: false,
  stroke: false,
  text: false,
  group: false,
  align: false,
  distribute: false,
  makeGroup: false,
  ungroup: false,
  order: false,
  filter: false,
  lock: false,
  copy: false,
  cut: false,
  duplicate: false,
  delete: false
}

const replaceSelection = (
  editor: Editor,
  nodeIds: readonly string[]
) => {
  editor.commands.selection.replace({
    nodeIds
  })
}

const bindAsyncClose = <Args extends unknown[]>(
  action: (...args: Args) => unknown
) => (...args: Args) => action(...args)

const readSelectionMenuView = ({
  editor,
  clipboard,
  selection,
  summary,
  can
}: {
  editor: Editor
  clipboard: ReturnType<typeof useClipboardActions>
  selection: BaseSelection
  summary: NodeSummary
  can: NodeSelectionCan
}): SelectionMenuView | undefined => {
  const nodes = selection.summary.items.nodes
  const nodeIds = summary.ids

  if (!nodeIds.length || selection.summary.items.edgeCount > 0) {
    return undefined
  }

  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)
  const filter = can.filter
    ? {
        types: summary.types,
        onSelect: bindAsyncClose((key: string) => {
          const filteredNodeIds = nodes
            .filter((node) => {
              const meta = editor.registry.get(node.type)?.describe?.(node)
                ?? editor.registry.get(node.type)?.meta
              return (meta?.key ?? node.type) === key
            })
            .map((node) => node.id)

          if (!filteredNodeIds.length) {
            return
          }

          replaceSelection(editor, filteredNodeIds)
        })
      } satisfies SelectionFilterView
    : undefined

  const order = (mode: 'front' | 'forward' | 'backward' | 'back') => {
    if (mode === 'front') {
      editor.commands.node.order.bringToFront([...nodeIds])
      return
    }
    if (mode === 'forward') {
      editor.commands.node.order.bringForward([...nodeIds])
      return
    }
    if (mode === 'backward') {
      editor.commands.node.order.sendBackward([...nodeIds])
      return
    }

    editor.commands.node.order.sendToBack([...nodeIds])
  }

  return {
    summary,
    can,
    filter,
    moreSections: [
      ...(can.order
        ? [
            {
              key: 'layer',
              title: 'Layer',
              items: [
                {
                  key: 'order.front',
                  label: 'Bring to front',
                  onSelect: () => {
                    order('front')
                  }
                },
                {
                  key: 'order.forward',
                  label: 'Bring forward',
                  onSelect: () => {
                    order('forward')
                  }
                },
                {
                  key: 'order.backward',
                  label: 'Send backward',
                  onSelect: () => {
                    order('backward')
                  }
                },
                {
                  key: 'order.back',
                  label: 'Send to back',
                  onSelect: () => {
                    order('back')
                  }
                }
              ]
            } satisfies SelectionMoreMenuSectionView
          ]
        : []),
      {
        key: 'structure',
        title: 'Structure',
        items: [
          {
            key: 'structure.group',
            label: 'Group',
            disabled: !can.makeGroup,
            onSelect: () => {
              if (nodeIds.length < 2) {
                return
              }

              const result = editor.commands.node.group.create([...nodeIds])
              if (!result.ok) {
                return
              }

              replaceSelection(editor, [result.data.groupId])
            }
          },
          {
            key: 'structure.ungroup',
            label: 'Ungroup',
            disabled: !can.ungroup,
            onSelect: () => {
              if (!groupIds.length) {
                return
              }

              const result = editor.commands.node.group.ungroupMany([...groupIds])
              if (!result.ok) {
                return
              }

              replaceSelection(editor, result.data.nodeIds)
            }
          }
        ]
      },
      ...(can.lock
        ? [
            {
              key: 'state',
              title: 'State',
              items: [
                {
                  key: 'state.lock',
                  label: readNodeLockLabel(summary),
                  onSelect: () => {
                    editor.commands.node.lock.set([...nodeIds], summary.lock !== 'all')
                  }
                }
              ]
            } satisfies SelectionMoreMenuSectionView
          ]
        : []),
      {
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.copy',
            label: 'Copy',
            disabled: !can.copy,
            onSelect: () => {
              if (!nodeIds.length) {
                return
              }

              return clipboard.copy({
                nodeIds
              })
            }
          },
          {
            key: 'edit.cut',
            label: 'Cut',
            disabled: !can.cut,
            onSelect: () => {
              if (!nodeIds.length) {
                return
              }

              return clipboard.cut({
                nodeIds
              })
            }
          },
          {
            key: 'edit.duplicate',
            label: 'Duplicate',
            disabled: !can.duplicate,
            onSelect: () => {
              if (!nodeIds.length) {
                return
              }

              const result = editor.commands.node.duplicate([...nodeIds])
              if (!result.ok || result.data.nodeIds.length <= 0) {
                return
              }

              replaceSelection(editor, result.data.nodeIds)
            }
          }
        ]
      },
      ...(can.delete
        ? [
            {
              key: 'danger',
              title: 'Danger',
              items: [
                {
                  key: 'danger.delete',
                  label: 'Delete',
                  tone: 'danger' as const,
                  onSelect: () => {
                    editor.commands.node.deleteCascade([...nodeIds])
                  }
                }
              ]
            } satisfies SelectionMoreMenuSectionView
          ]
        : [])
    ],
    layout: {
      canAlign: can.align,
      canDistribute: can.distribute,
      onAlign: bindAsyncClose((mode) => {
        if (nodeIds.length < 2) {
          return
        }

        editor.commands.node.align([...nodeIds], mode)
      }),
      onDistribute: bindAsyncClose((mode) => {
        if (nodeIds.length < 3) {
          return
        }

        editor.commands.node.distribute([...nodeIds], mode)
      })
    }
  }
}

const resolveSelectionBoxState = (
  selection: BaseSelection
): SelectionBoxState => {
  const box = selection.summary.box
  const canResize = selection.summary.transform.resize === 'scale'

  return {
    box,
    interactive: selection.summary.boxInteractive,
    frame: Boolean(box) && selection.summary.items.nodeCount > 0,
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
  selection: SelectionView
  mode: InteractionMode
  chrome: boolean
}): SelectionChrome => {
  const editing = edit !== null
  const pureNodeSelection =
    (selection.summary.kind === 'node' || selection.summary.kind === 'nodes')
    && selection.summary.items.edgeCount === 0

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
      && selection.summary.items.count > 0
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
    selection.summary.kind === 'node'
      ? selection.summary.target.nodeIds[0]
      : undefined,
  showSelectionFrame: selection.boxState.frame,
  showSelectionHandles:
    chrome.transform
    && selection.boxState.handles,
  hideSelectionFrameForSingleShape:
    selection.summary.kind === 'node'
    && selection.summary.items.nodeCount === 1
    && selection.summary.items.primaryNode?.type === 'shape',
  connectNodeIds:
    chrome.connect
      ? selection.summary.target.nodeIds
      : []
})

const resolveSelectionView = (
  editor: Editor,
  selection: BaseSelection,
  clipboard: ReturnType<typeof useClipboardActions>
): SelectionView => {
  const boxState = resolveSelectionBoxState(selection)
  const pureNodeSelection =
    selection.summary.items.nodeCount > 0
    && selection.summary.items.edgeCount === 0
  const nodeSummary = pureNodeSelection
    ? readNodeSummary({
        selection,
        registry: editor.registry
      })
    : EMPTY_SUMMARY
  const nodeCan = pureNodeSelection
    ? readNodeSelectionCan(selection.can)
    : EMPTY_CAN

  return {
    ...selection,
    menu: pureNodeSelection
      ? readSelectionMenuView({
          editor,
          clipboard,
          selection,
          summary: nodeSummary,
          can: nodeCan
        })
      : undefined,
    nodeSummary,
    nodeCan,
    boxState
  }
}

export const useSelection = () => {
  const editor = useEditor()
  const clipboard = useClipboardActions()
  const selection = useStoreValue(editor.read.selection)

  return useMemo(
    () => resolveSelectionView(editor, selection, clipboard),
    [clipboard, editor, selection]
  )
}

export const useSelectionPresentation = () => {
  const selection = useSelection()
  const tool = useTool()
  const edit = useEdit()
  const interaction = useInteraction()

  return useMemo(() => {
    const chrome = resolveSelectionChrome({
      tool,
      edit,
      selection,
      mode: interaction.mode,
      chrome: interaction.chrome
    })

    return resolveSelectionPresentation(selection, chrome)
  }, [edit, interaction.chrome, interaction.mode, selection, tool])
}
