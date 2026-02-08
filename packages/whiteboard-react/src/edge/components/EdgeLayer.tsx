import type { Edge, Node, Point } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { EdgeConnectState } from 'types/state'
import { useEdgeGeometry, useEdgeHitTest } from '../hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'
import type { Size } from 'types/common'

type EdgeLayerProps = {
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  zoom?: number
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  hitTestThresholdScreen?: number
  selectedEdgeId?: string
  onSelectEdge?: (id?: string) => void
  onInsertPoint?: (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => void
  connectState?: EdgeConnectState
}

const EDGE_LAYER_STYLE = `
.wb-edge-item .wb-edge-visible-path {
  transition: stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease;
}
.wb-edge-item .wb-edge-hover-path {
  opacity: 0;
  transition: opacity 120ms ease;
}
.wb-edge-item .wb-edge-hit-path:hover + .wb-edge-visible-path + .wb-edge-hover-path,
.wb-edge-item .wb-edge-hit-path:focus-visible + .wb-edge-visible-path + .wb-edge-hover-path {
  opacity: 1;
}
.wb-edge-item[data-selected='true'] .wb-edge-hover-path {
  opacity: 0;
}
`

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
      data-zoom={zoom}
    >
      <style>{EDGE_LAYER_STYLE}</style>
      <EdgeMarkerDefs />
      {paths.map((line) => {
        return (
          <EdgeItem
            key={line.id}
            edge={line.edge}
            path={line.path}
            hitTestThresholdScreen={hitTestThresholdScreen}
            selected={line.id === selectedEdgeId}
            onPointerDown={handlePathPointerDown(line.edge, line.path.points)}
            onClick={handlePathClick(line.edge, line.path.points)}
          />
        )
      })}
    </svg>
  )
}
