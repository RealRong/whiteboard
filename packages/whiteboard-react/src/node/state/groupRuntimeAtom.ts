import { atom } from 'jotai'
import type { Node, NodeId } from '@whiteboard/core'
import type { Size } from '../../common/types'

export type GroupRuntime = {
  nodes: Node[]
  nodeSize: Size
  padding?: number
  hoveredGroupId?: NodeId
}

const emptySize: Size = { width: 1, height: 1 }

export const groupRuntimeAtom = atom<GroupRuntime>({
  nodes: [],
  nodeSize: emptySize,
  padding: undefined,
  hoveredGroupId: undefined
})
