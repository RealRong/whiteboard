import { useInteraction } from '../../../runtime/hooks'
import { useSelectedEdgeView } from '../hooks/useSelectedEdgeView'
import { useEdgeRouting } from '../hooks/routing/useEdgeRouting'
import { EdgePreview } from './EdgePreview'
import { EdgeSelectedControls } from './EdgeSelectedControls'

export const EdgeOverlayLayer = () => {
  const interaction = useInteraction()
  const selectedEdgeView = useSelectedEdgeView()
  const {
    handleRoutingPointerDown,
    handleRoutingKeyDown
  } = useEdgeRouting()
  const showEdgeControls =
    selectedEdgeView !== undefined
    && interaction.mode === 'idle'

  return (
    <>
      {showEdgeControls && selectedEdgeView ? (
        <EdgeSelectedControls
          view={selectedEdgeView}
          onRoutingPointerDown={handleRoutingPointerDown}
          onRoutingKeyDown={handleRoutingKeyDown}
        />
      ) : null}
      <EdgePreview />
    </>
  )
}
