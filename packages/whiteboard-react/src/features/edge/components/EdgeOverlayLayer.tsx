import { useInteraction } from '../../../runtime/hooks'
import { useSelectedEdgeView } from '../hooks/useEdgeView'
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
    && interaction === 'idle'

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
