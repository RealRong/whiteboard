import type { Instance } from '@engine-types/instance/instance'
import { DEFAULT_TUNING } from '../../../config'
import type { DomBindings } from '../../../host/dom'
import type { SelectionBoxSession } from '../input/types'
import { createPointerSession } from './pointerSessionWindow'
import { createSelectionBox } from './selectionBoxWindow'

export type WindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

type Options = {
  instance: Instance
  dom: DomBindings
  getSelectionBox: () => SelectionBoxSession
}

type PointerBindingOptions<TActive> = {
  dom: DomBindings
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId?: (active: TActive) => number | undefined | null
  onPointerMove?: (event: PointerEvent, active: TActive) => void
  onPointerUp?: (event: PointerEvent, active: TActive) => void
  onPointerCancel?: (event: PointerEvent, active: TActive) => void
}

const createBinding = <TActive>({
  dom,
  watch,
  getActive,
  getPointerId,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: PointerBindingOptions<TActive>): WindowBinding =>
  createPointerSession({
    dom,
    watch,
    getActive,
    getPointerId,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  })

const createDragBinding = <TActive>(options: {
  dom: DomBindings
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId: (active: TActive) => number | undefined | null
  onPointerMove: (event: PointerEvent, active: TActive) => void
  onPointerUp: (pointerId: number) => void
  onPointerCancel: (pointerId: number) => void
}): WindowBinding =>
  createBinding({
    dom: options.dom,
    watch: options.watch,
    getActive: options.getActive,
    getPointerId: options.getPointerId,
    onPointerMove: options.onPointerMove,
    onPointerUp: (event) => {
      options.onPointerUp(event.pointerId)
    },
    onPointerCancel: (event) => {
      options.onPointerCancel(event.pointerId)
    }
  })

const createEdgeConnectBinding = (instance: Instance, dom: DomBindings): WindowBinding =>
  createBinding({
    dom,
    watch: (listener) => instance.state.watch('edgeConnect', listener),
    getActive: () => {
      const current = instance.state.read('edgeConnect')
      return current.isConnecting ? current : undefined
    },
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      const pointWorld = instance.runtime.viewport.clientToWorld(event.clientX, event.clientY)
      instance.runtime.interaction.edgeConnect.updateTo(pointWorld)
    },
    onPointerUp: (event) => {
      const pointWorld = instance.runtime.viewport.clientToWorld(event.clientX, event.clientY)
      instance.runtime.interaction.edgeConnect.commitTo(pointWorld)
    }
  })

const createRoutingDragBinding = (instance: Instance, dom: DomBindings): WindowBinding =>
  createDragBinding({
    dom,
    watch: (listener) => instance.state.watch('routingDrag', listener),
    getActive: () => instance.state.read('routingDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.runtime.interaction.routingDrag.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (pointerId) => {
      instance.runtime.interaction.routingDrag.end({
        pointerId
      })
    },
    onPointerCancel: (pointerId) => {
      instance.runtime.interaction.routingDrag.cancel({
        pointerId
      })
    }
  })

const createNodeDragBinding = (instance: Instance, dom: DomBindings): WindowBinding =>
  createDragBinding({
    dom,
    watch: (listener) => instance.state.watch('nodeDrag', listener),
    getActive: () => instance.state.read('nodeDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.runtime.interaction.nodeDrag.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        altKey: event.altKey
      })
    },
    onPointerUp: (pointerId) => {
      instance.runtime.interaction.nodeDrag.end({ pointerId })
    },
    onPointerCancel: (pointerId) => {
      instance.runtime.interaction.nodeDrag.cancel({ pointerId })
    }
  })

const createNodeTransformBinding = (instance: Instance, dom: DomBindings): WindowBinding =>
  createDragBinding({
    dom,
    watch: (listener) => instance.state.watch('nodeTransform', listener),
    getActive: () => instance.state.read('nodeTransform').active,
    getPointerId: (active) => active.drag.pointerId,
    onPointerMove: (event) => {
      instance.runtime.interaction.nodeTransform.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        minSize: DEFAULT_TUNING.nodeTransform.minSize,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      })
    },
    onPointerUp: (pointerId) => {
      instance.runtime.interaction.nodeTransform.end({ pointerId })
    },
    onPointerCancel: (pointerId) => {
      instance.runtime.interaction.nodeTransform.cancel({ pointerId })
    }
  })

const createMindmapDragBinding = (instance: Instance, dom: DomBindings): WindowBinding =>
  createDragBinding({
    dom,
    watch: (listener) => instance.state.watch('mindmapDrag', listener),
    getActive: () => instance.state.read('mindmapDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.runtime.interaction.mindmapDrag.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (pointerId) => {
      instance.runtime.interaction.mindmapDrag.end({ pointerId })
    },
    onPointerCancel: (pointerId) => {
      instance.runtime.interaction.mindmapDrag.cancel({ pointerId })
    }
  })

export const createWindowBindings = ({
  instance,
  dom,
  getSelectionBox
}: Options): WindowBinding[] => {
  return [
    createEdgeConnectBinding(instance, dom),
    createRoutingDragBinding(instance, dom),
    createNodeDragBinding(instance, dom),
    createNodeTransformBinding(instance, dom),
    createMindmapDragBinding(instance, dom),
    createSelectionBox({
      dom,
      getSelectionBox
    })
  ]
}

export const startWindowBindings = (bindings: WindowBinding[]) => {
  bindings.forEach((binding) => binding.start())
}

export const syncWindowBindings = (bindings: WindowBinding[]) => {
  bindings.forEach((binding) => binding.sync())
}

export const stopWindowBindings = (bindings: WindowBinding[]) => {
  bindings.forEach((binding) => binding.stop())
}
