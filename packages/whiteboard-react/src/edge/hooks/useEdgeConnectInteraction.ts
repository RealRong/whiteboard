import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { Instance, PointerInput } from '@whiteboard/engine'
import { useInstance } from '../../common/hooks'

type ConnectDraft = NonNullable<
  ReturnType<
    Instance['domains']['edge']['interaction']['connect']['beginFromNode']
  >
>

type ConnectHandleSide = Parameters<
  Instance['domains']['edge']['interaction']['connect']['beginFromHandle']
>[0]['side']

type ActiveConnect = {
  pointerId: number
  button: 0 | 1 | 2
  draft: ConnectDraft
}

const normalizeButton = (button: number): 0 | 1 | 2 => {
  if (button === 1 || button === 2) return button
  return 0
}

const toPointerInput = (
  instance: Instance,
  event: PointerEvent | ReactPointerEvent<HTMLElement>,
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

export const useEdgeConnectInteraction = () => {
  const instance = useInstance()
  const [active, setActive] = useState<ActiveConnect | null>(null)
  const activeRef = useRef<ActiveConnect | null>(null)

  const startDraft = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      begin: (pointer: PointerInput) => ConnectDraft | undefined
    ) => {
      if (event.button !== 0) return false
      if (active) return false

      const pointer = toPointerInput(instance, event)
      const draft = begin(pointer)
      if (!draft) return false

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
      return true
    },
    [active, instance]
  )

  const handleNodeConnectPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      nodeId: NodeId
    ) => {
      if (instance.state.read('tool') !== 'edge') return false
      return startDraft(
        event,
        (pointer) => instance.domains.edge.interaction.connect.beginFromNode({
          nodeId,
          pointer
        })
      )
    },
    [instance, startDraft]
  )

  const handleConnectHandlePointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      nodeId: NodeId,
      side: ConnectHandleSide
    ) => startDraft(
      event,
      (pointer) => instance.domains.edge.interaction.connect.beginFromHandle({
        nodeId,
        side,
        pointer
      })
    ),
    [instance, startDraft]
  )

  const handleReconnectPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      edgeId: EdgeId,
      end: 'source' | 'target'
    ) => startDraft(
      event,
      (pointer) => instance.domains.edge.interaction.connect.beginReconnect({
        edgeId,
        end,
        pointer
      })
    ),
    [instance, startDraft]
  )

  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.connect.updateDraft({
        draft: active.draft,
        pointer: toPointerInput(instance, event, active.button)
      })
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.connect.updateDraft({
        draft: active.draft,
        pointer: toPointerInput(instance, event, active.button)
      })
      instance.domains.edge.interaction.connect.commitDraft(
        active.draft
      )
      setActive(null)
    }

    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== active.pointerId) return
      instance.domains.edge.interaction.connect.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleBlur = () => {
      instance.domains.edge.interaction.connect.cancelDraft({
        draft: active.draft
      })
      setActive(null)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      instance.domains.edge.interaction.connect.cancelDraft({
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
    instance.domains.edge.interaction.connect.cancelDraft({
      draft: activeRef.current.draft
    })
  }, [instance])

  return {
    handleNodeConnectPointerDown,
    handleConnectHandlePointerDown,
    handleReconnectPointerDown
  }
}
