import type {
  Render,
  RenderKey,
  RenderSnapshot,
  WritableRenderKey,
  WritableRenderSnapshot
} from '@engine-types/instance/render'
import { WritableStore } from '../../state/store'
import { createInitialRenderState } from '../../state/initialState'

export class RenderStore implements Render {
  private readonly store = new WritableStore<RenderSnapshot>(
    createInitialRenderState()
  )

  read = <K extends RenderKey>(key: K): RenderSnapshot[K] =>
    this.store.get(key)

  write = <K extends WritableRenderKey>(
    key: K,
    next:
      | WritableRenderSnapshot[K]
      | ((prev: WritableRenderSnapshot[K]) => WritableRenderSnapshot[K])
  ) => {
    this.store.set(
      key,
      next as
        | RenderSnapshot[K]
        | ((prev: RenderSnapshot[K]) => RenderSnapshot[K])
    )
  }

  batch: Render['batch'] = (action) => {
    this.store.batch(action)
  }

  batchFrame: Render['batchFrame'] = (action) => {
    this.store.batchFrame(action)
  }

  watchChanges: Render['watchChanges'] = (listener) =>
    this.store.watchChanges(listener as (key: keyof RenderSnapshot) => void)

  watch: Render['watch'] = (key, listener) =>
    this.store.watch(key, listener)
}
