import { IWhiteboardInstance, IWhiteboardMindmap, IWhiteboardNode, WhiteboardEvents } from '~/typings'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Edge from '@/core/components/whiteboard/edge/Edge'
import dragAllMindmapChildren from '@/core/components/whiteboard/node/mindmap/dragAllMindmapChildren'
import { addToTree, findDragIndex } from '@/core/components/whiteboard/node/mindmap/drag/handleNodeDragEnd'
import removeSubNode from '@/core/components/whiteboard/node/mindmap/removeSubNode'
import { deleteChildsFromTree, flattenTree, getChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'
import { Colors } from '@/consts'
import produce from 'immer'
import { Id } from '@/utils'

export default (
  node: IWhiteboardNode & { type: 'mindmap' },
  opts: {
    mindmapCoreId: number
    subNodeIds: {
      current: {
        left: Set<number>
        right: Set<number>
      }
    }
    handleBothTreeChange: VoidFunction
    layoutCache?: {
      current: any
    }
    links: {
      sourceId: number
      targetId: number
      direction: 'left' | 'right'
    }[]
  }
) => {
  const { subNodeIds, mindmapCoreId, layoutCache, handleBothTreeChange, links } = opts
  const instance = useWhiteboardInstance()
  const edgeLayer = instance.getEdgeLayer?.()
  const [tempLink, setTempLink] = useState<{
    sourceId: number
    targetId: number
    direction: 'left' | 'right'
    fakeNode?: HTMLElement
  }>()
  const [isDraggingSelf, setIsDraggingSelf] = useState(false)
  const handleNodeDrag = ({ draggingNode, delta, attachableNode }: WhiteboardEvents['nodeDrag']) => {
    // drag self
    if (draggingNode.id === node.id) {
      // set dragging self to hide edge labels
      if (!isDraggingSelf) {
        setIsDraggingSelf(true)
      }
      // drag all children
      if (layoutCache?.current) {
        dragAllMindmapChildren(
          instance,
          [...subNodeIds.current.left, ...subNodeIds.current.right],
          links.map(link => `${mindmapCoreId}_${link.sourceId}_${link.targetId}`),
          delta
        )
      }
    } else {
      // attachable node is self or contains
      if (
        attachableNode &&
        (attachableNode.node.id === node.id ||
          subNodeIds.current.right.has(attachableNode.node.id) ||
          subNodeIds.current.left.has(attachableNode.node.id))
      ) {
        setTempLink({
          sourceId: attachableNode.node.id,
          targetId: draggingNode.id,
          direction: attachableNode.direction
        })
        // temp link id is node's id
        setTimeout(() => {
          instance.edgeOps?.getEdgeFuncs(node.id)?.drawPath()
        })
      } else {
        if (tempLink) {
          setTempLink(undefined)
        }
      }
    }
  }
  const handleNodeDragEnd = ({ draggingNode, attachableNode }: WhiteboardEvents['nodeDragEnd']) => {
    const rightIds = subNodeIds.current.right
    const leftIds = subNodeIds.current.left
    const isAttachableChild =
      attachableNode && (node.id === attachableNode.node.id || rightIds.has(attachableNode.node.id) || leftIds.has(attachableNode.node.id))
    if (tempLink) {
      setTempLink(undefined)
    }
    if (isDraggingSelf) {
      setIsDraggingSelf(false)
    }
    // dragging node attach to self
    if (isAttachableChild) {
      dragEndHandler({
        currNode: node,
        rightIds,
        link: {
          sourceId: attachableNode.node.id,
          targetId: draggingNode.id,
          direction: attachableNode.direction
        },
        leftIds,
        instance,
        dragNode: draggingNode
      })
      return
    }
    // no attachable node, if contains this node, delete it
    if (rightIds.has(draggingNode.id) || leftIds.has(draggingNode.id)) {
      instance.updateWhiteboard?.(w => {
        const newMindmap = removeSubNode({
          node: node,
          targetNodeId: draggingNode.id,
          side: rightIds.has(draggingNode.id) ? 'right' : 'left'
        })
        w.nodes?.set(newMindmap.id, newMindmap)
        const dragged = w.nodes?.get(draggingNode.id)
        if (dragged) {
          const subChildren = getChildrenOfNode(draggingNode, instance, draggingNode.side)
          if (subChildren?.length) {
            // dragging node become new mindmap's root, assign attrs (edge color, type) from current mindmap
            w.nodes?.set(dragged.id, {
              ...dragged,
              ...draggingNode,
              rootId: undefined,
              side: undefined,
              type: 'mindmap',
              nodeType: dragged.type,
              edgeColor: node.edgeColor,
              edgeType: node.edgeType,
              borderType: draggingNode.borderType,
              border: draggingNode.border,
              rightChildren: dragged.side === 'right' ? subChildren : [],
              leftChildren: dragged.side === 'left' ? subChildren : []
            })
          } else {
            w.nodes?.set(dragged.id, {
              ...dragged,
              ...draggingNode,
              rootId: undefined,
              side: undefined
            })
          }
        }
      }, true)
    }
  }
  useEffect(() => {
    instance.addEventListener('nodeDragEnd', handleNodeDragEnd)
    instance.addEventListener('nodeDrag', handleNodeDrag)
    return () => {
      instance.removeEventListener('nodeDrag', handleNodeDrag)
      instance.removeEventListener('nodeDragEnd', handleNodeDragEnd)
    }
  })
  const renderTempLink = () => {
    if (edgeLayer && tempLink) {
      return createPortal(
        <Edge
          isMindmapConnection={true}
          edge={{
            id: node.id,
            sourceId: tempLink.sourceId,
            targetId: tempLink.targetId,
            sourcePosition: tempLink.direction === 'right' ? 'right' : 'left',
            targetPosition: tempLink.direction === 'right' ? 'left' : 'right',
            color: node.edgeColor || Colors.Font.Primary
          }}
          strokeWidth={4}
          hideArrow={true}
          lineType={'curve'}
        />,
        edgeLayer
      )
    }
  }
  return {
    isDraggingSelf,
    renderTempLink
  }
}

const dragEndHandler = (result: {
  dragNode: IWhiteboardNode
  currNode: IWhiteboardNode & { type: 'mindmap' }
  link: { sourceId: number; targetId: number; direction: 'left' | 'right' }
  rightIds: Set<number>
  instance: IWhiteboardInstance
  leftIds: Set<number>
}) => {
  const { dragNode, link, rightIds, leftIds, currNode, instance } = result
  let childrenNodes: IWhiteboardMindmap[] = []
  if (dragNode.type === 'mindmap') {
    childrenNodes = [...(getChildrenOfNode(dragNode, instance, 'left') || []), ...(getChildrenOfNode(dragNode, instance, 'right') || [])]
  } else {
    childrenNodes = getChildrenOfNode(dragNode, instance) || []
  }
  const currN = {
    ...currNode
  }
  const dragAttachTarget = instance.getNode?.(link.sourceId === dragNode.id ? link.targetId : link.sourceId)
  const targetCollapse =
    dragAttachTarget?.type === 'mindmap'
      ? dragAttachTarget[link.direction === 'right' ? 'rightCollapse' : 'leftCollapse']
      : dragAttachTarget?.collapseChildren
  // this is reorder, first remove from tree
  const deletedMindmaps: Record<number, IWhiteboardMindmap> = {}
  if (rightIds.has(dragNode.id) || leftIds.has(dragNode.id)) {
    if (rightIds.has(dragNode.id) && currN.rightChildren) {
      const res = deleteChildsFromTree(currN.rightChildren, dragNode.id)
      currN.rightChildren = res.result
      res.deletedNodes.forEach(n => {
        deletedMindmaps[n.root] = n
      })
    }
    if (leftIds.has(dragNode.id) && currN.leftChildren) {
      const res = deleteChildsFromTree(currN.leftChildren, dragNode.id)
      currN.leftChildren = res.result
      res.deletedNodes.forEach(n => {
        deletedMindmaps[n.root] = n
      })
    }
  }
  const newChildren = produce(currN[link.direction === 'right' ? 'rightChildren' : 'leftChildren'] || [], draft => {
    const idx = findDragIndex(dragNode, { root: currNode.id, children: draft }, link.sourceId, instance)
    if (idx !== undefined && idx >= 0) {
      addToTree({ root: currNode.id, children: draft }, link.sourceId, idx, {
        ...deletedMindmaps[dragNode.id],
        root: dragNode.id,
        children: childrenNodes
      })
    }
  })
  console.log(currN, newChildren)
  instance.updateWhiteboard?.(w => {
    // update curr mindmap
    w.nodes?.set(currNode.id, {
      ...currN,
      [link.direction === 'right' ? 'rightChildren' : 'leftChildren']: newChildren
    })
    const originDragNode = w.nodes?.get(dragNode.id)
    if (originDragNode && originDragNode.type === 'mindmap') {
      w.nodes?.set(originDragNode.id, {
        ...originDragNode,
        type: originDragNode.type === 'mindmap' ? originDragNode.nodeType || 'text' : originDragNode.type,
        rootId: currNode.id,
        content: originDragNode.content ?? [{ type: 'paragraph', children: [{ text: '' }], id: Id.getId() }],
        rightChildren: [],
        leftChildren: [],
        collapse: targetCollapse ? dragAttachTarget?.id : false,
        side: link.direction
      })
    }
    const finalChildrenNodesOfMindmap = [...flattenTree(currN[link.direction === 'right' ? 'rightChildren' : 'leftChildren'] || [])]
    finalChildrenNodesOfMindmap.forEach(n => {
      const origin = w.nodes?.get(n.root)
      if (origin) {
        w.nodes?.set(origin.id, {
          ...origin,
          rootId: currN.id,
          side: link.direction
        })
      }
    })
    if (originDragNode) {
      w.nodes?.set(originDragNode.id, {
        ...w.nodes.get(originDragNode.id)!,
        rootId: currN.id,
        collapse: targetCollapse ? dragAttachTarget?.id : false,
        side: link.direction,
        border: currN.border,
        borderType: currN.borderType
      })
    }
  }, true)
}
