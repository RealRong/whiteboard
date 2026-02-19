import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import { applyCommandChange } from './apply'

export const createOrder = (instance: Instance): Commands['order'] => ({
  node: {
    set: (ids) => applyCommandChange(instance, { type: 'node.order.set', ids }),
    bringToFront: (ids) => applyCommandChange(instance, { type: 'node.order.bringToFront', ids }),
    sendToBack: (ids) => applyCommandChange(instance, { type: 'node.order.sendToBack', ids }),
    bringForward: (ids) => applyCommandChange(instance, { type: 'node.order.bringForward', ids }),
    sendBackward: (ids) => applyCommandChange(instance, { type: 'node.order.sendBackward', ids })
  },
  edge: {
    set: (ids) => applyCommandChange(instance, { type: 'edge.order.set', ids }),
    bringToFront: (ids) => applyCommandChange(instance, { type: 'edge.order.bringToFront', ids }),
    sendToBack: (ids) => applyCommandChange(instance, { type: 'edge.order.sendToBack', ids }),
    bringForward: (ids) => applyCommandChange(instance, { type: 'edge.order.bringForward', ids }),
    sendBackward: (ids) => applyCommandChange(instance, { type: 'edge.order.sendBackward', ids })
  }
})
