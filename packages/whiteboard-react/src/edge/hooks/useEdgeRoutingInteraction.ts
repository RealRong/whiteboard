import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '@whiteboard/core/types'
import type { Instance, PointerInput } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'

type RoutingDraft = NonNullable<
  ReturnType<
    Instance['domains']['edge']['interaction']['routing']['begin']
  >
>

type RoutingEdgeId = Parameters<
  Instance['domains']['edge']['interaction']['routing']['begin']
>[0]['edgeId']

type ActiveRouting = {
  pointerId: number
  button: 0 | 1 | 2
  draft: RoutingDraft
}

const normalizeButton = (button: number): 0 | 1 | 2 => {
  if (button === 1 || button === 2) return button
  return 0
}

const toPointerInput = (
  instance: Instance,
  event: PointerEvent | ReactPointerEvent<HTMLDivElement>,
  fallbackButton?: 0 | 1 | 2
): PointerInput => {
  const button = fallbackButton ?? normalizeButton(event.button)
  const client: Point = {
    x: event.clientX,
    y: event.clientY
  }
  const screen = instance.query.viewport.clientToScreen(
    event.clientX,
    event.clientY
  )
  return {
    pointerId: event.pointerId,
    button,
    client,
    screen,
    world: instance.query.viewport.screenToWorld(screen),
    modifiers: {
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}

export const useEdgeRoutingInteraction = () => {
  const instance = useInstance()
  const [active, setActive] = useState<ActiveRouting | null>(null)
  const activeRef = useRef<ActiveRouting | null>(null)

  const handleRoutingPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      edgeId: RoutingEdgeId,
      index: number
    ) => {
      if (event.button !== 0) return
      if (active) return

      if (event.detail >= 2) {
        instance.domains.edge.interaction.routing.removeRoutingPointAt(
          edgeId,
          index
        )
        event.preventDefault()
        event.stopPropagation()
        return
      }

      const pointer = toPointerInput(instance, event)
      const draft = instance.domains.edge.interaction.routing.begin({
        edgeId,
        index,
        pointer
      })
      if (!draft) return

      setActive({
        pointerId: event.pointerId,
        button: pointer.button,
        draft
      })
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore capture errors, window listeners still handle lifecycle.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [active, instance]
  )

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.routing.updateDraft({
        draft: active.draft,
        pointer: toPointerInput(instance, event, active.button)
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.routing.commitDraft(
        active.draft
      )
      setActive(null)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.routing.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleBlur = () => {
      instance.domains.edge.interaction.routing.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      instance.domains.edge.interaction.routing.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, instance])

  useEffect(() => () => {
    if (!activeRef.current) return
    instance.domains.edge.interaction.routing.cancelDraft({
      draft: activeRef.current.draft
    })
  }, [instance])

  return {
    handleRoutingPointerDown
  }
}
