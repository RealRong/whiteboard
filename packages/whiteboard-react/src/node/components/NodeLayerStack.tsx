import { NodeLayer } from './NodeLayer'
import { useGroupAutoFit } from '../lifecycle'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useDoc, useInstance, useWhiteboardConfig } from '../../common/hooks'

export const NodeLayerStack = () => {
  const doc = useDoc()
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()

  useGroupAutoFit({
    core: instance.core,
    nodes: doc?.nodes ?? [],
    nodeSize,
    padding: DEFAULT_GROUP_PADDING
  })

  return (
    <NodeLayer />
  )
}
