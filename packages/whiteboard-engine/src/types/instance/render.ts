import type {
  SelectionBoxState
} from '../state'

export type RenderSnapshot = {
  selectionBox: SelectionBoxState
}

export type RenderKey = keyof RenderSnapshot
export type WritableRenderSnapshot = RenderSnapshot
export type WritableRenderKey = keyof WritableRenderSnapshot

export type Render = {
  read: <K extends RenderKey>(key: K) => RenderSnapshot[K]
  write: <K extends WritableRenderKey>(
    key: K,
    next:
      | WritableRenderSnapshot[K]
      | ((prev: WritableRenderSnapshot[K]) => WritableRenderSnapshot[K])
  ) => void
  batch: (action: () => void) => void
  batchFrame: (action: () => void) => void
  watchChanges: (listener: (key: RenderKey) => void) => () => void
  watch: (key: RenderKey, listener: () => void) => () => void
}
