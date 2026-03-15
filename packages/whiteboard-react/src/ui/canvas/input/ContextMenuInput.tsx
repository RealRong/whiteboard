import { useEffect, useRef, type RefObject } from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import { useInteractionView } from '../../../runtime/view/interaction'

const isContextMenuIgnored = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-context-menu-ignore]'))

const SHOULD_IGNORE_DUPLICATE_MS = 300
const DUPLICATE_DISTANCE = 4

const isDuplicateOpen = (
  prev: { x: number; y: number; time: number } | null,
  next: { x: number; y: number; time: number }
) => {
  if (!prev) return false
  if (next.time - prev.time > SHOULD_IGNORE_DUPLICATE_MS) return false
  return (
    Math.abs(prev.x - next.x) <= DUPLICATE_DISTANCE
    && Math.abs(prev.y - next.y) <= DUPLICATE_DISTANCE
  )
}

export const CanvasContextMenuInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const interaction = useInteractionView()
  const lastOpenRef = useRef<{ x: number; y: number; time: number } | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const openFromEvent = (
      event: Pick<MouseEvent | PointerEvent, 'clientX' | 'clientY'>,
      targetElement: Element | null
    ) => {
      const pointer = instance.viewport.pointer(event)
      const result = instance.read.contextMenu.openResult({
        targetElement,
        screen: pointer.screen,
        world: pointer.world
      })
      if (!result) return

      lastOpenRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      }

      if (result.leaveScope) {
        instance.commands.selection.clear()
        instance.commands.container.exit()
      }

      instance.commands.surface.openContextMenu(result.payload)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 2) return
      if (!interaction.canOpenContextMenu) return
      if (isContextMenuIgnored(event.target)) return
      const targetElement = event.target instanceof Element ? event.target : null
      event.preventDefault()
      event.stopPropagation()
      openFromEvent(event, targetElement)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (!interaction.canOpenContextMenu) return
      if (isContextMenuIgnored(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      if (isDuplicateOpen(lastOpenRef.current, {
        x: event.clientX,
        y: event.clientY,
        time: Date.now()
      })) {
        return
      }
      const targetElement = event.target instanceof Element ? event.target : null
      openFromEvent(event, targetElement)
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('contextmenu', onContextMenu)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('contextmenu', onContextMenu)
    }
  }, [containerRef, instance, interaction.canOpenContextMenu])

  return null
}
