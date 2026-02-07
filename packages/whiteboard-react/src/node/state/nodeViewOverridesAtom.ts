import { atom } from 'jotai'
import type { NodeId, Point, Size } from '@whiteboard/core'

export type NodeOverride = {
  position?: Point
  size?: Size
}

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export const nodeViewOverridesAtom = atom<Map<NodeId, NodeOverride>>(new Map())

export const nodeViewOverridesTransientAtom = nodeViewOverridesAtom
