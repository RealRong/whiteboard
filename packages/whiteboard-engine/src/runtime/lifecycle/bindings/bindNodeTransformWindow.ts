import type { Instance } from '@engine-types/instance'
import { createPointerSession } from './bindPointerSessionWindow'

const NODE_TRANSFORM_MIN_SIZE = { width: 20, height: 20 }

type Options = {
  state: Instance['state']
  events: Instance['runtime']['events']
  nodeTransformCommands: Pick<
    Instance['commands']['nodeTransform'],
    'update' | 'end' | 'cancel'
  >
}

export type NodeTransformBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createNodeTransform = ({
  state,
  events,
  nodeTransformCommands
}: Options): NodeTransformBinding =>
  createPointerSession({
    events,
    watch: (listener) => state.watch('nodeTransform', listener),
    getActive: () => state.read('nodeTransform').active,
    getPointerId: (active) => active.drag.pointerId,
    onPointerMove: (event) => {
      nodeTransformCommands.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        minSize: NODE_TRANSFORM_MIN_SIZE,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      })
    },
    onPointerUp: (event) => {
      nodeTransformCommands.end({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      nodeTransformCommands.cancel({ pointerId: event.pointerId })
    }
  })
