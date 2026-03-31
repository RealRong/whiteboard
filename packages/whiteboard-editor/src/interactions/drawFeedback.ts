import { createRafValueStore, type ReadStore } from '@whiteboard/engine'
import type { NodeId } from '@whiteboard/core/types'
import type { DrawPreview } from '../types/draw'
import type { FeatureRuntime } from '../runtime/editor/createEditor'

type DrawFeedbackDeps = Pick<
  FeatureRuntime,
  'output'
>

export type DrawFeedback = {
  preview: ReadStore<DrawPreview | null>
  writePreview: (preview: DrawPreview | null) => void
  clearPreview: () => void
  writeHidden: (nodeIds: readonly NodeId[]) => void
  clearHidden: () => void
  clear: () => void
}

export const createDrawFeedback = (
  ctx: DrawFeedbackDeps
): DrawFeedback => {
  const previewStore = createRafValueStore<DrawPreview | null>({
    initial: null,
    isEqual: (left, right) => left === right
  })

  const clearPreview = () => {
    previewStore.clear()
  }

  const writePreview = (
    preview: DrawPreview | null
  ) => {
    if (preview === null) {
      clearPreview()
      return
    }

    previewStore.write(preview)
  }

  const clearHidden = () => {
    ctx.output.node.set((current) => (
      current.hidden.length === 0
        ? current
        : {
            ...current,
            hidden: []
          }
    ))
  }

  const writeHidden = (
    nodeIds: readonly NodeId[]
  ) => {
    ctx.output.node.set((current) => ({
      ...current,
      hidden: nodeIds
    }))
  }

  const clear = () => {
    clearPreview()
    clearHidden()
  }

  return {
    preview: {
      get: previewStore.get,
      subscribe: previewStore.subscribe
    },
    writePreview,
    clearPreview,
    writeHidden,
    clearHidden,
    clear
  }
}
