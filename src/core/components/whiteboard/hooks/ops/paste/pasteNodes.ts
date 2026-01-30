import { IWhiteboardInstance, XYPosition } from '~/typings'
import cloneNodes from '@/core/components/whiteboard/hooks/ops/cloneNodes'

export default (instance: IWhiteboardInstance, position: XYPosition) => {
  const currentCopied = Global.values.copiedWhiteboardData
  if (currentCopied?.length) {
    const coord = instance.coordOps?.transformWindowPositionToPosition({
      x: position.x,
      y: position.y
    })
    if (!coord) return
    const cloned = cloneNodes(currentCopied)
    const pasteElements = cloned.map(i => ({
      ...i,
      x: i.x + coord.x,
      y: i.y + coord.y
    }))
    instance.updateWhiteboard?.(w => {
      pasteElements.forEach(n => {
        w.nodes?.set(n.id, n)
      })
    }, true)
  }
}
