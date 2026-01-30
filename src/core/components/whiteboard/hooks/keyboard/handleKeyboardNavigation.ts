import isHotkey from 'is-hotkey'
import { KEY } from '@/consts'
import { IWhiteboardInstance, IWhiteboardNode, XYBox, XYPosition } from '~/typings'
import handleMindmapNavigate from '@/core/components/whiteboard/hooks/keyboard/handleMindmapNavigate'

const getNextNodeByBox = (
  currentBox: XYBox,
  direction: 'top' | 'right' | 'bottom' | 'left',
  inViewNodes: IWhiteboardNode[],
  allNodes: IWhiteboardNode[],
  currentSelectId?: number
) => {
  const nodesBoxWithId = allNodes.filter(i => i.width && i.height).map(i => i) as (XYBox & { id: number })[]
  const inViewBoxWithId = inViewNodes.filter(i => i.width && i.height).map(i => i) as (XYBox & { id: number })[]
  if (direction === 'top') {
    inViewBoxWithId.sort((b, a) => b.y - a.y)
    nodesBoxWithId.sort((b, a) => b.y - a.y)
    const firstAboveNode =
      inViewBoxWithId.findLast(i => i.y < currentBox.y && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.findLast(i => i.y < currentBox.y && i.id !== currentSelectId && i.type !== 'group')
    return firstAboveNode
  }
  if (direction === 'bottom') {
    inViewBoxWithId.sort((b, a) => b.y - a.y)
    nodesBoxWithId.sort((b, a) => b.y - a.y)
    const firstBottomNode =
      inViewBoxWithId.find(i => i.y + i.height > currentBox.y + currentBox.height && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.find(i => i.y + i.height > currentBox.y + currentBox.height && i.id !== currentSelectId && i.type !== 'group')
    return firstBottomNode
  }
  if (direction === 'left') {
    inViewBoxWithId.sort((b, a) => b.x - a.x)
    nodesBoxWithId.sort((b, a) => b.x - a.x)
    const firstLeftNode =
      inViewBoxWithId.findLast(i => i.x < currentBox.x && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.findLast(i => i.x < currentBox.x && i.id !== currentSelectId && i.type !== 'group')
    return firstLeftNode
  }
  if (direction === 'right') {
    inViewBoxWithId.sort((b, a) => b.x - a.x)
    nodesBoxWithId.sort((b, a) => b.x - a.x)
    console.log(nodesBoxWithId)
    const firstRightNode =
      inViewBoxWithId.find(i => i.x + i.width > currentBox.x + currentBox.width && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.find(i => i.x + i.width > currentBox.x + currentBox.width && i.id !== currentSelectId && i.type !== 'group')
    return firstRightNode
  }
}

const getNextNodeByPoint = (
  currentPoint: XYPosition,
  direction: 'top' | 'right' | 'bottom' | 'left',
  inViewNodes: IWhiteboardNode[],
  allNodes: IWhiteboardNode[],
  currentSelectId?: number
) => {
  const nodesBoxWithId = allNodes.filter(i => i.width && i.height).map(i => i) as (XYBox & { id: number })[]
  const inViewBoxWithId = inViewNodes.filter(i => i.width && i.height).map(i => i) as (XYBox & { id: number })[]
  if (direction === 'top') {
    inViewBoxWithId.sort((b, a) => b.y - a.y)
    nodesBoxWithId.sort((b, a) => b.y - a.y)
    const firstAboveNode =
      inViewBoxWithId.findLast(i => i.y < currentPoint.y && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.findLast(i => i.y < currentPoint.y && i.id !== currentSelectId && i.type !== 'group')
    return firstAboveNode
  }
  if (direction === 'bottom') {
    inViewBoxWithId.sort((b, a) => b.y - a.y)
    nodesBoxWithId.sort((b, a) => b.y - a.y)
    const firstBottomNode =
      inViewBoxWithId.find(i => i.y + i.height > currentPoint.y && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.find(i => i.y + i.height > currentPoint.y && i.id !== currentSelectId && i.type !== 'group')
    return firstBottomNode
  }
  if (direction === 'left') {
    inViewBoxWithId.sort((b, a) => b.x - a.x)
    nodesBoxWithId.sort((b, a) => b.x - a.x)
    const firstLeftNode =
      inViewBoxWithId.findLast(i => i.x < currentPoint.x && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.findLast(i => i.x < currentPoint.x && i.id !== currentSelectId && i.type !== 'group')
    return firstLeftNode
  }
  if (direction === 'right') {
    inViewBoxWithId.sort((b, a) => b.x - a.x)
    nodesBoxWithId.sort((b, a) => b.x - a.x)
    const firstRightNode =
      inViewBoxWithId.find(i => i.x + i.width > currentPoint.x && i.id !== currentSelectId && i.type !== 'group') ||
      nodesBoxWithId.find(i => i.x + i.width > currentPoint.x && i.id !== currentSelectId && i.type !== 'group')
    return firstRightNode
  }
}

const isInView = (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  const windowRect = instance.coordOps?.transformWhiteboardRectToWindowRect({
    left: node.x,
    top: node.y,
    width: node.width ?? 0,
    height: node.height ?? 0
  })
  if (!windowRect) return false
  const right = windowRect.left + windowRect.width
  const bottom = windowRect.top + windowRect.height
  const { left, top } = windowRect
  const containerBounding = instance.getOutestContainerNode?.()?.getBoundingClientRect()
  if (!containerBounding) return false
  if (
    left < containerBounding.left ||
    top < containerBounding.top ||
    right > containerBounding.right ||
    bottom > containerBounding.bottom
  ) {
    return false
  }
  return true
}
const fitTo = (instance: IWhiteboardInstance, direction: 'top' | 'right' | 'bottom' | 'left') => {
  const currentSelectNodes = instance.selectOps?.getSelectedNodes()
  const inViewNodes = instance.containerOps?.getInViewNodes()
  const inViewBox = instance.containerOps?.getViewBox()
  const allNodes = instance.getAllNode?.()
  if (!inViewBox || !allNodes || !inViewNodes) return
  const deselectAllAndFitToNode = (node: IWhiteboardNode) => {
    instance.selectOps?.deselectAll()
    setTimeout(() => {
      instance.selectOps?.selectNode(node.id)
      if (!isInView(node, instance)) {
        instance.containerOps?.fitTo(
          { left: node.x, top: node.y, width: node.width, height: node.height },
          {
            changeScale: false
          }
        )
      }
    })
  }
  // if only one in view node and no selected, select it
  if (inViewNodes?.length === 1 && !currentSelectNodes?.length) {
    const firstNode = inViewNodes[0]
    deselectAllAndFitToNode(firstNode)
    return
  }

  // no current select mode or select multiple nodes
  if (!currentSelectNodes?.length || currentSelectNodes.length > 1) {
    const currentPoint = { x: inViewBox.left + inViewBox.width / 2, y: inViewBox.top + inViewBox.height / 2 }
    const next = getNextNodeByPoint(currentPoint, direction, inViewNodes, allNodes)
    next && deselectAllAndFitToNode(next)
  }
  // have one selected node
  else {
    const mindmapNavigate = handleMindmapNavigate(currentSelectNodes[0], instance, direction)
    if (mindmapNavigate) {
      deselectAllAndFitToNode(mindmapNavigate)
      return
    }
    const selected = currentSelectNodes[0]
    const next = getNextNodeByBox(selected, direction, inViewNodes, allNodes, selected.id)
    console.log(selected, next)
    next && deselectAllAndFitToNode(next)
  }
}

export default (e: KeyboardEvent, instance: IWhiteboardInstance) => {
  const toolbarOpen = instance.toolbarOps?.getToolbarState().visible
  if (toolbarOpen) return
  if (isHotkey(KEY.ArrowLeft, e)) {
    fitTo(instance, 'left')
  }
  if (isHotkey(KEY.ArrowRight, e)) {
    fitTo(instance, 'right')
  }
  if (isHotkey(KEY.ArrowDown, e)) {
    fitTo(instance, 'bottom')
  }
  if (isHotkey(KEY.ArrowUp, e)) {
    fitTo(instance, 'top')
  }
}
