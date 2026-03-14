import { useInternalInstance as useInstance } from '../../../runtime/hooks'
import { EdgeLayer } from './EdgeLayer'

export const EdgeSceneLayer = () => {
  const instance = useInstance()

  return (
    <EdgeLayer handleEdgePathPointerDown={instance.interaction.edgeRouting.handleEdgePathPointerDown} />
  )
}
