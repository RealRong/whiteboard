import type { PointerEvent as ReactPointerEvent } from 'react'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import { NodeOverlayLayer } from '../../../features/node/components/NodeOverlayLayer'
import { EdgeOverlayLayer } from '../../../features/edge/components/EdgeOverlayLayer'

export const ViewportOverlays = ({
  onTransformPointerDown
}: {
  onTransformPointerDown: (
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}) => (
  <>
    <NodeOverlayLayer
      onTransformPointerDown={onTransformPointerDown}
    />
    <EdgeOverlayLayer />
  </>
)
