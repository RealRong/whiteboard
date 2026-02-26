import type { Render } from '@engine-types/instance/render'
import { RenderStore } from './RenderStore'
import { Actor as SelectionActor } from './selection/Actor'

export class RenderCoordinator implements Render {
  private readonly store: RenderStore

  readonly selection: SelectionActor

  constructor(store = new RenderStore()) {
    this.store = store
    this.selection = new SelectionActor(this)
  }

  read: Render['read'] = (key) =>
    this.store.read(key)

  write: Render['write'] = (key, next) => {
    this.store.write(key, next)
  }

  batch: Render['batch'] = (action) => {
    this.store.batch(action)
  }

  batchFrame: Render['batchFrame'] = (action) => {
    this.store.batchFrame(action)
  }

  watchChanges: Render['watchChanges'] = (listener) =>
    this.store.watchChanges(listener)

  watch: Render['watch'] = (key, listener) =>
    this.store.watch(key, listener)

  resetTransient = () => {
    this.batch(() => {
      this.selection.clearBox()
    })
  }
}
