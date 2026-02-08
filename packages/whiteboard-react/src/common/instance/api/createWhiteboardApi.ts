import type { WhiteboardApi } from 'types/api'
import type { WhiteboardInstance } from 'types/instance'
import { edgeSelectionAtom, interactionAtom, spacePressedAtom, toolAtom } from '../../state'
import { createEdgeConnectApi } from './createEdgeConnectApi'
import { createSelectionApi } from './createSelectionApi'
import { createTransientApi } from './createTransientApi'
import { mergeInteractionPatch } from '../state/interactionState'
import { setStoreAtom } from '../store/setStoreAtom'
import { groupHoveredAtom } from '../../../node/state'

export const createWhiteboardApi = (instance: WhiteboardInstance): WhiteboardApi => {
  const { store } = instance.state

  const selection = createSelectionApi(instance)
  const { edgeConnect, cancelHoverFrame } = createEdgeConnectApi(instance)
  const transient = createTransientApi(instance, {
    cancelEdgeHoverFrame: cancelHoverFrame
  })

  return {
    tool: {
      set: (tool) => {
        setStoreAtom(store, toolAtom, tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        setStoreAtom(store, spacePressedAtom, pressed)
      }
    },
    interaction: {
      update: (patch) => {
        setStoreAtom(store, interactionAtom, (prev) => mergeInteractionPatch(prev, patch))
      },
      clearHover: () => {
        setStoreAtom(store, interactionAtom, (prev) =>
          mergeInteractionPatch(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    },
    selection,
    edge: {
      select: (id) => {
        setStoreAtom(store, edgeSelectionAtom, (prev) => (prev === id ? prev : id))
      }
    },
    edgeConnect,
    groupRuntime: {
      setHoveredGroupId: (groupId) => {
        setStoreAtom(store, groupHoveredAtom, groupId)
      }
    },
    transient
  }
}
