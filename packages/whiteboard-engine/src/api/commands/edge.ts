import type { DispatchResult, EdgeAnchor, EdgeId, EdgeInput, EdgePatch, NodeId } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import type { ApplyCommandChange } from './shared'

export const createEdge = (
  instance: Instance,
  applyChange: ApplyCommandChange
): Pick<Commands, 'edge'> => {
  const { read, write, batch } = instance.state

  const applyEdgeChange = async (
    change:
      | { type: 'edge.create'; payload: EdgeInput }
      | { type: 'edge.update'; id: EdgeId; patch: EdgePatch }
      | { type: 'edge.delete'; ids: EdgeId[] }
      | {
          type: 'edge.connect'
          source: { nodeId: NodeId; anchor?: EdgeAnchor }
          target: { nodeId: NodeId; anchor?: EdgeAnchor }
        }
        | {
          type: 'edge.reconnect'
          id: EdgeId
          end: 'source' | 'target'
          ref: { nodeId: NodeId; anchor?: EdgeAnchor }
        }
  ): Promise<DispatchResult> => applyChange(change)

  const clearRoutingDrag = () => {
    write('routingDrag', {})
  }

  const selectEdge: Commands['edge']['select'] = (id) => {
    batch(() => {
      const activeDrag = read('routingDrag').active
      if (activeDrag && activeDrag.edgeId !== id) {
        clearRoutingDrag()
      }
      write('edgeSelection', (prev) => (prev === id ? prev : id))
    })
  }

  const insertRoutingPoint: Commands['edge']['insertRoutingPoint'] = (
    edge,
    pathPoints,
    segmentIndex,
    pointWorld
  ) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const basePoints = edge.routing?.points?.length ? edge.routing.points : pathPoints.slice(1, -1)
    const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
    const nextPoints = [...basePoints]
    nextPoints.splice(insertIndex, 0, pointWorld)
    void applyEdgeChange({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    })
  }

  const moveRoutingPoint: Commands['edge']['moveRoutingPoint'] = (edge, index, pointWorld) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return
    const nextPoints = points.map((point, idx) => (idx === index ? pointWorld : point))
    void applyEdgeChange({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    })
  }

  const removeRoutingPoint: Commands['edge']['removeRoutingPoint'] = (edge, index) => {
    if (edge.type === 'bezier' || edge.type === 'curve') return
    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return

    const activeDrag = read('routingDrag').active
    if (activeDrag?.edgeId === edge.id && activeDrag.index === index) {
      clearRoutingDrag()
    }

    const nextPoints = points.filter((_, idx) => idx !== index)
    if (nextPoints.length === 0) {
      void applyEdgeChange({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'auto',
            points: undefined
          }
        }
      })
      return
    }
    void applyEdgeChange({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'manual',
          points: nextPoints
        }
      }
    })
  }

  const resetRouting: Commands['edge']['resetRouting'] = (edge) => {
    const activeDrag = read('routingDrag').active
    if (activeDrag?.edgeId === edge.id) {
      clearRoutingDrag()
    }

    void applyEdgeChange({
      type: 'edge.update',
      id: edge.id,
      patch: {
        routing: {
          ...(edge.routing ?? {}),
          mode: 'auto',
          points: undefined
        }
      }
    })
  }

  return {
    edge: {
      insertRoutingPoint,
      moveRoutingPoint,
      removeRoutingPoint,
      resetRouting,
      create: (payload: EdgeInput) => applyEdgeChange({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => applyEdgeChange({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => {
        const activeDrag = read('routingDrag').active
        if (activeDrag && ids.includes(activeDrag.edgeId)) {
          clearRoutingDrag()
        }
        return applyEdgeChange({ type: 'edge.delete', ids })
      },
      connect: (source, target) => applyEdgeChange({ type: 'edge.connect', source, target }),
      reconnect: (id, end, ref) => applyEdgeChange({ type: 'edge.reconnect', id, end, ref }),
      select: selectEdge
    }
  }
}
