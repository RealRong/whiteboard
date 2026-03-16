import type { EdgeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback } from 'react'
import {
  useInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import { hasContainerEdge } from '../../../runtime/state'
import { useEdgeView } from '../hooks/useEdgeView'
import { EdgeItem } from './EdgeItem'
import { EDGE_ARROW_END_ID, EDGE_ARROW_START_ID } from '../constants'

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  handleEdgePathPointerDown: (event: ReactPointerEvent<SVGPathElement>) => void
}

const EdgeItemById = memo(
  ({
    edgeId,
    hitTestThresholdScreen,
    selected,
    handleEdgePathPointerDown
  }: EdgeItemByIdProps) => {
    const entry = useEdgeView(edgeId)
    if (!entry) return null

    return (
      <EdgeItem
        entry={entry}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={handleEdgePathPointerDown}
      />
    )
  }
)

export const EdgeLayer = () => {
  const instance = useInstance()
  const edgeIds = useStoreValue(instance.read.edge.list)
  const selectedEdgeId = useSelection().target.edgeId
  const hitTestThresholdScreen = instance.config.edge.hitTestThresholdScreen
  const handleEdgePathPointerDown = useCallback((event: ReactPointerEvent<SVGPathElement>) => {
    if (event.button !== 0) {
      return
    }

    const edgeId = event.currentTarget
      .closest('[data-edge-id]')
      ?.getAttribute('data-edge-id') as EdgeId | null
    if (!edgeId) {
      return
    }

    const entry = instance.read.edge.item.get(edgeId)
    if (!entry) {
      return
    }

    if (!hasContainerEdge(instance.state.container.get(), entry.edge)) {
      instance.commands.selection.clear()
      instance.commands.container.exit()
    }

    if (event.shiftKey || event.detail >= 2) {
      const point = instance.viewport.pointer(event).world
      instance.commands.edge.routing.insertAtPoint(edgeId, point)
    }

    instance.commands.selection.selectEdge(edgeId)
    event.preventDefault()
    event.stopPropagation()
  }, [instance])

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-edge-layer"
    >
      <defs>
        <marker
          id={EDGE_ARROW_END_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
        <marker
          id={EDGE_ARROW_START_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
      </defs>
      {edgeIds.map((edgeId) => (
        <EdgeItemById
          key={edgeId}
          edgeId={edgeId}
          hitTestThresholdScreen={hitTestThresholdScreen}
          selected={edgeId === selectedEdgeId}
          handleEdgePathPointerDown={handleEdgePathPointerDown}
        />
      ))}
    </svg>
  )
}
