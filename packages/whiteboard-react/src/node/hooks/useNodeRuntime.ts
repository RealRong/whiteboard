import { useMemo } from 'react'
import { useSetAtom } from 'jotai'
import type { Core, Node } from '@whiteboard/core'
import { nodeTransientAtom } from '../state/nodeTransientAtom'
import { useNodeViewState } from './useNodeViewState'
import { viewNodesAtom } from '../state/viewNodesAtom'

export const useNodeRuntime = (nodes: Node[], core: Core) => {
  const nodeView = useNodeViewState(nodes, core)
  const setViewNodes = useSetAtom(viewNodesAtom)
  const setNodeTransient = useSetAtom(nodeTransientAtom)

  const transientApi = useMemo(
    () => ({
      setOverrides: nodeView.setOverrides,
      clearOverrides: nodeView.clearOverrides,
      commitOverrides: nodeView.commitOverrides
    }),
    [nodeView.clearOverrides, nodeView.commitOverrides, nodeView.setOverrides]
  )

  return {
    nodeView,
    transientApi,
    setViewNodes,
    setNodeTransient
  }
}
