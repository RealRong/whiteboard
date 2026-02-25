import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import type { Instance, PointerInput } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'

type UseNodeTransformInteractionOptions = {
  nodeId: NodeId
}

type TransformDraft = NonNullable<
  ReturnType<
    Instance['domains']['node']['interaction']['transform']['beginResize']
  >
>

type TransformUpdateConstraints = Parameters<
  Instance['domains']['node']['interaction']['transform']['updateDraft']
>[0]['constraints']

type ActiveTransform = {
  pointerId: number
  button: 0 | 1 | 2
  draft: TransformDraft
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

const toTransformConstraints = (
  instance: Instance,
  event: PointerEvent | ReactPointerEvent<HTMLDivElement>
): TransformUpdateConstraints => {
  const activeTool = instance.state.read('tool')
  return {
    resize: {
      keepAspect: event.shiftKey,
      fromCenter: event.altKey,
      snapEnabled: activeTool === 'select' && !event.altKey
    },
    rotate: {
      snapToStep: event.shiftKey
    }
  }
}

export const useNodeTransformInteraction = ({
  nodeId
}: UseNodeTransformInteractionOptions) => {
  const instance = useInstance()
  const [active, setActive] = useState<ActiveTransform | null>(null)
  const activeRef = useRef<ActiveTransform | null>(null)

  const handleTransformPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      handle: TransformHandle
    ) => {
      if (event.button !== 0) return
      if (active) return

      const nodeRect = instance.query.canvas.nodeRect(nodeId)
      if (!nodeRect || nodeRect.node.locked) return

      const pointer = toPointerInput(instance, event)
      let draft: TransformDraft | undefined

      if (handle.kind === 'resize' && handle.direction) {
        draft = instance.domains.node.interaction.transform.beginResize({
          nodeId,
          pointer,
          handle: handle.direction,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation
        })
      }

      if (handle.kind === 'rotate') {
        draft = instance.domains.node.interaction.transform.beginRotate({
          nodeId,
          pointer,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation
        })
      }

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
      instance.domains.node.interaction.transform.updateDraft({
        draft: active.draft,
        pointer: toPointerInput(instance, event, active.button),
        constraints: toTransformConstraints(instance, event)
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.node.interaction.transform.commitDraft(
        active.draft
      )
      setActive(null)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.node.interaction.transform.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleBlur = () => {
      instance.domains.node.interaction.transform.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      instance.domains.node.interaction.transform.cancelDraft({
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
    instance.domains.node.interaction.transform.cancelDraft({
      draft: activeRef.current.draft
    })
  }, [instance])

  return {
    handleTransformPointerDown
  }
}
