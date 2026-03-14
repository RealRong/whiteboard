import { EdgeLayer } from './EdgeLayer'
import { useEdgeRouting } from '../hooks/routing/useEdgeRouting'

export const EdgeSceneLayer = () => {
  const {
    handleEdgePathPointerDown
  } = useEdgeRouting()

  return (
    <EdgeLayer handleEdgePathPointerDown={handleEdgePathPointerDown} />
  )
}
