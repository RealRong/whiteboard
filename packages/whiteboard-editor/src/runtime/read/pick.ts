import {
  isContextMenuIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget
} from '../input/target'
import type { Pick as CanvasPick, PickRuntime, PointerPick } from '../pick'
import type { ViewportRead } from '../viewport'

type PointerPickInput = {
  target: EventTarget | null
  clientX: number
  clientY: number
}

export type PickRead = {
  from: (
    input: PointerPickInput,
    within: Element
  ) => PointerPick
}

const BackgroundPick: CanvasPick = {
  kind: 'background'
}

export const createPickRead = ({
  registry,
  viewport
}: {
  registry: PickRuntime
  viewport: ViewportRead
}): PickRead => ({
  from: (input, within) => {
    const element =
      input.target instanceof Element
      && within.contains(input.target)
        ? input.target
        : null
    const pointer = viewport.pointer(input)

    return {
      pick: registry.element(element, within) ?? BackgroundPick,
      point: {
        client: {
          x: input.clientX,
          y: input.clientY
        },
        screen: pointer.screen,
        world: pointer.world
      },
      element,
      field: readEditableFieldTarget(element),
      editable: isEditableTarget(element),
      ignoreInput: isInputIgnoredTarget(element),
      ignoreSelection: isSelectionIgnoredTarget(element),
      ignoreContextMenu: isContextMenuIgnoredTarget(element)
    }
  }
})
