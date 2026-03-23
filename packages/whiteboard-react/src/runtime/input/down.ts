import type { InteractionMode } from '../interaction'
import type { InternalInstance } from '../instance'
import type { PointerPick } from '../pick'
import type { Tool } from '../tool'

export type CanvasDown = PointerPick & {
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  tool: Tool
  mode: InteractionMode
}

export const readCanvasDown = (
  instance: InternalInstance,
  container: HTMLDivElement,
  event: PointerEvent
): CanvasDown => {
  const input = instance.read.pick.from(event, container)

  return {
    ...input,
    container,
    event,
    capture: input.element ?? container,
    tool: instance.read.tool.get(),
    mode: instance.interaction.mode.get()
  }
}
