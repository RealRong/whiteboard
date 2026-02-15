export type CanvasEventHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export type SelectionBoxSession = {
  watchActive: (listener: () => void) => () => void
  isActive: () => boolean
  getPointerId: () => number | null
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handlePointerCancel: (event: PointerEvent) => void
}

export type CanvasInput = {
  handlers: CanvasEventHandlers
  selectionBox: SelectionBoxSession
  onWheel: (event: WheelEvent) => void
  cancel: () => void
}
