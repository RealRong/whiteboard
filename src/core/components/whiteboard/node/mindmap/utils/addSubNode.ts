import { IWhiteboardNode, IWhiteboardInstance, IWhiteboardMindmap } from '~/typings'
import Id from '@/utils/id'
import calculateNewNodePosition from '@/core/components/whiteboard/node/mindmap/calculateNewNodePosition'
import { waitFor } from '@/utils'
import { getChildrenOfNode, getParentNodeOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'

const addRightOrLeftNode = (
  currNode: IWhiteboardNode,
  direction: 'right' | 'left',
  instance: IWhiteboardInstance,
  idx?: number,
  select?: boolean
) => {
  if (currNode.type === 'mindmap') {
    const newNodeId = Id.getId()
    const maxZ = instance.nodeOps?.getMaxZindex() ?? 0
    const currChildren = currNode[direction === 'right' ? 'rightChildren' : 'leftChildren']
    const index = idx ?? currChildren?.length ?? 0
    const newNode = calculateNewNodePosition(
      {
        id: newNodeId,
        x: 0,
        y: 0,
        width: 100,
        type: 'text',
        rootId: currNode.id,
        side: direction,
        borderType: currNode.borderType,
        border: currNode.border,
        z: maxZ,
        content: [{ id: Id.getId(), type: 'paragraph', children: [{ text: '' }] }]
      },
      currNode,
      direction,
      instance,
      index
    )
    if (!newNode) return
    instance.updateWhiteboard?.(w => {
      w.nodes?.set(newNodeId, newNode)
      const origin = w.nodes?.get(currNode.id)
      if (origin && origin.type === 'mindmap') {
        const currentChildren = (direction === 'left' ? origin.leftChildren ?? [] : origin.rightChildren ?? []).slice()
        currentChildren.splice(index, 0, { root: newNodeId, children: [] })
        w.nodes?.set(origin.id, {
          ...origin,
          leftChildren: direction === 'left' ? currentChildren : origin.leftChildren,
          rightChildren: direction === 'right' ? currentChildren : origin.rightChildren
        })
      }
    }, true)
    if (select) {
      setTimeout(() => {
        instance.selectOps?.deselectAll()
        instance.selectOps?.selectNode(newNode.id!)
        instance.containerOps?.fitToNode(newNode.id!, {
          changeScale: false
        })
        instance.nodeOps?.getNodeFuncs(newNode.id!)?.focusText?.()
      }, 5)
    }
  } else {
    const defaultNode = {
      width: 100,
      id: Id.getId(),
      rootId: currNode.rootId,
      border: currNode.border,
      type: 'text',
      side: direction,
      borderType: currNode.borderType,
      content: [{ id: Id.getId(), type: 'paragraph', children: [{ text: '' }] }]
    }
    const childrenNode = getChildrenOfNode(currNode, instance, direction)
    const index = idx ?? childrenNode?.length ?? 0
    const newDefaultNode = calculateNewNodePosition(defaultNode, currNode, direction, instance, index)
    if (newDefaultNode) {
      instance.insertNode?.(newDefaultNode).then(n => {
        if (n.length === 1) {
          Array.from(instance.values.ID_TO_NODE_MAP.values()).forEach(i => {
            i.onAddSubNode?.(currNode.id, n[0], index, direction)
          })
        }
      })
      waitFor(
        () => !!instance.nodeOps?.getNodeFuncs?.(newDefaultNode.id!),
        () => {
          instance.nodeOps?.getNodeFuncs(newDefaultNode.id!)?.setStyle({
            opacity: 0
          })
          setTimeout(() => {
            instance.nodeOps?.getNodeFuncs(newDefaultNode.id!)?.setStyle({
              opacity: 1
            })
            if (select) {
              instance.selectOps?.deselectAll()
              instance.selectOps?.selectNode(newDefaultNode.id!)
              instance.containerOps?.fitToNode(newDefaultNode.id!, {
                changeScale: false
              })
              instance.nodeOps?.getNodeFuncs(newDefaultNode.id!)?.focusText?.()
            }
          }, 5)
        },
        {
          requestAnimationFrame: true
        }
      )
    }
  }
}

export default (
  currNode: IWhiteboardNode,
  direction: 'right' | 'left' | 'bottom' | 'top',
  instance: IWhiteboardInstance,
  select?: boolean
) => {
  if (direction === 'right' || direction === 'left') {
    addRightOrLeftNode(currNode, direction, instance, undefined, select)
    return
  }
  // root node, top/bottom -> right
  if (currNode.type === 'mindmap') {
    addRightOrLeftNode(currNode, 'right', instance, undefined, select)
    return
  }
  if (currNode.rootId) {
    const parent = getParentNodeOfNode(currNode, instance)
    if (parent) {
      const idx = (parent.children as IWhiteboardMindmap[]).findIndex(i => i.root === currNode.id)
      if (idx >= 0) {
        const parentNode = instance.getNode?.(parent.id)
        if (parentNode) {
          if (direction === 'top') {
            addRightOrLeftNode(parentNode, 'right', instance, idx, select)
          }
          if (direction === 'bottom') {
            addRightOrLeftNode(parentNode, 'right', instance, idx + 1, select)
          }
        }
      }
    }
  }
}
