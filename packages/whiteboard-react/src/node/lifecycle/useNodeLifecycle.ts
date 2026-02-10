import { useDoc, useInstance } from '../../common/hooks'
import { useGroupAutoFit } from './useGroupAutoFit'

export const useNodeLifecycle = () => {
  const doc = useDoc()
  const instance = useInstance()
  const { nodeSize, node } = instance.runtime.config

  useGroupAutoFit({
    core: instance.runtime.core,
    nodes: doc?.nodes ?? [],
    nodeSize,
    padding: node.groupPadding
  })
}
