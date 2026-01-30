import { IWhiteboardNode } from '~/typings'

export default (node: IWhiteboardNode, defaultAutoWidth = true) => {
  let height: number | string | undefined = 'auto',
    width: number | string | undefined = node.width,
    minWidth: number | string | undefined = 280,
    maxWidth: number | string | undefined = undefined

  if (!width && defaultAutoWidth) {
    width = 'auto'
  }
  if (node.resized || ['group', 'freehand'].includes(node.type)) {
    height = node.height || 'auto'
  }
  if (!node.widthResized) {
    if (node.type === 'mindmap') {
      if (node.nodeType === 'text' || !node.nodeType) {
        width = 'auto'
      }
    }
    if (node.type === 'text' && node.rootId) {
      width = 'auto'
    }
  }
  if (node.type === 'freehand') {
    minWidth = undefined
  }
  if (node.type === 'text') {
    minWidth = 100
  }
  if (node.type === 'mindmap' && node.nodeType === 'text') {
    minWidth = 160
  }
  if (node.rootId && node.type === 'text') {
    maxWidth = 600
  }
  return {
    width,
    height,
    minWidth,
    maxWidth
  }
}
