import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import { NodeSceneLayer } from '../node/components/NodeSceneLayer'
import { EdgeSceneLayer } from '../edge/components/EdgeSceneLayer'
import { MindmapSceneLayer } from '../mindmap/components/MindmapSceneLayer'

export const SceneFeature = ({
  registerMeasuredElement,
  onNodePointerDown,
  onNodeDoubleClick,
  onMindmapNodePointerDown
}: {
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  onNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
  onMindmapNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}) => (
  <>
    <NodeSceneLayer
      registerMeasuredElement={registerMeasuredElement}
      onNodePointerDown={onNodePointerDown}
      onNodeDoubleClick={onNodeDoubleClick}
    />
    <EdgeSceneLayer />
    <MindmapSceneLayer onNodePointerDown={onMindmapNodePointerDown} />
  </>
)
