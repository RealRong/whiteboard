export type CanvasEventHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

export type CanvasInputRuntime = {
  handlers: CanvasEventHandlers
  onWheel: (event: WheelEvent) => void
  cancel: () => void
}
