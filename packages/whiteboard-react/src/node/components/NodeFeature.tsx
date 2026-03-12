import { useNodeIds } from '../../common/hooks'
import { useTransientReset } from '../../common/hooks'
import type { Transient } from '../../transient'
import { useTransientGuides } from '../../transient'
import { useNodeInteractions } from '../hooks/useNodeInteractions'
import { useNodeSizeObserver } from '../hooks/useNodeSizeObserver'
import { NodeItem } from './NodeItem'

const NodeInteractionGuidesLayer = () => {
  const guides = useTransientGuides()

  if (!guides.length) return null

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-drag-guides-layer"
    >
      {guides.map((guide, index) => (
        <line
          key={`${guide.axis}-${index}`}
          x1={guide.axis === 'x' ? guide.value : guide.from}
          y1={guide.axis === 'x' ? guide.from : guide.value}
          x2={guide.axis === 'x' ? guide.value : guide.to}
          y2={guide.axis === 'x' ? guide.to : guide.value}
          stroke="rgba(59,130,246,0.9)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  )
}

export const NodeFeature = ({
  transient
}: {
  transient: Pick<Transient, 'node' | 'guides'>
}) => {
  const nodeIds = useNodeIds()
  const registerMeasuredElement = useNodeSizeObserver()
  const {
    cancelNodeInteractionSession,
    handleNodePointerDown,
    handleTransformPointerDown
  } = useNodeInteractions(transient.node, transient.guides)

  useTransientReset(cancelNodeInteractionSession)

  return (
    <>
      <div className="wb-node-layer">
        {nodeIds.map((nodeId) => (
          <NodeItem
            key={nodeId}
            nodeId={nodeId}
            registerMeasuredElement={registerMeasuredElement}
            node={transient.node}
            onNodePointerDown={handleNodePointerDown}
            onTransformPointerDown={handleTransformPointerDown}
          />
        ))}
      </div>
      <NodeInteractionGuidesLayer />
    </>
  )
}
