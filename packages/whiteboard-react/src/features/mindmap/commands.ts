import {
  resolveInsertPlan,
  type MindmapInsertPlacement,
  type MindmapLayoutConfig
} from '@whiteboard/core/mindmap'
import type {
  MindmapAttachPayload,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point,
  Size
} from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance/types'

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
  instance: WhiteboardInstance,
  nodeId: NodeId
) => {
  const node = instance.read.index.node.get(nodeId)?.node
  return node && 'position' in node
    ? node.position
    : undefined
}

export const insertMindmapByPlacement = ({
  instance,
  id,
  tree,
  targetNodeId,
  placement,
  nodeSize,
  layout,
  payload
}: {
  instance: WhiteboardInstance
  id: NodeId
  tree: MindmapTree
  targetNodeId: MindmapNodeId
  placement: MindmapInsertPlacement
  nodeSize: Size
  layout: MindmapLayoutConfig
  payload?: MindmapNodeData | MindmapAttachPayload
}) => {
  const normalizedPayload: MindmapNodeData | MindmapAttachPayload = payload ?? {
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
    return instance.commands.mindmap.insert(id, {
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
    return instance.commands.mindmap.insert(id, {
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
    return instance.commands.mindmap.insert(id, {
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
  instance,
  id,
  nodeId,
  drop,
  origin,
  nodeSize,
  layout
}: {
  instance: WhiteboardInstance
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

  return instance.commands.mindmap.moveSubtree(id, {
    nodeId,
    parentId: drop.parentId,
    index: drop.index,
    side: drop.side,
    layout: createLayoutHint(drop.parentId, nodeSize, layout)
  })
}

export const moveMindmapRoot = ({
  instance,
  nodeId,
  position,
  origin,
  threshold = DEFAULT_ROOT_MOVE_THRESHOLD
}: {
  instance: WhiteboardInstance
  nodeId: NodeId
  position: Point
  origin?: Point
  threshold?: number
}) => {
  const previous = origin ?? readNodePosition(instance, nodeId)
  if (
    previous
    && Math.abs(previous.x - position.x) < threshold
    && Math.abs(previous.y - position.y) < threshold
  ) {
    return undefined
  }

  return instance.commands.node.update(nodeId, {
    fields: {
      position: {
        x: position.x,
        y: position.y
      }
    }
  })
}
