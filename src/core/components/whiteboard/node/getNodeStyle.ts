import { CSSProperties } from 'react'
import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { NodeInnerState } from '@/core/components/whiteboard/node/WrapperNode'
import Colors from '@/consts/colors'

const transparentBackgroundNodes = ['text', 'freehand']
const getNodeStyle = (
  node: IWhiteboardNode,
  nodeState: NodeInnerState,
  instance: IWhiteboardInstance,
  opts: {
    panPointerMode?: boolean
    enableClickWhenPanning?: boolean
    background: {
      opacityBackground: string
    }
  }
): CSSProperties => {
  let mindmapTransparent = false
  if (node.type === 'mindmap') {
    if (!node.nodeType || transparentBackgroundNodes.includes(node.nodeType)) {
      mindmapTransparent = true
    }
  }
  const getNodeBoxShadow = () => {
    if (nodeState.selected || nodeState.focused) {
      return `0 0 0 calc(2px * var(--zoom-level)) var(--select-color)`
    }
    if ((node.rootId || node.type === 'mindmap') && node.borderType === 'underline') return undefined
    if (transparentBackgroundNodes.includes(node.type) || showBorder) {
      return undefined
    }
    if (mindmapTransparent) return undefined
    return ''
  }
  let pointerEvents: CSSProperties['pointerEvents'] = 'auto'
  if (node.type === 'freehand') {
    if (!(nodeState.selected || nodeState.focused) && !node.background) {
      pointerEvents = 'none'
    }
  }
  if (opts.panPointerMode && opts.enableClickWhenPanning !== true) {
    pointerEvents = 'none'
  }

  let cursor: CSSProperties['cursor'] = 'auto'

  if (node.type === 'group') {
    if (!nodeState.focused) {
      cursor = 'auto'
    } else {
      cursor = 'grab'
    }
  } else {
    if (nodeState.focused) {
      cursor = 'auto'
    } else {
      cursor = 'grab'
    }
  }
  if (opts.panPointerMode && opts.enableClickWhenPanning === true) {
    cursor = 'pointer'
  }
  let zIndex: number | undefined = node.z
  if (node.type === 'group') {
    zIndex = -10000
    const parentGroups = instance.groupOps?.getParentGroupsOfNode(node.id) ?? []
    zIndex += parentGroups?.length
  }
  let borderRadius = undefined
  switch (node.borderType) {
    case 'rect':
      borderRadius = 0
      break
    case 'round':
      borderRadius = 20
      break
    case 'roundRect':
      borderRadius = 8
      break
  }

  let showBorder = true
  if (node.type === 'group' || node.borderType === 'underline' || !node.border) {
    showBorder = false
  }
  let opacity = 1
  if (node.rootId && node.x === 0 && node.y === 0 && !node.height) {
    opacity = 0
  }
  let borderColor = ''
  if (showBorder && node.border) {
    borderColor = Colors.getAdaptColor(node.border)!
  }
  return {
    boxShadow: getNodeBoxShadow(),
    opacity,
    borderRadius: borderRadius,
    zIndex,
    border: showBorder ? `3px solid ${borderColor}` : undefined,
    userSelect: nodeState.focused || nodeState.focused ? 'auto' : 'none',
    background: !node.background
      ? transparentBackgroundNodes.includes(node.type) || mindmapTransparent
        ? 'transparent'
        : opts.background.opacityBackground
      : opts.background.opacityBackground,
    cursor,
    pointerEvents
  }
}

export default getNodeStyle
