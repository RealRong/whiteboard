import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'
import type { NodeId } from '@whiteboard/core'
import { nodeSelectionAtom } from '../../common/state'
import { groupHoveredAtom } from './groupRuntimeAtom'

export const nodeSelectedAtomFamily = atomFamily((nodeId: NodeId) =>
  atom((get) => get(nodeSelectionAtom).selectedNodeIds.has(nodeId))
)

export const nodeGroupHoveredAtomFamily = atomFamily((nodeId: NodeId) =>
  atom((get) => get(groupHoveredAtom) === nodeId)
)
