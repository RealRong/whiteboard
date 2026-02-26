import type { Render } from '@engine-types/instance/render'
import { RenderStore } from './RenderStore'
import { Actor as InteractionActor } from './interaction/Actor'
import { Actor as NodeActor } from './node/Actor'
import { Actor as MindmapActor } from './mindmap/Actor'
import { Actor as SelectionActor } from './selection/Actor'
import { Actor as ViewportActor } from './viewport/Actor'
import { Actor as KeyboardActor } from './keyboard/Actor'

export class RenderCoordinator implements Render {
  private readonly store: RenderStore

  readonly interaction: InteractionActor
  readonly node: NodeActor
  readonly mindmap: MindmapActor
  readonly selection: SelectionActor
  readonly viewport: ViewportActor
  readonly keyboard: KeyboardActor

  constructor(store = new RenderStore()) {
    this.store = store
    this.interaction = new InteractionActor(this)
    this.node = new NodeActor(this)
    this.mindmap = new MindmapActor(this)
    this.selection = new SelectionActor(this)
    this.viewport = new ViewportActor(this)
    this.keyboard = new KeyboardActor(this)
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
      this.interaction.clear()
      this.node.clearTransient()
      this.mindmap.clearDrag()
      this.selection.clearBox()
      this.viewport.clearPreview()
    })
  }
}
