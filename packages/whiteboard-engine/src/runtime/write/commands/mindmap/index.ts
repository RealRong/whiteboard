import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapNodeId } from '@whiteboard/core/types'
import { getSide as getMindmapSide } from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../../../config'
import { createBaseMindmapCommands } from './base'
import { createMindmapHelpers } from './helpers'

type Options = {
  instance: Pick<InternalInstance, 'document' | 'mutate'>
}

export type MindmapCommandsApi = Commands['mindmap'] & {
  readonly name: 'Mindmap'
}

export const createMindmapCommands = ({ instance }: Options): MindmapCommandsApi => {
  const helpers = createMindmapHelpers({ instance })
  const baseCommands = createBaseMindmapCommands({
    instance,
    helpers
  })

  const insertNode: Commands['mindmap']['insertNode'] = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload = { kind: 'text', text: '' }
  }) => {
    const layoutHint = helpers.toLayoutHint(targetNodeId, nodeSize, layout)

    if (targetNodeId === tree.rootId) {
      const children = tree.children[targetNodeId] ?? []
      const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
      const side = helpers.resolveRootInsertSide(placement, layout)
      await baseCommands.addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await baseCommands.addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getMindmapSide(tree, targetNodeId) ?? DEFAULT_TUNING.mindmap.defaultSide
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await baseCommands.addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return

      await baseCommands.moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: helpers.toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await baseCommands.addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  const moveSubtreeWithLayout: Commands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    baseCommands.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: helpers.toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveSubtreeWithDrop: Commands['mindmap']['moveSubtreeWithDrop'] = async ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }) => {
    const shouldMove =
      drop.parentId !== origin?.parentId || drop.index !== origin?.index || typeof drop.side !== 'undefined'
    if (!shouldMove) return

    await moveSubtreeWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  const moveRoot: Commands['mindmap']['moveRoot'] = async ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }) => {
    const node = instance.document.get().nodes.find((item) => item.id === nodeId)
    if (!node) return
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return
    }

    await instance.mutate(
      [{
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: position.x, y: position.y }
        }
      }],
      'ui'
    )
  }

  return {
    name: 'Mindmap',
    ...baseCommands,
    insertNode,
    moveSubtreeWithLayout,
    moveSubtreeWithDrop,
    moveRoot
  }
}
