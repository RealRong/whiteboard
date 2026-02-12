import { useEffect, useMemo, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { NodeId, Viewport } from '@whiteboard/core'
import type { Shortcut } from 'types/shortcuts'
import type { WhiteboardInstance } from 'types/instance'
import { useShortcutRegistry } from '../shortcuts/lifecycle/useShortcutRegistry'
import { useSelectionState } from '../../node/hooks'
import { useInstance } from '../hooks/useInstance'
import { useCanvasHandlers } from '../hooks/internal/useCanvasHandlers'
import type { ViewportConfig } from 'types/common'
import { useNodeLifecycle } from '../../node/lifecycle'
import { useEdgeLifecycle } from '../../edge/lifecycle'

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

type Options = {
  viewport?: Viewport
  shortcutsProp?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  tool: string
  viewportConfig?: ViewportConfig
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

type CanvasHandlers = {
  handlePointerDown: (event: PointerEvent) => void
  handlePointerDownCapture: (event: PointerEvent) => void
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handleKeyDown: (event: KeyboardEvent) => void
}

const bindCanvasContainerEvents = ({
  events,
  handlersRef,
  onWheelRef
}: {
  events: WhiteboardInstance['runtime']['events']
  handlersRef: MutableRefObject<CanvasHandlers>
  onWheelRef: MutableRefObject<(event: WheelEvent) => void>
}) => {
  const offPointerDownCapture = events.onContainer(
    'pointerdown',
    (event) => handlersRef.current.handlePointerDownCapture(event),
    true
  )
  const offPointerDown = events.onContainer('pointerdown', (event) => handlersRef.current.handlePointerDown(event))
  const offPointerMove = events.onContainer('pointermove', (event) => handlersRef.current.handlePointerMove(event))
  const offPointerUp = events.onContainer('pointerup', (event) => handlersRef.current.handlePointerUp(event))
  const offWheel = events.onContainer('wheel', (event) => onWheelRef.current(event), {
    passive: false
  })
  const offKeyDown = events.onContainer('keydown', (event) => handlersRef.current.handleKeyDown(event))

  return () => {
    offPointerDownCapture()
    offPointerDown()
    offPointerMove()
    offPointerUp()
    offWheel()
    offKeyDown()
  }
}

export const useWhiteboardLifecycle = ({
  viewport,
  shortcutsProp,
  tool,
  viewportConfig,
  onSelectionChange,
  onEdgeSelectionChange
}: Options) => {
  const instance = useInstance()
  const selectionState = useSelectionState()
  const { runtime, commands } = instance
  const { core, docRef, containerRef, shortcuts } = runtime
  const { handlers, onWheel } = useCanvasHandlers({
    tool: (tool as 'select' | 'edge') ?? 'select',
    viewportConfig
  })
  const handlersRef = useRef(handlers)
  const onWheelRef = useRef(onWheel)
  const selectionIds = useMemo(() => Array.from(selectionState.selectedNodeIds), [selectionState.selectedNodeIds])
  const resolvedViewport = useMemo<Viewport>(
    () => ({
      center: {
        x: viewport?.center?.x ?? DEFAULT_VIEWPORT.center.x,
        y: viewport?.center?.y ?? DEFAULT_VIEWPORT.center.y
      },
      zoom: viewport?.zoom ?? DEFAULT_VIEWPORT.zoom
    }),
    [viewport?.center?.x, viewport?.center?.y, viewport?.zoom]
  )

  useNodeLifecycle()
  useEdgeLifecycle()
  useShortcutRegistry({
    core,
    docRef,
    shortcutsProp,
    shortcutManager: shortcuts
  })

  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    onWheelRef.current = onWheel
  }, [onWheel])

  useEffect(() => {
    runtime.viewport.setViewport(resolvedViewport)
  }, [resolvedViewport, runtime.viewport])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    runtime.services.containerSizeObserver.observe(element, runtime.viewport.setContainerRect)
    return () => {
      runtime.services.containerSizeObserver.unobserve(element)
    }
  }, [containerRef, runtime.services.containerSizeObserver, runtime.viewport])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        commands.keyboard.setSpacePressed(true)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        commands.keyboard.setSpacePressed(false)
      }
    }

    const offKeyDown = runtime.events.onWindow('keydown', onKeyDown)
    const offKeyUp = runtime.events.onWindow('keyup', onKeyUp)

    return () => {
      offKeyDown()
      offKeyUp()
    }
  }, [commands.keyboard, runtime.events])

  useEffect(() => {
    if (!containerRef.current) return

    return bindCanvasContainerEvents({
      events: runtime.events,
      handlersRef,
      onWheelRef
    })
  }, [containerRef, runtime.events])

  useEffect(() => {
    commands.tool.set(tool)
  }, [commands.tool, tool])

  useEffect(() => {
    onSelectionChange?.(selectionIds)
  }, [onSelectionChange, selectionIds])

  useEffect(() => {
    onEdgeSelectionChange?.(selectionState.selectedEdgeId)
  }, [onEdgeSelectionChange, selectionState.selectedEdgeId])

  useEffect(() => {
    return () => {
      commands.transient.reset()
    }
  }, [commands.transient])

  useEffect(() => {
    return () => {
      runtime.services.nodeSizeObserver.dispose()
      runtime.services.containerSizeObserver.dispose()
    }
  }, [runtime.services.containerSizeObserver, runtime.services.nodeSizeObserver])
}
