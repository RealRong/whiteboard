import { useDoc, useInstance, useWhiteboardConfig } from '../../common/hooks'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { useGroupAutoFit } from './useGroupAutoFit'

export const useNodeLifecycle = () => {
  const doc = useDoc()
  const instance = useInstance()
  const { nodeSize } = useWhiteboardConfig()

  useGroupAutoFit({
    core: instance.core,
    nodes: doc?.nodes ?? [],
    nodeSize,
    padding: DEFAULT_GROUP_PADDING
  })
}
