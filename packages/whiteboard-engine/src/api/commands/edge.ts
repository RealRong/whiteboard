import type { EdgeId, EdgeInput, EdgePatch, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { createEdgeConnectCommands } from './edgeConnect'

export const createEdgeCommands = (
  instance: Instance
): Pick<Commands, 'edge' | 'edgeConnect'> => {
  const { core } = instance.runtime
  const { read, write } = instance.state
  const { edgeConnect } = createEdgeConnectCommands(instance)

  const getWorldPointFromClient = (clientX: number, clientY: number): Point => {
    const screen = instance.runtime.viewport.clientToScreen(clientX, clientY)
    return instance.runtime.viewport.screenToWorld(screen)
  }

  const clearEdgeRoutingPointDrag = () => {
    write('edgeRoutingPointDrag', {})
  }

  const selectEdge: Commands['edge']['select'] = (id) => {
    const activeDrag = read('edgeRoutingPointDrag').active
    if (activeDrag && activeDrag.edgeId !== id) {
      clearEdgeRoutingPointDrag()
    }
    write('edgeSelection', (prev) => (prev === id ? prev : id))
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

  const insertRoutingPointAtClient: Commands['edge']['insertRoutingPointAtClient'] = (
    edge,
    pathPoints,
    clientX,
    clientY
  ) => {
    const pointWorld = getWorldPointFromClient(clientX, clientY)
    const segmentIndex = instance.query.getNearestEdgeSegmentIndexAtWorld(pointWorld, pathPoints)
    insertRoutingPoint(edge, pathPoints, segmentIndex, pointWorld)
    selectEdge(edge.id)
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

    const activeDrag = read('edgeRoutingPointDrag').active
    if (activeDrag?.edgeId === edge.id && activeDrag.index === index) {
      clearEdgeRoutingPointDrag()
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
    const activeDrag = read('edgeRoutingPointDrag').active
    if (activeDrag?.edgeId === edge.id) {
      clearEdgeRoutingPointDrag()
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

  const startRoutingPointDrag: Commands['edge']['startRoutingPointDrag'] = ({
    edgeId,
    index,
    pointerId,
    clientX,
    clientY
  }) => {
    if (read('edgeRoutingPointDrag').active) return false
    const edge = read('visibleEdges').find((item) => item.id === edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return false

    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const start = getWorldPointFromClient(clientX, clientY)
    write('edgeRoutingPointDrag', {
      active: {
        edgeId,
        index,
        pointerId,
        start,
        origin: points[index]
      }
    })
    selectEdge(edgeId)
    return true
  }

  const updateRoutingPointDrag: Commands['edge']['updateRoutingPointDrag'] = ({
    pointerId,
    clientX,
    clientY
  }) => {
    const active = read('edgeRoutingPointDrag').active
    if (!active || active.pointerId !== pointerId) return false

    const edge = read('visibleEdges').find((item) => item.id === active.edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') {
      clearEdgeRoutingPointDrag()
      return false
    }

    const points = edge.routing?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      clearEdgeRoutingPointDrag()
      return false
    }

    const current = getWorldPointFromClient(clientX, clientY)
    const nextPoint = {
      x: active.origin.x + (current.x - active.start.x),
      y: active.origin.y + (current.y - active.start.y)
    }
    moveRoutingPoint(edge, active.index, nextPoint)
    return true
  }

  const endRoutingPointDrag: Commands['edge']['endRoutingPointDrag'] = ({ pointerId }) => {
    const active = read('edgeRoutingPointDrag').active
    if (!active || active.pointerId !== pointerId) return false
    clearEdgeRoutingPointDrag()
    return true
  }

  const cancelRoutingPointDrag: Commands['edge']['cancelRoutingPointDrag'] = (options) => {
    const active = read('edgeRoutingPointDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false
    clearEdgeRoutingPointDrag()
    return true
  }

  return {
    edge: {
      insertRoutingPoint,
      insertRoutingPointAtClient,
      moveRoutingPoint,
      removeRoutingPoint,
      startRoutingPointDrag,
      updateRoutingPointDrag,
      endRoutingPointDrag,
      cancelRoutingPointDrag,
      resetRouting,
      create: (payload: EdgeInput) => core.dispatch({ type: 'edge.create', payload }),
      update: (id: EdgeId, patch: EdgePatch) => core.dispatch({ type: 'edge.update', id, patch }),
      delete: (ids: EdgeId[]) => {
        const activeDrag = read('edgeRoutingPointDrag').active
        if (activeDrag && ids.includes(activeDrag.edgeId)) {
          clearEdgeRoutingPointDrag()
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
