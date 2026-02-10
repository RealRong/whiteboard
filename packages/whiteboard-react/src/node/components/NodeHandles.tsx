import type { PointerEvent } from 'react'
import type { NodeHandleSide, NodeHandlesProps } from 'types/node'

const sideClassName: Record<NodeHandleSide, string> = {
  top: 'wb-node-handle-top',
  right: 'wb-node-handle-right',
  bottom: 'wb-node-handle-bottom',
  left: 'wb-node-handle-left'
}

export const NodeHandles = ({ onPointerDown }: NodeHandlesProps) => {
  const sides: NodeHandleSide[] = ['top', 'right', 'bottom', 'left']
  return (
    <>
      {sides.map((side) => (
        <div
          key={side}
          data-selection-ignore
          className={`wb-node-handle ${sideClassName[side]}`}
          onPointerDown={(event) => {
            if (!onPointerDown) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            onPointerDown(event, side)
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          onPointerMove={(event) => event.preventDefault()}
        />
      ))}
    </>
  )
}
