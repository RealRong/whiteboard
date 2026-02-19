import type { LifecycleContext } from '../../../context'
import type { PointerInput } from '@engine-types/common'
import { DEFAULT_TUNING } from '../../../config'
import {
  createPointerIntentDispatcher,
  type PointerIntent
} from '../input/pointer/intents'
import { toPointerLifecycleEvent } from '../input/pointer/source'
import {
  createPointerSession,
  type PointerSessionOnWindow
} from './pointerSession'
import { createSelectionBox } from './selectionBox'

type WindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type Options = {
  context: LifecycleContext
  onWindow: PointerSessionOnWindow
  getSelectionBox: () => SelectionBoxAccess
}

type SelectionBoxAccess = {
  watchActive: (listener: () => void) => () => void
  getPointerId: () => number | null
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handlePointerCancel: (event: PointerEvent) => void
}

type PointerBindingOptions<TActive> = {
  onWindow: PointerSessionOnWindow
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId?: (active: TActive) => number | undefined | null
  onPointerMove?: (event: PointerEvent, active: TActive) => void
  onPointerUp?: (event: PointerEvent, active: TActive) => void
  onPointerCancel?: (event: PointerEvent, active: TActive) => void
}

const createBinding = <TActive>({
  onWindow,
  watch,
  getActive,
  getPointerId,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: PointerBindingOptions<TActive>): WindowBinding =>
  createPointerSession({
    onWindow,
    watch,
    getActive,
    getPointerId,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  })

type PointerLifecycleOptions<TActive> = {
  context: LifecycleContext
  onWindow: PointerSessionOnWindow
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId: (active: TActive) => number | undefined | null
  onMove?: (active: TActive, pointer: PointerInput) => void
  onUp?: (active: TActive, pointer: PointerInput) => void
  onCancel?: (active: TActive, pointer: PointerInput) => void
}

const createPointerLifecycleBinding = <TActive>({
  context,
  onWindow,
  watch,
  getActive,
  getPointerId,
  onMove,
  onUp,
  onCancel
}: PointerLifecycleOptions<TActive>): WindowBinding =>
  createBinding({
    onWindow,
    watch,
    getActive,
    getPointerId,
    onPointerMove: onMove
      ? (nativeEvent, active) => {
          const event = toPointerLifecycleEvent(
            context.runtime.viewport,
            'move',
            nativeEvent
          )
          onMove(active, event.pointer)
        }
      : undefined,
    onPointerUp: onUp
      ? (nativeEvent, active) => {
          const event = toPointerLifecycleEvent(
            context.runtime.viewport,
            'up',
            nativeEvent
          )
          onUp(active, event.pointer)
        }
      : undefined,
    onPointerCancel: onCancel
      ? (nativeEvent, active) => {
          const event = toPointerLifecycleEvent(
            context.runtime.viewport,
            'cancel',
            nativeEvent
          )
          onCancel(active, event.pointer)
        }
      : undefined
  })

type InteractionBindingSpec = {
  watch: (listener: () => void) => () => void
  getActive: () => unknown
  getPointerId: (active: unknown) => number | undefined | null
  toMoveIntent?: (pointer: PointerInput) => PointerIntent
  toUpIntent?: (pointer: PointerInput) => PointerIntent
  toCancelIntent?: (pointer: PointerInput) => PointerIntent
}

const readPointerId = (active: unknown) =>
  (active as { pointerId?: number | null }).pointerId

const readTransformPointerId = (active: unknown) =>
  (active as { drag?: { pointerId?: number | null } }).drag?.pointerId

const createInteractionBinding = (
  context: LifecycleContext,
  onWindow: PointerSessionOnWindow,
  spec: InteractionBindingSpec
): WindowBinding => {
  const dispatchIntent = createPointerIntentDispatcher(context)

  return createPointerLifecycleBinding({
    context,
    onWindow,
    watch: spec.watch,
    getActive: spec.getActive,
    getPointerId: spec.getPointerId,
    onMove: (_active, pointer) => {
      const intent = spec.toMoveIntent?.(pointer)
      if (intent) dispatchIntent(intent)
    },
    onUp: (_active, pointer) => {
      const intent = spec.toUpIntent?.(pointer)
      if (intent) dispatchIntent(intent)
    },
    onCancel: (_active, pointer) => {
      const intent = spec.toCancelIntent?.(pointer)
      if (intent) dispatchIntent(intent)
    }
  })
}

const createInteractionSpecs = (
  context: LifecycleContext
): InteractionBindingSpec[] => {
  return [
    {
      watch: (listener) => context.state.watch('edgeConnect', listener),
      getActive: () => {
        const edgeConnect = context.state.read('edgeConnect')
        return edgeConnect.isConnecting ? edgeConnect : undefined
      },
      getPointerId: readPointerId,
      toMoveIntent: (pointer) => ({
        type: 'edge-connect.updateTo',
        pointer
      }),
      toUpIntent: (pointer) => ({
        type: 'edge-connect.commitTo',
        pointer
      })
    },
    {
      watch: (listener) => context.state.watch('routingDrag', listener),
      getActive: () => context.state.read('routingDrag').active,
      getPointerId: readPointerId,
      toMoveIntent: (pointer) => ({
        type: 'routing-drag.update',
        pointer
      }),
      toUpIntent: (pointer) => ({
        type: 'routing-drag.end',
        pointer
      }),
      toCancelIntent: (pointer) => ({
        type: 'routing-drag.cancel',
        pointer
      })
    },
    {
      watch: (listener) => context.state.watch('nodeDrag', listener),
      getActive: () => context.state.read('nodeDrag').active,
      getPointerId: readPointerId,
      toMoveIntent: (pointer) => ({
        type: 'node-drag.update',
        pointer
      }),
      toUpIntent: (pointer) => ({
        type: 'node-drag.end',
        pointer
      }),
      toCancelIntent: (pointer) => ({
        type: 'node-drag.cancel',
        pointer
      })
    },
    {
      watch: (listener) => context.state.watch('nodeTransform', listener),
      getActive: () => context.state.read('nodeTransform').active,
      getPointerId: readTransformPointerId,
      toMoveIntent: (pointer) => ({
        type: 'node-transform.update',
        pointer,
        minSize: DEFAULT_TUNING.nodeTransform.minSize
      }),
      toUpIntent: (pointer) => ({
        type: 'node-transform.end',
        pointer
      }),
      toCancelIntent: (pointer) => ({
        type: 'node-transform.cancel',
        pointer
      })
    },
    {
      watch: (listener) => context.state.watch('mindmapDrag', listener),
      getActive: () => context.state.read('mindmapDrag').active,
      getPointerId: readPointerId,
      toMoveIntent: (pointer) => ({
        type: 'mindmap-drag.update',
        pointer
      }),
      toUpIntent: (pointer) => ({
        type: 'mindmap-drag.end',
        pointer
      }),
      toCancelIntent: (pointer) => ({
        type: 'mindmap-drag.cancel',
        pointer
      })
    }
  ]
}

export class WindowBindings {
  private bindings: WindowBinding[]

  constructor({ context, onWindow, getSelectionBox }: Options) {
    this.bindings = [
      ...createInteractionSpecs(context).map((spec) =>
        createInteractionBinding(context, onWindow, spec)
      ),
      createSelectionBox({
        onWindow,
        getSelectionBox
      })
    ]
  }

  start = () => {
    this.bindings.forEach((binding) => binding.start())
  }

  sync = () => {
    this.bindings.forEach((binding) => binding.sync())
  }

  stop = () => {
    this.bindings.forEach((binding) => binding.stop())
  }
}
