import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'

export default (element: HTMLElement, node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  const contextMenuHandler = (e: MouseEvent) => {
    setTimeout(() => {
      if (e.defaultPrevented) return
      const pos = instance.coordOps?.transformWindowPositionToPosition({
        x: e.clientX,
        y: e.clientY
      })
      if (pos) {
        instance.selectOps?.deselectAll(node.id)
        instance.selectOps?.selectNode(node.id)
        instance.toolbarOps?.openNodeToolbar(node.id, pos, 'contextMenu')
      }
    })
  }

  const handleContextMenuFunc = () => {
    element.addEventListener('contextmenu', contextMenuHandler)
  }
  const returnContextMenuFunc = () => {
    element.removeEventListener('contextmenu', contextMenuHandler)
  }
  return {
    handleContextMenuFunc,
    returnContextMenuFunc
  }
}
