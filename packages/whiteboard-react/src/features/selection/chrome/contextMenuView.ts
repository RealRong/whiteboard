import type {
  EdgeId,
  Node as WhiteboardNode,
  Point
} from '@whiteboard/core/types'
import type { ContextResolved } from '@whiteboard/editor/input'
import type { Editor } from '../../../runtime/instance'
import type { NodeMeta } from '../../../types/node'
import {
  resolveNodeSelectionCan,
  summarizeNodes,
  type NodeSummary
} from '../../node/summary'
import { CREATE_PRESETS } from '../../toolbox/presets'
import {
  resolveSelectionContextMenuGroups,
  resolveSelectionFilter,
  runMenuAction,
  type SelectionMenuFilter
} from './selectionMenu'
import { buildSelectionStyleContextMenuGroup } from './selectionStyleMenu'
import type { ContextMenuGroup } from './contextMenuTypes'

export type ContextMenuView = {
  summary?: NodeSummary
  filter?: SelectionMenuFilter
  groups: readonly ContextMenuGroup[]
}

export type ContextMenuResolveMeta = (
  node: WhiteboardNode
) => NodeMeta | undefined

type ContextMenuInstance = Pick<
  Editor,
  'commands' | 'host' | 'read' | 'state' | 'viewport'
>

const readCanvasMenuView = ({
  instance,
  world,
  close
}: {
  instance: ContextMenuInstance
  world: Point
  close: () => void
}): ContextMenuView => {
  const frame = instance.read.frame.scope.get()

  return {
    groups: [
      {
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.paste',
            label: 'Paste',
            onClick: runMenuAction(() => instance.commands.clipboard.paste({
              at: world,
              ownerId: frame.id
            }), close)
          }
        ]
      },
      {
        key: 'create',
        title: 'Create',
        items: CREATE_PRESETS.map((preset) => ({
          key: preset.key,
          label: preset.label,
          onClick: runMenuAction(() => instance.commands.insert.preset(preset.key, {
            at: world,
            ownerId: frame.id
          }), close)
        }))
      },
      {
        key: 'history',
        title: 'History',
        items: [
          {
            key: 'history.undo',
            label: 'Undo',
            onClick: runMenuAction(() => instance.commands.history.undo(), close)
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onClick: runMenuAction(() => instance.commands.history.redo(), close)
          }
        ]
      },
      {
        key: 'selection',
        title: 'Selection',
        items: [
          {
            key: 'selection.select-all',
            label: 'Select all',
            onClick: runMenuAction(() => instance.commands.selection.selectAll(), close)
          }
        ]
      }
    ]
  }
}

const readNodeMenuView = ({
  instance,
  nodes,
  close,
  resolveMeta
}: {
  instance: ContextMenuInstance
  nodes: readonly WhiteboardNode[]
  close: () => void
  resolveMeta?: ContextMenuResolveMeta
}): ContextMenuView => {
  const summary = summarizeNodes(nodes, {
    resolveMeta
  })
  const can = resolveNodeSelectionCan(nodes, {
    resolveMeta
  })
  const styleGroup = buildSelectionStyleContextMenuGroup({
    instance,
    nodes,
    close
  })

  return {
    summary: nodes.length > 1 ? summary : undefined,
    filter: resolveSelectionFilter({
      instance,
      nodes,
      summary,
      can,
      resolveMeta,
      close
    }),
    groups: [
      ...(styleGroup ? [styleGroup] : []),
      ...resolveSelectionContextMenuGroups({
        instance,
        nodes,
        summary,
        can,
        close
      })
    ]
  }
}

const readEdgeMenuView = ({
  instance,
  edgeId,
  close
}: {
  instance: ContextMenuInstance
  edgeId: EdgeId
  close: () => void
}): ContextMenuView => ({
  groups: [
    {
      key: 'edge.actions',
      items: [
        {
          key: 'edge.copy',
          label: 'Copy',
          onClick: runMenuAction(() => instance.commands.clipboard.copy({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onClick: runMenuAction(() => instance.commands.clipboard.cut({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: runMenuAction(() => instance.commands.edge.delete([edgeId]), close)
        }
      ]
    }
  ]
})

export const readContextMenuView = ({
  instance,
  target,
  close,
  resolveMeta
}: {
  instance: ContextMenuInstance
  target: ContextResolved | undefined
  close: () => void
  resolveMeta?: ContextMenuResolveMeta
}): ContextMenuView | undefined => {
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'canvas':
      return readCanvasMenuView({
        instance,
        world: target.world,
        close
      })
    case 'node':
      return readNodeMenuView({
        instance,
        nodes: [target.node],
        close,
        resolveMeta
      })
    case 'nodes':
      return readNodeMenuView({
        instance,
        nodes: target.nodes,
        close,
        resolveMeta
      })
    case 'edge':
      return readEdgeMenuView({
        instance,
        edgeId: target.edgeId,
        close
      })
  }
}
