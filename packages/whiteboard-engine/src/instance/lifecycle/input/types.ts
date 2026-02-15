export type CanvasEventHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export type SelectionBoxSessionRuntime = {
  watchActive: (listener: () => void) => () => void
  isActive: () => boolean
  getPointerId: () => number | null
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handlePointerCancel: (event: PointerEvent) => void
}

export type CanvasInputRuntime = {
  handlers: CanvasEventHandlers
  selectionBox: SelectionBoxSessionRuntime
  onWheel: (event: WheelEvent) => void
  cancel: () => void
}
