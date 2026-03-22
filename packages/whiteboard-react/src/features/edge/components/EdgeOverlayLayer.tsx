import { useInteraction, useTool } from '../../../runtime/hooks'
import { useSelectedEdgeView } from '../hooks/useEdgeView'
import { EdgeHintLayer } from './EdgeHintLayer'
import { EdgeSelectedControls } from './EdgeSelectedControls'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { SelectedEdgePathPointView } from '../hooks/useEdgeView'

export const EdgeOverlayLayer = ({
  onEndpointPointerDown,
  onPathPointPointerDown,
  onPathPointKeyDown
}: {
  onEndpointPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPathPointPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    point: SelectedEdgePathPointView
  ) => void
  onPathPointKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    point: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
  ) => void
}) => {
  const interaction = useInteraction()
  const tool = useTool()
  const selectedEdgeView = useSelectedEdgeView()
  const showEdgeControls =
    selectedEdgeView !== undefined
    && interaction === 'idle'
    && tool.type !== 'hand'

  return (
    <>
      {showEdgeControls && selectedEdgeView ? (
        <EdgeSelectedControls
          view={selectedEdgeView}
          onEndpointPointerDown={onEndpointPointerDown}
          onPathPointPointerDown={onPathPointPointerDown}
          onPathPointKeyDown={onPathPointKeyDown}
        />
      ) : null}
      <EdgeHintLayer />
    </>
  )
}
