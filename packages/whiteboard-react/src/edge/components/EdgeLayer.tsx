import { useEdgeConnectLayerState, useEdgeGeometry, useEdgeHitTest, useVisibleEdges } from '../hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'

type EdgeLayerProps = {
  hitTestThresholdScreen?: number
}

export const EdgeLayer = ({ hitTestThresholdScreen = 10 }: EdgeLayerProps) => {
  const visibleEdges = useVisibleEdges()
  const { state, selectedEdgeId: stateSelectedEdgeId } = useEdgeConnectLayerState()

  const paths = useEdgeGeometry({ edges: visibleEdges, connectState: state })
  const { handlePathPointerDown, handlePathClick } = useEdgeHitTest()

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <EdgeMarkerDefs />
      {paths.map((line) => {
        return (
          <EdgeItem
            key={line.id}
            edge={line.edge}
            path={line.path}
            hitTestThresholdScreen={hitTestThresholdScreen}
            selected={line.id === stateSelectedEdgeId}
            onPointerDown={handlePathPointerDown(line.edge, line.path.points)}
            onClick={handlePathClick(line.edge, line.path.points)}
          />
        )
      })}
    </svg>
  )
}
