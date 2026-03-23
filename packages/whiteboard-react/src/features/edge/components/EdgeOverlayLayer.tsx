import { useInteraction, useTool } from '../../../runtime/hooks'
import { useSelectedEdgeView } from '../hooks/useEdgeView'
import { EdgeHintLayer } from './EdgeHintLayer'
import { EdgeSelectedControls } from './EdgeSelectedControls'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type {
  SelectedEdgeView
} from '../hooks/useEdgeView'

export const EdgeOverlayLayer = ({
  onPathPointKeyDown
}: {
  onPathPointKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    point: Extract<SelectedEdgeView['pathPoints'][number], { kind: 'anchor' }>
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
          onPathPointKeyDown={onPathPointKeyDown}
        />
      ) : null}
      <EdgeHintLayer />
    </>
  )
}
