import { useStore } from 'jotai'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { IWhiteboard, IWhiteboardInstance } from '~/typings'
import produce, { Draft, produceWithPatches } from 'immer'
import { useRef } from 'react'
import { ObjectStore } from '@/api/stores'

const useUpdateWhiteboard = (instance: IWhiteboardInstance) => {
  const store = useStore()
  const cachedRequest = useRef<
    {
      updater: (draft: Draft<IWhiteboard>) => void
      withUndo?: boolean
    }[]
  >([])
  const batchUpdateWhiteboard = async (currentState: IWhiteboard) => {
    const withUndoRequests: typeof cachedRequest.current = [],
      commonRequests: typeof cachedRequest.current = []
    cachedRequest.current.forEach(r => {
      if (r.withUndo) {
        withUndoRequests.push(r)
      } else {
        commonRequests.push(r)
      }
    })

    let afterRequestState =
      commonRequests.length > 0
        ? produce(currentState, draft => {
            commonRequests.forEach(r => r.updater(draft))
          })
        : currentState
    if (withUndoRequests.length > 0) {
      const [s, patches, inversePatches] = produceWithPatches(afterRequestState, draft => {
        withUndoRequests.forEach(r => r.updater(draft))
      })
      afterRequestState = s
      instance.historyOps?.pushUpdates({
        patches,
        inversePatches
      })
    }
    cachedRequest.current = []
    instance.values.store.set(WhiteboardAtom, afterRequestState)
    await ObjectStore('whiteboard').updateOne(afterRequestState)
  }
  return async (update: (draft: Draft<IWhiteboard>) => void, withUndo?: boolean) => {
    const currentState = store.get(WhiteboardAtom)
    if (currentState) {
      const initializedState = {
        ...currentState,
        nodes: currentState.nodes || new Map(),
        edges: currentState.edges || new Map()
      }
      if (cachedRequest.current.length === 0) {
        cachedRequest.current.push({
          updater: update,
          withUndo
        })
        await Promise.resolve()
        await batchUpdateWhiteboard(initializedState)
      } else {
        cachedRequest.current.push({
          updater: update,
          withUndo
        })
      }
    }
    return
  }
}
export default useUpdateWhiteboard
