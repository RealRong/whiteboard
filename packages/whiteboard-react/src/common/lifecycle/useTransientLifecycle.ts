import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { edgeConnectTransientAtom, hoveredEdgeIdAtom } from '../state/whiteboardAtoms'
import { dragGuidesTransientAtom, groupHoveredTransientAtom, nodeViewOverridesTransientAtom } from '../../node/state'

export const useTransientLifecycle = () => {
  const setEdgeConnectTransient = useSetAtom(edgeConnectTransientAtom)
  const setHoveredEdgeId = useSetAtom(hoveredEdgeIdAtom)
  const setDragGuidesTransient = useSetAtom(dragGuidesTransientAtom)
  const setGroupHoveredTransient = useSetAtom(groupHoveredTransientAtom)
  const setNodeOverridesTransient = useSetAtom(nodeViewOverridesTransientAtom)

  useEffect(() => {
    return () => {
      setEdgeConnectTransient({ isConnecting: false })
      setHoveredEdgeId(undefined)
      setDragGuidesTransient([])
      setGroupHoveredTransient(undefined)
      setNodeOverridesTransient(new Map())
    }
  }, [
    setDragGuidesTransient,
    setEdgeConnectTransient,
    setGroupHoveredTransient,
    setHoveredEdgeId,
    setNodeOverridesTransient
  ])
}
