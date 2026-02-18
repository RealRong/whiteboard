import type { EdgeId, EdgeInput, EdgePatch } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import { createEdgeConnect } from './edgeConnect'

export const createEdge = (
  instance: Instance
): Pick<Commands, 'edge' | 'edgeConnect'> => {
  const { core } = instance.runtime
  const { read, write, batch } = instance.state
  const edgeConnect = createEdgeConnect(instance)

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
    void core.dispatch({
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
    void core.dispatch({
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
      void core.dispatch({
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
    void core.dispatch({
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

    void core.dispatch({
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

  const startRoutingDrag: Commands['edge']['startRoutingDrag'] = ({
    edgeId,
    index,
    pointerId,
    clientX,
    clientY
  }) => {
    if (read('routingDrag').active) return false
    const edge = instance.graph.read().visibleEdges.find((item) => item.id === edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return false

    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const start = instance.runtime.viewport.clientToWorld(clientX, clientY)
    batch(() => {
      write('routingDrag', {
        active: {
          edgeId,
          index,
          pointerId,
          start,
          origin: points[index]
        }
      })
      selectEdge(edgeId)
    })
    return true
  }

  const updateRoutingDrag: Commands['edge']['updateRoutingDrag'] = ({
    pointerId,
    clientX,
    clientY
  }) => {
    const active = read('routingDrag').active
    if (!active || active.pointerId !== pointerId) return false

    const edge = instance.graph.read().visibleEdges.find((item) => item.id === active.edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') {
      clearRoutingDrag()
      return false
    }

    const points = edge.routing?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      clearRoutingDrag()
      return false
    }

    const current = instance.runtime.viewport.clientToWorld(clientX, clientY)
    const nextPoint = {
      x: active.origin.x + (current.x - active.start.x),
      y: active.origin.y + (current.y - active.start.y)
    }
    moveRoutingPoint(edge, active.index, nextPoint)
    return true
  }

  const endRoutingDrag: Commands['edge']['endRoutingDrag'] = ({ pointerId }) => {
    const active = read('routingDrag').active
    if (!active || active.pointerId !== pointerId) return false
    clearRoutingDrag()
    return true
  }

  const cancelRoutingDrag: Commands['edge']['cancelRoutingDrag'] = (options) => {
    const active = read('routingDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false
    clearRoutingDrag()
    return true
  }

  return {
    edge: {
      insertRoutingPoint,
      moveRoutingPoint,
      removeRoutingPoint,
      startRoutingDrag,
      updateRoutingDrag,
      endRoutingDrag,
      cancelRoutingDrag,
      resetRouting,
      create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => {
        const activeDrag = read('routingDrag').active
        if (activeDrag && ids.includes(activeDrag.edgeId)) {
          clearRoutingDrag()
        }
        return core.dispatch({ type: 'edge.delete', ids })
      },
      connect: core.commands.edge.connect as Commands['edge']['connect'],
      reconnect: core.commands.edge.reconnect as Commands['edge']['reconnect'],
      select: selectEdge
    },
    edgeConnect
  }
}
