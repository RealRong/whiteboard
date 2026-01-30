import { IWhiteboardInstance, IWhiteboardNode, XYPosition } from '~/typings'

// update by cache
export default (instance: IWhiteboardInstance, subIds: number[], linkIds: string[], dragOffset: XYPosition) => {
  instance.nodeOps?.updateRelatedEdges(subIds)
  subIds.forEach(id => {
    const node = instance.getNode?.(id)
    if (node) {
      const result = {
        x: node.x + dragOffset.x,
        y: node.y + dragOffset.y
      }
      const s = `translate(${result.x}px,${result.y}px)`
      instance.nodeOps?.getNodeFuncs(id)?.setStyle({
        transform: s
      })
    }
  })
  linkIds.forEach(id => {
    instance.edgeOps?.getEdgeFuncs(id)?.transformEdge(dragOffset.x, dragOffset.y)
  })
}
