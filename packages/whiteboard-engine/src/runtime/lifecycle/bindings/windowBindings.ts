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

type PointerWindowBindingOptions<TActive> = {
  dom: DomBindings
  watch: (listener: () => void) => () => void
  getActive: () => TActive | undefined
  getPointerId?: (active: TActive) => number | undefined | null
  onPointerMove?: (event: PointerEvent, active: TActive) => void
  onPointerUp?: (event: PointerEvent, active: TActive) => void
  onPointerCancel?: (event: PointerEvent, active: TActive) => void
}

const createPointerWindowBinding = <TActive>({
  dom,
  watch,
  getActive,
  getPointerId,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: PointerWindowBindingOptions<TActive>): WindowBinding =>
  createPointerSession({
    dom,
    watch,
    getActive,
    getPointerId,
    onPointerMove,
    onPointerUp,
    onPointerCancel
  })

const createEdgeConnectBinding = (
  instance: Instance,
  dom: DomBindings
): WindowBinding =>
  createPointerWindowBinding({
    dom,
    watch: (listener) => instance.state.watch('edgeConnect', listener),
    getActive: () => {
      const current = instance.state.read('edgeConnect')
      return current.isConnecting ? current : undefined
    },
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      const pointWorld = instance.runtime.viewport.clientToWorld(event.clientX, event.clientY)
      instance.commands.edgeConnect.updateTo(pointWorld)
    },
    onPointerUp: (event) => {
      const pointWorld = instance.runtime.viewport.clientToWorld(event.clientX, event.clientY)
      instance.commands.edgeConnect.commitTo(pointWorld)
    }
  })

const createRoutingDragBinding = (
  instance: Instance,
  dom: DomBindings
): WindowBinding =>
  createPointerWindowBinding({
    dom,
    watch: (listener) => instance.state.watch('routingDrag', listener),
    getActive: () => instance.state.read('routingDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.commands.edge.updateRoutingDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (event) => {
      instance.commands.edge.endRoutingDrag({
        pointerId: event.pointerId
      })
    },
    onPointerCancel: (event) => {
      instance.commands.edge.cancelRoutingDrag({
        pointerId: event.pointerId
      })
    }
  })

const createNodeDragBinding = (
  instance: Instance,
  dom: DomBindings
): WindowBinding =>
  createPointerWindowBinding({
    dom,
    watch: (listener) => instance.state.watch('nodeDrag', listener),
    getActive: () => instance.state.read('nodeDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.commands.nodeDrag.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        altKey: event.altKey
      })
    },
    onPointerUp: (event) => {
      instance.commands.nodeDrag.end({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      instance.commands.nodeDrag.cancel({ pointerId: event.pointerId })
    }
  })

const createNodeTransformBinding = (
  instance: Instance,
  dom: DomBindings
): WindowBinding =>
  createPointerWindowBinding({
    dom,
    watch: (listener) => instance.state.watch('nodeTransform', listener),
    getActive: () => instance.state.read('nodeTransform').active,
    getPointerId: (active) => active.drag.pointerId,
    onPointerMove: (event) => {
      instance.commands.nodeTransform.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        minSize: DEFAULT_TUNING.nodeTransform.minSize,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      })
    },
    onPointerUp: (event) => {
      instance.commands.nodeTransform.end({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      instance.commands.nodeTransform.cancel({ pointerId: event.pointerId })
    }
  })

const createMindmapDragBinding = (
  instance: Instance,
  dom: DomBindings
): WindowBinding =>
  createPointerWindowBinding({
    dom,
    watch: (listener) => instance.state.watch('mindmapDrag', listener),
    getActive: () => instance.state.read('mindmapDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      instance.commands.mindmap.updateDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (event) => {
      instance.commands.mindmap.endDrag({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      instance.commands.mindmap.cancelDrag({ pointerId: event.pointerId })
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
