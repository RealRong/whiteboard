import { useCallback } from 'react'
import type { Point, Viewport } from '@whiteboard/core'
import { useStore } from 'jotai'
import type { ViewportConfig } from '../../types'
import { useEdgeConnectActions } from '../../../edge/hooks'
import { useSelectionRuntime } from '../../../node/hooks'
import { useInstance } from '../useInstance'
import { useInteractionActions } from '../useInteraction'
import { useViewportInteraction } from './useViewportInteraction'
import { useShortcutHandlers } from '../../shortcuts/useShortcutHandlers'
import { shortcutContextAtom } from '../../state/whiteboardAtoms'

type Options = {
  tool?: 'select' | 'edge'
  viewport: Viewport
  viewportConfig?: ViewportConfig
}

const identityScreenToWorld = (point: Point) => point

export const useCanvasHandlers = ({ tool = 'select', viewport, viewportConfig }: Options) => {
  const instance = useInstance()
  const store = useStore()
  const selectionRuntime = useSelectionRuntime()
  const { selectEdge, updateHover } = useEdgeConnectActions()
  const selectionHandlers = selectionRuntime.handlers
  const { update: updateInteraction } = useInteractionActions()
  const { handlePointerDownCapture: handleShortcutPointerDownCapture, handleKeyDown: handleShortcutKeyDown } =
    useShortcutHandlers({
      shortcutManager: instance.shortcutManager,
      getShortcutContext: () => store.get(shortcutContextAtom),
      updateInteraction
    })
  const screenToWorld = instance.viewport.screenToWorld ?? identityScreenToWorld
  const { viewportHandlers, onWheel } = useViewportInteraction({
    core: instance.core,
    viewport,
    screenToWorld,
    containerRef: instance.containerRef,
    config: viewportConfig
  })
  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      instance.containerRef.current?.focus({ preventScroll: true })
      viewportHandlers.onPointerDown(event)
      selectionHandlers?.onPointerDown(event)
      if (event.target === instance.containerRef.current) {
        selectEdge(undefined)
      }
    },
    [instance.containerRef, selectEdge, selectionHandlers, viewportHandlers]
  )

  const handlePointerDownCapture = useCallback(
    (event: PointerEvent) => {
      handleShortcutPointerDownCapture(event, () => viewportHandlers.onPointerDownCapture(event))
    },
    [handleShortcutPointerDownCapture, viewportHandlers]
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerMove(event)
      selectionHandlers?.onPointerMove(event)
      if (tool === 'edge' && screenToWorld && instance.containerRef.current) {
        const rect = instance.containerRef.current.getBoundingClientRect()
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        updateHover(screenToWorld(point))
      }
    },
    [instance.containerRef, screenToWorld, selectionHandlers, tool, updateHover, viewportHandlers]
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      viewportHandlers.onPointerUp(event)
      selectionHandlers?.onPointerUp(event)
    },
    [selectionHandlers, viewportHandlers]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      handleShortcutKeyDown(event)
    },
    [handleShortcutKeyDown]
  )

  return {
    handlers: {
      handlePointerDown,
      handlePointerDownCapture,
      handlePointerMove,
      handlePointerUp,
      handleKeyDown
    },
    onWheel
  }
}
