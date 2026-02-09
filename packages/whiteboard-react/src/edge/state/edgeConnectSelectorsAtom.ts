import { atom } from 'jotai'
import { canvasNodesAtom, edgeConnectAtom, edgeSelectionAtom, toolAtom } from '../../common/state'

export const activeEdgeToolAtom = atom<'select' | 'edge'>((get) => {
  const tool = get(toolAtom)
  return (tool as 'select' | 'edge') ?? 'select'
})

export const edgeConnectViewStateAtom = atom((get) => ({
  canvasNodes: get(canvasNodesAtom),
  state: get(edgeConnectAtom),
  selectedEdgeId: get(edgeSelectionAtom),
  tool: get(activeEdgeToolAtom)
}))

export const edgeConnectLayerStateAtom = atom((get) => ({
  state: get(edgeConnectAtom),
  selectedEdgeId: get(edgeSelectionAtom)
}))
