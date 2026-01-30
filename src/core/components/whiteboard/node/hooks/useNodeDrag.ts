import { Box, IWhiteboardInstance, IWhiteboardNode, Point } from '~/typings'
import useGroupDrag from '@/core/components/whiteboard/node/hooks/useGroupDrag'
import { boxContain, pointInBox } from '@/utils'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'
import getClosestLink from '@/core/components/whiteboard/node/mindmap/drag/getClosestNodeLink'
import dragSingleNodeToEnlargeGroup from '@/core/components/whiteboard/node/hooks/drag/dragSingleNodeToEnlargeGroup'
import getAttachableNodes from '@/core/components/whiteboard/node/mindmap/utils/getAttachableNodes'

export default (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  const { handleGroupMove, handleGroupMoveEnd, handleGroupMoveStart } = useGroupDrag(node, instance)
  const handleDragStart = () => {
    instance.emit?.({
      type: 'nodeDragStart',
      draggingNode: node
    })
    if (node.type === 'group') {
      handleGroupMoveStart()
    } else {
      getAttachableNodes(instance, node.id)
    }
  }

  const handleDrag = (
    e: PointerEvent,
    data: {
      node: HTMLElement
      x: number
      y: number
      deltaX: number
      deltaY: number
    }
  ) => {
    instance.nodeOps?.updateRelatedEdges(node.id)
    const transformedWhiteboardPoint = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (!transformedWhiteboardPoint) return
    let myBox = instance.values.ID_TO_NODE_MAP.get(node.id)?.getRealtimeBox()
    if (node.type === 'mindmap') {
      const allNodes = [node, ...(instance.mindmapOps?.expandMindmap(node) || [])]
      const allBoxes = allNodes.map(i => instance.nodeOps?.getNodeFuncs(i.id)?.getRealtimeBox()).filter(i => i) as Box[]
      myBox = getBoxOfBoxes(allBoxes)
    }
    if (!myBox) return
    if (node.type === 'group') {
      handleGroupMove(data, data.node)
      return
    } else {
      const allGroupNodes = instance.getAllNode?.().filter(i => i.type === 'group')
      allGroupNodes?.forEach(n => {
        const box = instance.nodeOps?.getNodeFuncs(n.id)?.getRealtimeBox()
        if (box) {
          if (!boxContain(box, myBox)) {
            if (pointInBox(transformedWhiteboardPoint, box)) {
              instance.selectOps?.selectNode(n.id)
              return
            }
          }
        }
        instance.selectOps?.deselectNode(n.id)
      })
      const attachableMindmapChild = getClosestLink({ ...node, x: data.x, y: data.y }, instance, e)
      instance.emit?.({
        type: 'nodeDrag',
        attachableNode: attachableMindmapChild,
        ignoreSnap: node.type === 'mindmap',
        draggingNode: {
          ...node,
          x: data.x,
          y: data.y
        },
        delta: {
          x: data.deltaX,
          y: data.deltaY
        },
        nodeElement: data.node
      })
    }
  }

  const handleDragEnd = (
    e: PointerEvent,
    data: {
      node: HTMLElement
      x: number
      y: number
      deltaX: number
      deltaY: number
    }
  ): Box | undefined => {
    const transformedWhiteboardPoint = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (!transformedWhiteboardPoint) return
    if (node.type === 'group') {
      handleGroupMoveEnd(data)
    } else {
      let myBox = instance.values.ID_TO_NODE_MAP.get(node.id)?.getRealtimeBox()
      const box = myBox
      if (node.type === 'mindmap') {
        const allNodes = [node, ...(instance.mindmapOps?.expandMindmap(node) || [])]
        const allBoxes = allNodes.map(i => instance.nodeOps?.getNodeFuncs(i.id)?.getRealtimeBox()).filter(i => i) as Box[]
        myBox = getBoxOfBoxes(allBoxes)
      }
      if (!myBox || !box) return
      const allGroupNodes = instance.getAllNode?.().filter(i => i.type === 'group')
      const availableGroups = allGroupNodes?.filter(n => {
        instance.selectOps?.deselectNode(n.id)
        const box = instance.nodeOps?.getNodeFuncs(n.id)?.getRealtimeBox()
        if (box) {
          if (!boxContain(box, myBox)) {
            if (pointInBox(transformedWhiteboardPoint, box)) {
              return true
            }
          }
        }
        return false
      })
      const attachable = getClosestLink({ ...node, x: data.x, y: data.y }, instance, e)
      if (availableGroups?.length) {
        dragSingleNodeToEnlargeGroup(node, instance, availableGroups)
      }
      instance.emit?.({
        type: 'nodeDragEnd',
        draggingNode: node,
        attachableNode: attachable
      })
      return box
    }
  }

  return {
    handleDrag,
    handleDragStart,
    handleDragEnd
  }
}
