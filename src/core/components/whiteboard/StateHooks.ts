import { useAtom, useAtomValue } from 'jotai/react'
import { atom } from 'jotai/vanilla'
import { EdgePosition, IWhiteboard, IWhiteboardNode } from '~/typings'
import { selectAtom } from 'jotai/utils'

const WhiteboardNodesAtom = atom(get => {
  const nodes = get(WhiteboardSelectNodesAtom)
  return nodes || new Map<number, IWhiteboardNode>()
})

export const WhiteboardEdgesAtom = atom(get => {
  const edges = get(WhiteboardSelectEdgesAtom)
  return edges || new Map()
})

export const WhiteboardAtom = atom<IWhiteboard | undefined>(undefined)

const WhiteboardSelectNodesAtom = selectAtom(WhiteboardAtom, w => w?.nodes)

const WhiteboardSelectEdgesAtom = selectAtom(WhiteboardAtom, w => w?.edges)

export const useWhiteboardNodes = () => useAtomValue(WhiteboardNodesAtom)

export const useWhiteboardEdges = () => useAtomValue(WhiteboardEdgesAtom)