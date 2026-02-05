import type { Edge, Node, Point } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { EdgeConnectState } from '../../common/state/whiteboardAtoms'
import { useEdgeGeometry, useEdgeHitTest, useEdgeHover } from '../hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'
import type { Size } from '../../common/types'

type EdgeLayerProps = {
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom?: number
  containerRef?: RefObject<HTMLElement>
  screenToWorld?: (point: Point) => Point
  hitTestThresholdScreen?: number
  selectedEdgeId?: string
  onSelectEdge?: (id?: string) => void
  onInsertPoint?: (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => void
  connectState?: EdgeConnectState
}

export const EdgeLayer = ({
  nodes,
  edges,
  nodeSize,
  zoom = 1,
  containerRef,
  screenToWorld,
  hitTestThresholdScreen = 10,
  selectedEdgeId,
  onSelectEdge,
  onInsertPoint,
  connectState
}: EdgeLayerProps) => {
  const { hoveredEdgeId, handleHoverChange } = useEdgeHover()
  const paths = useEdgeGeometry({ nodes, edges, nodeSize, connectState })
  const { handlePathPointerDown, handlePathClick } = useEdgeHitTest({
    containerRef,
    screenToWorld,
    onInsertPoint,
    onSelectEdge
  })

  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
    >
      <EdgeMarkerDefs />
      {paths.map((line) => {
        return (
          <EdgeItem
            key={line.id}
            edge={line.edge}
            path={line.path}
            hitTestThresholdScreen={hitTestThresholdScreen}
            selected={line.id === selectedEdgeId}
            hovered={line.id === hoveredEdgeId}
            onPointerDown={handlePathPointerDown(line.edge, line.path.points)}
            onClick={handlePathClick(line.edge, line.path.points)}
            onHoverChange={(hovered) => {
              handleHoverChange(line.id, hovered)
            }}
          />
        )
      })}
    </svg>
  )
}
