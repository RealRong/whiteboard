import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { edgeConnectTransientAtom } from '../state/whiteboardAtoms'
import { dragGuidesTransientAtom, groupHoveredTransientAtom, nodeViewOverridesTransientAtom } from '../../node/state'

export const useTransientLifecycle = () => {
  const setEdgeConnectTransient = useSetAtom(edgeConnectTransientAtom)
  const setDragGuidesTransient = useSetAtom(dragGuidesTransientAtom)
  const setGroupHoveredTransient = useSetAtom(groupHoveredTransientAtom)
  const setNodeOverridesTransient = useSetAtom(nodeViewOverridesTransientAtom)

  useEffect(() => {
    return () => {
      setEdgeConnectTransient({ isConnecting: false })
      setDragGuidesTransient([])
      setGroupHoveredTransient(undefined)
      setNodeOverridesTransient(new Map())
    }
  }, [
    setDragGuidesTransient,
    setEdgeConnectTransient,
    setGroupHoveredTransient,
    setNodeOverridesTransient
  ])
}
