import { atom } from 'jotai'
import type { Node, NodeId } from '@whiteboard/core'
import type { Size } from '../../common/types'
import { DEFAULT_GROUP_PADDING } from '../constants'
import { instanceAtom } from '../../common/state'
import { canvasNodesAtom } from '../../common/state'

export type GroupRuntime = {
  nodes: Node[]
  nodeSize: Size
  padding?: number
  hoveredGroupId?: NodeId
}

const emptySize: Size = { width: 1, height: 1 }

export const groupRuntimeDataAtom = atom<Omit<GroupRuntime, 'hoveredGroupId'>>((get) => {
  const nodes = get(canvasNodesAtom)
  const instance = get(instanceAtom)
  const nodeSize = instance?.config.nodeSize ?? emptySize
  if (!nodes.length) {
    return {
      nodes: [],
      nodeSize,
      padding: DEFAULT_GROUP_PADDING
    }
  }
  return {
    nodes,
    nodeSize,
    padding: DEFAULT_GROUP_PADDING
  }
})

export const groupHoveredAtom = atom<NodeId | undefined>(undefined)

export const groupHoveredTransientAtom = groupHoveredAtom

export const groupRuntimeAtom = atom<GroupRuntime>((get) => ({
  ...get(groupRuntimeDataAtom),
  hoveredGroupId: get(groupHoveredAtom)
}))
