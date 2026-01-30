import { IWhiteboardInstance, IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import { getChildrenOfNode, getFlattenChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'
import Id from '@/utils/id'

export const cloneMindmap = (
  node: IWhiteboardNode,
  instance: IWhiteboardInstance
):
  | {
      insertNewNodes: IWhiteboardNode[]
      deletedNodeIds: Set<number>
      newMindmap: IWhiteboardNode
    }
  | undefined => {
  const oldIdToNewId: Record<number, number> = {}
  const loop = (children: IWhiteboardMindmap[]): IWhiteboardMindmap[] => {
    return children.map(r => {
      if (oldIdToNewId[r.root]) {
        return {
          ...r,
          children: loop(r.children),
          root: oldIdToNewId[r.root]
        }
      }
      return {
        ...r,
        children: loop(r.children)
      }
    })
  }
  let subChildren: IWhiteboardMindmap[] = []
  let newMindmap: IWhiteboardNode & { type: 'mindmap' } = {}
  let inserted = []
  if (node.type === 'mindmap') {
    const allRightNodes = getFlattenChildrenOfNode(node, instance, 'right') || []
    const allLeftNodes = getFlattenChildrenOfNode(node, instance, 'left') || []
    subChildren = [...allLeftNodes, ...allRightNodes]
    inserted = subChildren
      .map(i => {
        try {
          return instance.getNode?.(i.root)
        } catch (e) {
          return undefined
        }
      })
      .filter(i => i)
      .map(i => {
        const newId = Id.getId()
        oldIdToNewId[i!.id] = newId
        return { ...i, id: newId }
      })
    const newRightChildren = loop(node.rightChildren || [])
    const newLeftChildren = loop(node.leftChildren || [])
    newMindmap = {
      ...node,
      rightChildren: newRightChildren,
      leftChildren: newLeftChildren
    }
  }
  if (node.rootId) {
    const root = instance.getNode?.(node.rootId)
    if (!root || root.type !== 'mindmap') return
    subChildren = getFlattenChildrenOfNode(node, instance, node.side) || []
    const children = getChildrenOfNode(node, instance, node.side)
    console.log(subChildren, children)
    inserted = subChildren
      .map(i => {
        try {
          return instance.getNode?.(i.root)
        } catch (e) {
          return undefined
        }
      })
      .filter(i => i)
      .map(i => {
        const newId = Id.getId()
        oldIdToNewId[i!.id] = newId
        return { ...i, id: newId }
      })
    newMindmap = {
      ...node,
      type: 'mindmap',
      nodeType: node.type,
      rootId: undefined,
      side: undefined,
      edgeColor: root.edgeColor,
      edgeType: root.edgeType,
      [node.side === 'right' ? 'rightChildren' : 'leftChildren']: loop(children || [])
    }
  }
  return {
    insertNewNodes: inserted,
    newMindmap: newMindmap,
    deletedNodeIds: new Set(Object.keys(oldIdToNewId).map(i => Number(i)))
  }
}

export const canCloneMindmap = (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  if (node.type === 'mindmap') {
    return true
  }
  if (node.rootId) {
    try {
      if (instance.getNode?.(node.rootId)) {
        return true
      }
    } catch (e) {
      return false
    }
    return false
  }
}
