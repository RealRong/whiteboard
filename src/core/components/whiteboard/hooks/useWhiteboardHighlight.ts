// highlight related nodes
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { assignProperties } from '@/utils'
import { useSetAtom } from 'jotai'
import { IWhiteboardNode } from '~/typings'
import { useWhiteboardEdges, useWhiteboardNodes } from '@/core/components/whiteboard/StateHooks'
import { useEffect } from 'react'
import { useSelectAtomValue } from '@/hooks'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'

export default () => {
  const instance = useWhiteboardInstance()
  const setWhiteboardState = useSetAtom(WhiteboardStateAtom)
  const highlight = useSelectAtomValue(WhiteboardStateAtom, s => s.highlightedIds)
  const edges = useWhiteboardEdges()
  const nodes = useWhiteboardNodes()

  assignProperties(instance, {
    nodeOps: {
      ...instance.nodeOps,
      highlightRelatedEdgesAndNodes: nodeId => {
        instance.buildNodeToEdgeIndex?.()
        const nodeToEdgeMap = instance.values.NODE_TO_EDGE_MAP
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        const nodeIdSet = new Set<number>()
        const edgeIdSet = new Set<number>()
        idArr.forEach(id => {
          nodeIdSet.add(id)
          const relatedEdges = nodeToEdgeMap.get(id)
          relatedEdges?.forEach(edgeId => {
            const edge = instance.getEdge?.(edgeId)
            if (edge) {
              edgeIdSet.add(edge.id)
              nodeIdSet.add(edge.targetId)
              nodeIdSet.add(edge.sourceId)
            }
          })
        })
        setWhiteboardState(s => ({ ...s, highlightedIds: { nodeIds: nodeIdSet, edgeIds: edgeIdSet, currentFocusCenterNodeId: idArr } }))
        const nodes = Array.from(nodeIdSet.values())
          .map(i => instance.getNode?.(i))
          .filter(i => i) as IWhiteboardNode[]
        const box = getBoxOfNodes(nodes)
        if (box) {
          instance.containerOps?.fitTo(box)
        }
        return nodes
      }
    }
  })
  useEffect(() => {
    if (highlight) {
      setTimeout(() => {
        instance.nodeOps?.highlightRelatedEdgesAndNodes(highlight.currentFocusCenterNodeId)
      })
    }
  }, [nodes.size, edges])
}
