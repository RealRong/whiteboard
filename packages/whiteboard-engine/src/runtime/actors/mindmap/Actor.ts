import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { PointerInput } from '@engine-types/common'
import type {
  MindmapCancelDragOptions,
  MindmapStartDragOptions
} from '@engine-types/commands'
import { Drag } from './Drag'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
  instance?: Pick<InternalInstance, 'state' | 'view' | 'commands' | 'runtime'>
}

const isSameOptions = (
  left?: Record<string, unknown>,
  right?: Record<string, unknown>
) => {
  if (!left || !right) return !left && !right

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false
  }
  return true
}

const isSameLayout = (
  left: MindmapLayoutConfig,
  right: MindmapLayoutConfig
) =>
  left.mode === right.mode &&
  isSameOptions(
    left.options as Record<string, unknown> | undefined,
    right.options as Record<string, unknown> | undefined
  )

const cloneLayout = (
  layout: MindmapLayoutConfig
): MindmapLayoutConfig => ({
  mode: layout.mode,
  options: layout.options
    ? { ...layout.options }
    : undefined
})

export class Actor {
  readonly name = 'Mindmap'

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private readonly drag: Drag | null
  private started = false
  private unsubs: Array<() => void> = []

  private lastLayout: MindmapLayoutConfig | null = null

  constructor({ state, emit, instance }: ActorOptions) {
    this.state = state
    this.emit = emit
    this.drag = instance
      ? new Drag({ instance })
      : null
  }

  private emitChanged = (force = false) => {
    const layout = this.state.read('mindmapLayout')
    const changed = !this.lastLayout || !isSameLayout(this.lastLayout, layout)

    if (changed) {
      this.lastLayout = cloneLayout(layout)
    }

    if (!force && !changed) return
    this.emit('mindmap.layout.changed', { layout: cloneLayout(layout) })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('mindmapLayout', () => this.emitChanged(false))
    ]
    this.emitChanged(true)
  }

  stop = () => {
    if (!this.started && !this.unsubs.length) return
    this.started = false
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  }

  startDrag = (options: MindmapStartDragOptions) =>
    this.drag ? this.drag.start(options) : false

  updateDrag = (pointer: PointerInput) =>
    this.drag ? this.drag.update({ pointer }) : false

  endDrag = (pointer: PointerInput) =>
    this.drag ? this.drag.end({ pointer }) : false

  cancelDrag = (options?: MindmapCancelDragOptions) =>
    this.drag ? this.drag.cancel(options) : false
}
