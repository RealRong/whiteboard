import type {
  DispatchResult,
  NodeId
} from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../common/instance'
import { selectNodeIds } from '../node/actions'

export const closeAfter = (
  effect: Promise<unknown>,
  close: () => void
) => {
  void effect.finally(close)
}

export const closeAfterDispatch = (
  effect: Promise<DispatchResult>,
  close: () => void,
  onSuccess?: (result: DispatchResult) => void
) => {
  void effect
    .then((result) => {
      if (!result.ok) return
      onSuccess?.(result)
    })
    .finally(close)
}

export const closeAfterSelectNodes = (
  instance: InternalWhiteboardInstance,
  nodeIds: readonly NodeId[],
  effect: Promise<DispatchResult>,
  close: () => void
) => {
  closeAfterDispatch(effect, close, () => {
    selectNodeIds(instance, nodeIds)
  })
}
