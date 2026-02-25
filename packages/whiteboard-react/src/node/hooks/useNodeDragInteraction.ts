import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { Instance, PointerInput } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'

type UseNodeDragInteractionOptions = {
  nodeId: NodeId
}

type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

type DragDraft = NonNullable<
  ReturnType<
    Instance['domains']['node']['interaction']['drag']['begin']
  >
>

type DragUpdateConstraints = Parameters<
  Instance['domains']['node']['interaction']['drag']['updateDraft']
>[0]['constraints']

type ActiveDrag = {
  pointerId: number
  button: 0 | 1 | 2
  draft: DragDraft
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

const resolveSelectionMode = (
  event: PointerEvent | ReactPointerEvent<HTMLDivElement>
): SelectionMode => {
  if (event.altKey) return 'subtract'
  if (event.metaKey || event.ctrlKey) return 'toggle'
  if (event.shiftKey) return 'add'
  return 'replace'
}

const toDragConstraints = (
  instance: Instance,
  event: PointerEvent | ReactPointerEvent<HTMLDivElement>
): DragUpdateConstraints => ({
  snapEnabled: instance.state.read('tool') === 'select',
  allowCross: event.altKey
})

export const useNodeDragInteraction = ({
  nodeId
}: UseNodeDragInteractionOptions) => {
  const instance = useInstance()
  const [active, setActive] = useState<ActiveDrag | null>(null)
  const activeRef = useRef<ActiveDrag | null>(null)

  const handleNodePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      if (active) return
      if (instance.state.read('tool') !== 'select') return

      const nodeRect = instance.query.canvas.nodeRect(nodeId)
      if (!nodeRect || nodeRect.node.locked) return

      instance.commands.selection.select(
        [nodeId],
        resolveSelectionMode(event)
      )

      const pointer = toPointerInput(instance, event)
      const draft = instance.domains.node.interaction.drag.begin({
        nodeId,
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
    [active, instance, nodeId]
  )

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.node.interaction.drag.updateDraft({
        draft: active.draft,
        pointer: toPointerInput(instance, event, active.button),
        constraints: toDragConstraints(instance, event)
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.node.interaction.drag.commitDraft(active.draft)
      setActive(null)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.node.interaction.drag.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleBlur = () => {
      instance.domains.node.interaction.drag.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      instance.domains.node.interaction.drag.cancelDraft({
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
    instance.domains.node.interaction.drag.cancelDraft({
      draft: activeRef.current.draft
    })
  }, [instance])

  return {
    handleNodePointerDown
  }
}
