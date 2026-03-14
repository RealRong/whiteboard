import { useTransientReset } from '../../common/hooks'
import { useInteractionView } from '../../interaction/view'
import { useSelectedEdgeView } from '../hooks/useSelectedEdgeView'
import { useEdgeRouting } from '../hooks/routing/useEdgeRouting'
import { EdgePreview } from './EdgePreview'
import { EdgeSelectedControls } from './EdgeSelectedControls'

export const EdgeOverlayLayer = () => {
  const interaction = useInteractionView()
  const selectedEdgeView = useSelectedEdgeView()
  const {
    cancelRoutingSession,
    handleRoutingPointerDown,
    handleRoutingKeyDown
  } = useEdgeRouting()

  useTransientReset(cancelRoutingSession)

  return (
    <>
      {interaction.showEdgeControls && selectedEdgeView ? (
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
