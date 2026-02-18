import type { Edge, EdgeId, Point } from '@whiteboard/core'
import type { EdgePathEntry } from '@whiteboard/engine'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useEdgeIds = () => {
  const instance = useInstance()
  const [edgeIds, setEdgeIds] = useState<EdgeId[]>(() => instance.view.edge.ids())

  useEffect(() => {
    const update = () => {
      const next = instance.view.edge.ids()
      setEdgeIds((prev) => (isSameIdOrder(prev, next) ? prev : next))
    }
    update()
    return instance.view.edge.watchIds(update)
  }, [instance])

  return edgeIds
}

const useEdgePath = (edgeId: EdgeId) => {
  const instance = useInstance()
  const [path, setPath] = useState<EdgePathEntry | undefined>(() => instance.view.edge.path(edgeId))

  useEffect(() => {
    const update = () => {
      const next = instance.view.edge.path(edgeId)
      setPath((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.edge.watchPath(edgeId, update)
  }, [edgeId, instance])

  return path
}

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  onPathPointerDown: (edge: Edge, pathPoints: Point[], event: ReactPointerEvent<SVGPathElement>) => void
  onPathClick: (edge: Edge, pathPoints: Point[], event: ReactMouseEvent<SVGPathElement>) => void
}

const EdgeItemById = memo(
  ({
    edgeId,
    hitTestThresholdScreen,
    selected,
    onPathPointerDown,
    onPathClick
  }: EdgeItemByIdProps) => {
    const path = useEdgePath(edgeId)
    if (!path) return null

    return (
      <EdgeItem
        edge={path.edge}
        path={path.path}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={onPathPointerDown}
        onPathClick={onPathClick}
      />
    )
  },
  (prev, next) =>
    prev.edgeId === next.edgeId &&
    prev.hitTestThresholdScreen === next.hitTestThresholdScreen &&
    prev.selected === next.selected &&
    prev.onPathPointerDown === next.onPathPointerDown &&
    prev.onPathClick === next.onPathClick
)

export const EdgeLayer = () => {
  const instance = useInstance()
  const edgeIds = useEdgeIds()
  const stateSelectedEdgeId = useWhiteboardSelector('edgeSelection')
  const hitTestThresholdScreen = instance.runtime.config.edge.hitTestThresholdScreen
  const selectEdge = instance.commands.edge.select
  const insertRoutingPoint = instance.commands.edge.insertRoutingPoint
  const clientToWorld = instance.runtime.viewport.clientToWorld
  const nearestEdgeSegment = instance.query.geometry.nearestEdgeSegment

  const insertPointAtClient = useCallback(
    (edge: Edge, pathPoints: Point[], clientX: number, clientY: number) => {
      const pointWorld = clientToWorld(clientX, clientY)
      const segmentIndex = nearestEdgeSegment(pointWorld, pathPoints)
      insertRoutingPoint(edge, pathPoints, segmentIndex, pointWorld)
      selectEdge(edge.id)
    },
    [clientToWorld, insertRoutingPoint, nearestEdgeSegment, selectEdge]
  )

  const handlePathPointerDown = useCallback(
    (edge: Edge, pathPoints: Point[], event: ReactPointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
        return
      }
      selectEdge(edge.id)
    },
    [insertPointAtClient, selectEdge]
  )

  const handlePathClick = useCallback(
    (edge: Edge, pathPoints: Point[], event: ReactMouseEvent<SVGPathElement>) => {
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
    },
    [insertPointAtClient]
  )

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <EdgeMarkerDefs />
      {edgeIds.map((edgeId) => (
        <EdgeItemById
          key={edgeId}
          edgeId={edgeId}
          hitTestThresholdScreen={hitTestThresholdScreen}
          selected={edgeId === stateSelectedEdgeId}
          onPathPointerDown={handlePathPointerDown}
          onPathClick={handlePathClick}
        />
      ))}
    </svg>
  )
}
