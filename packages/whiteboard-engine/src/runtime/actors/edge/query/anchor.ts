import type { EdgeConnectState } from '@engine-types/state'
export {
  getAnchorFromPoint,
  getAutoAnchorFromRect,
  type AnchorSnapOptions
} from '@whiteboard/core/types'

export type ConnectTo = NonNullable<EdgeConnectState['to']>

export const isSameConnectTo = (left?: EdgeConnectState['hover'], right?: ConnectTo) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    left.nodeId === right.nodeId &&
    left.anchor?.side === right.anchor?.side &&
    left.anchor?.offset === right.anchor?.offset &&
    left.pointWorld?.x === right.pointWorld?.x &&
    left.pointWorld?.y === right.pointWorld?.y
  )
}
