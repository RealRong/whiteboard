import type { EngineInstance } from '@whiteboard/engine'
import {
  resolveInsertPlan,
  type MindmapInsertPlacement,
  type MindmapLayoutConfig
} from '@whiteboard/core/mindmap'
import type {
  MindmapInsertPayload,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point,
  Size
} from '@whiteboard/core/types'
import type { Editor } from '../../types/editor'
import type { EditorCommandHost } from '../editor/types'

type MindmapCommandEditor = Pick<Editor, 'commands' | 'read'>

const DEFAULT_MINDMAP_SIDE: 'left' | 'right' = 'right'
const DEFAULT_ROOT_MOVE_THRESHOLD = 0.5

const createLayoutHint = (
  anchorId: MindmapNodeId,
  nodeSize: Size,
  layout: MindmapLayoutConfig
) => ({
  nodeSize,
  mode: layout.mode,
  options: layout.options,
  anchorId
})

const readNodePosition = (
  editor: MindmapCommandEditor,
  nodeId: NodeId
) => {
  const node = editor.read.index.node.get(nodeId)?.node
  return node && 'position' in node
    ? node.position
    : undefined
}

export const insertMindmapByPlacement = ({
  editor,
  id,
  tree,
  targetNodeId,
  placement,
  nodeSize,
  layout,
  payload
}: {
  editor: MindmapCommandEditor
  id: NodeId
  tree: MindmapTree
  targetNodeId: MindmapNodeId
  placement: MindmapInsertPlacement
  nodeSize: Size
  layout: MindmapLayoutConfig
  payload?: MindmapNodeData | MindmapInsertPayload
}) => {
  const normalizedPayload: MindmapNodeData | MindmapInsertPayload = payload ?? {
    kind: 'text',
    text: ''
  }
  const hint = createLayoutHint(targetNodeId, nodeSize, layout)
  const plan = resolveInsertPlan({
    tree,
    targetNodeId,
    placement,
    layoutSide: layout.options?.side,
    defaultSide: DEFAULT_MINDMAP_SIDE
  })

  if (plan.mode === 'child') {
    return editor.commands.mindmap.insert(id, {
      kind: 'child',
      parentId: plan.parentId,
      payload: normalizedPayload,
      options: {
        index: plan.index,
        side: plan.side,
        layout: hint
      }
    })
  }

  if (plan.mode === 'sibling') {
    return editor.commands.mindmap.insert(id, {
      kind: 'sibling',
      nodeId: plan.nodeId,
      position: plan.position,
      payload: normalizedPayload,
      options: {
        layout: hint
      }
    })
  }

  if (plan.mode === 'towardRoot') {
    return editor.commands.mindmap.insert(id, {
      kind: 'parent',
      nodeId: plan.nodeId,
      payload: normalizedPayload,
      options: {
        layout: hint
      }
    })
  }

  return undefined
}

export const moveMindmapByDrop = ({
  editor,
  id,
  nodeId,
  drop,
  origin,
  nodeSize,
  layout
}: {
  editor: MindmapCommandEditor
  id: NodeId
  nodeId: MindmapNodeId
  drop: {
    parentId: MindmapNodeId
    index: number
    side?: 'left' | 'right'
  }
  origin?: {
    parentId?: MindmapNodeId
    index?: number
  }
  nodeSize: Size
  layout: MindmapLayoutConfig
}) => {
  const shouldMove =
    drop.parentId !== origin?.parentId
    || drop.index !== origin?.index
    || typeof drop.side !== 'undefined'
  if (!shouldMove) {
    return undefined
  }

  return editor.commands.mindmap.moveSubtree(id, {
    nodeId,
    parentId: drop.parentId,
    index: drop.index,
    side: drop.side,
    layout: createLayoutHint(drop.parentId, nodeSize, layout)
  })
}

export const moveMindmapRoot = ({
  editor,
  nodeId,
  position,
  origin,
  threshold = DEFAULT_ROOT_MOVE_THRESHOLD
}: {
  editor: MindmapCommandEditor
  nodeId: NodeId
  position: Point
  origin?: Point
  threshold?: number
}) => {
  const previous = origin ?? readNodePosition(editor, nodeId)
  if (
    previous
    && Math.abs(previous.x - position.x) < threshold
    && Math.abs(previous.y - position.y) < threshold
  ) {
    return undefined
  }

  return editor.commands.node.document.update(nodeId, {
    fields: {
      position: {
        x: position.x,
        y: position.y
      }
    }
  })
}

export const createMindmapCommands = ({
  engine,
  commandHost
}: {
  engine: EngineInstance
  commandHost: EditorCommandHost
}): Editor['commands']['mindmap'] => ({
  ...engine.commands.mindmap,
  insertByPlacement: (input) => insertMindmapByPlacement({
    editor: commandHost,
    ...input
  }),
  moveByDrop: (input) => moveMindmapByDrop({
    editor: commandHost,
    ...input
  }),
  moveRoot: (input) => moveMindmapRoot({
    editor: commandHost,
    ...input
  })
})
