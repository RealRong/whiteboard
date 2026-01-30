import { IWhiteboardNode } from '~/typings'
import { cloneMindmap } from '@/core/components/whiteboard/node/mindmap/utils/cloneMindmap'
import Id from '@/utils/id'

export default (nodes: IWhiteboardNode[]) => {
  const nodeIdToNodeMap = new Map(nodes.map(i => [i.id, i]))
  const mindmapNodes = nodes.filter(i => i.type === 'mindmap')
  const finalMap = new Map<number, IWhiteboardNode>(nodes.map(i => [i.id, i]))
  const processedIds = new Set<number>()
  mindmapNodes.forEach(i => {
    const cloned = cloneMindmap(i, {
      getNode: nodeId => nodeIdToNodeMap.get(nodeId),
      values: {
        mindmapChildrenToFlattenChildren: new WeakMap(),
        mindmapLeftTreeWeakMap: new WeakMap(),
        mindmapRightTreeWeakMap: new WeakMap()
      }
    })
    if (cloned) {
      const newId = Id.getId()
      cloned.deletedNodeIds.forEach(id => {
        finalMap.delete(id)
      })
      cloned.insertNewNodes.forEach(n => {
        finalMap.set(n.id, { ...n, rootId: newId })
        processedIds.add(n.id)
      })
      finalMap.delete(i.id)

      processedIds.add(newId)
      finalMap.set(newId, {
        ...cloned.newMindmap,
        id: newId
      })
    }
  })
  finalMap.forEach((v, k) => {
    if (!processedIds.has(k)) {
      finalMap.set(k, { ...v, id: Id.getId() })
    }
  })
  return Array.from(finalMap.values())
}
