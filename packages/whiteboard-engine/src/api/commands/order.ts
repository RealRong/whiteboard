import type { Command } from '@engine-types/command'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import type { ApplyCommandChange } from './shared'

export const createOrder = (_instance: Instance, applyChange: ApplyCommandChange): Commands['order'] => {
  const applyOrderChange = (change: Command) => applyChange(change)

  return {
    node: {
      set: (ids) => applyOrderChange({ type: 'node.order.set', ids }),
      bringToFront: (ids) => applyOrderChange({ type: 'node.order.bringToFront', ids }),
      sendToBack: (ids) => applyOrderChange({ type: 'node.order.sendToBack', ids }),
      bringForward: (ids) => applyOrderChange({ type: 'node.order.bringForward', ids }),
      sendBackward: (ids) => applyOrderChange({ type: 'node.order.sendBackward', ids })
    },
    edge: {
      set: (ids) => applyOrderChange({ type: 'edge.order.set', ids }),
      bringToFront: (ids) => applyOrderChange({ type: 'edge.order.bringToFront', ids }),
      sendToBack: (ids) => applyOrderChange({ type: 'edge.order.sendToBack', ids }),
      bringForward: (ids) => applyOrderChange({ type: 'edge.order.bringForward', ids }),
      sendBackward: (ids) => applyOrderChange({ type: 'edge.order.sendBackward', ids })
    }
  }
}
