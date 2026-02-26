import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent
} from 'react'
import {
  isSameViewport,
  panViewport,
  viewportScreenToWorld,
  zoomViewport
} from '@whiteboard/core/geometry'
import type { Viewport } from '@whiteboard/core/types'
import type { Instance } from '@whiteboard/engine'
import { sessionLockStore, type SessionLockToken } from './sessionLockStore'
import { useWindowPointerSession } from './useWindowPointerSession'
import { viewportGestureStore } from './viewportGestureStore'

type ViewportPanState = {
  pointerId: number
  lastX: number
  lastY: number
  viewport: Viewport
  captureTarget: HTMLDivElement | null
}

export type ViewportPolicy = {
  panEnabled: boolean
  wheelEnabled: boolean
  minZoom: number
  maxZoom: number
  wheelSensitivity: number
}

type UseViewportGestureInteractionOptions = {
  instance: Instance
  viewportPolicy: ViewportPolicy
  getContainer: () => HTMLDivElement | null
}

const WHEEL_SETTLE_MS = 96

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const isTextInputElement = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('textarea,select,[contenteditable]:not([contenteditable="false"])')) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) return false
  const type = (target.type || 'text').toLowerCase()
  return (
    type === 'text'
    || type === 'search'
    || type === 'email'
    || type === 'url'
    || type === 'tel'
    || type === 'password'
    || type === 'number'
    || type === 'date'
    || type === 'datetime-local'
    || type === 'month'
    || type === 'time'
    || type === 'week'
  )
}

export const useViewportGestureInteraction = ({
  instance,
  viewportPolicy,
  getContainer
}: UseViewportGestureInteractionOptions) => {
  const panRef = useRef<ViewportPanState | null>(null)
  const lockTokenRef = useRef<SessionLockToken | null>(null)
  const wheelCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingWheelViewportRef = useRef<Viewport | null>(null)
  const [activePointerId, setActivePointerId] = useState<number | null>(null)

  const readCommittedViewport = useCallback(
    () => instance.query.viewport.get(),
    [instance.query.viewport]
  )

  const readGestureViewport = useCallback(
    () => viewportGestureStore.getSnapshot().preview ?? readCommittedViewport(),
    [readCommittedViewport]
  )

  const clearWheelCommit = useCallback(() => {
    pendingWheelViewportRef.current = null
    if (wheelCommitTimerRef.current === null) return
    clearTimeout(wheelCommitTimerRef.current)
    wheelCommitTimerRef.current = null
  }, [])

  const commitViewport = useCallback(
    (viewport: Viewport) => {
      const committed = readCommittedViewport()
      if (isSameViewport(committed, viewport)) {
        viewportGestureStore.clearPreview()
        return
      }
      const target = copyViewport(viewport)
      void instance.commands.viewport
        .set(target)
        .finally(() => {
          const preview = viewportGestureStore.getSnapshot().preview
          if (!preview || isSameViewport(preview, target)) {
            viewportGestureStore.clearPreview()
          }
        })
    },
    [instance.commands.viewport, readCommittedViewport]
  )

  const scheduleWheelCommit = useCallback(
    (viewport: Viewport) => {
      clearWheelCommit()
      pendingWheelViewportRef.current = copyViewport(viewport)
      wheelCommitTimerRef.current = setTimeout(() => {
        wheelCommitTimerRef.current = null
        const pending = pendingWheelViewportRef.current
        pendingWheelViewportRef.current = null
        if (!pending) return
        commitViewport(pending)
      }, WHEEL_SETTLE_MS)
    },
    [clearWheelCommit, commitViewport]
  )

  const releaseSessionLock = useCallback((pointerId?: number) => {
    const lockToken = lockTokenRef.current
    if (!lockToken) return
    if (
      pointerId !== undefined
      && lockToken.pointerId !== undefined
      && lockToken.pointerId !== pointerId
    ) {
      return
    }
    sessionLockStore.release(lockToken)
    lockTokenRef.current = null
  }, [])

  const resetViewportPan = useCallback((pointerId?: number) => {
    const pan = panRef.current
    if (!pan) {
      releaseSessionLock(pointerId)
      return
    }
    if (pointerId !== undefined && pan.pointerId !== pointerId) return
    panRef.current = null
    setActivePointerId(null)
    const captureTarget = pan.captureTarget ?? getContainer()
    if (captureTarget) {
      try {
        captureTarget.releasePointerCapture(pan.pointerId)
      } catch {
        // Ignore pointer release failures when capture is already cleared.
      }
    }
    releaseSessionLock(pan.pointerId)
  }, [getContainer, releaseSessionLock])

  const reset = useCallback(() => {
    clearWheelCommit()
    viewportGestureStore.clearPreview()
    resetViewportPan()
    releaseSessionLock()
  }, [clearWheelCommit, releaseSessionLock, resetViewportPan])

  const canStartViewportPan = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!viewportPolicy.panEnabled) return false
      const middleDrag = event.button === 1 || (event.buttons & 4) === 4
      const leftDrag =
        (event.button === 0 || (event.buttons & 1) === 1)
        && viewportGestureStore.isSpacePressed()
      return middleDrag || leftDrag
    },
    [viewportPolicy.panEnabled]
  )

  const handleViewportPointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!canStartViewportPan(event)) return
      const lockToken = sessionLockStore.tryAcquire(
        'viewportGesture',
        event.pointerId
      )
      if (!lockToken) return
      lockTokenRef.current = lockToken
      clearWheelCommit()
      const viewport = readGestureViewport()
      panRef.current = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        viewport,
        captureTarget: event.currentTarget
      }
      setActivePointerId(event.pointerId)
      viewportGestureStore.setPreview(viewport)
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Ignore pointer capture failures when pointer is no longer active.
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [canStartViewportPan, clearWheelCommit, readGestureViewport]
  )

  const handleViewportWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!viewportPolicy.wheelEnabled) return
      const viewport = readGestureViewport()
      const zoom = viewport.zoom
      if (!Number.isFinite(zoom) || zoom <= 0) return
      const factor = Math.exp(-event.deltaY * viewportPolicy.wheelSensitivity)
      const nextZoom = clamp(
        zoom * factor,
        viewportPolicy.minZoom,
        viewportPolicy.maxZoom
      )
      const appliedFactor = nextZoom / zoom
      if (appliedFactor === 1) return
      const anchorScreen = instance.query.viewport.clientToScreen(
        event.clientX,
        event.clientY
      )
      const anchor = viewportScreenToWorld(
        anchorScreen,
        viewport,
        instance.query.viewport.getScreenCenter()
      )
      const nextViewport = zoomViewport(viewport, appliedFactor, anchor)
      viewportGestureStore.setPreview(nextViewport)
      scheduleWheelCommit(nextViewport)
      event.preventDefault()
      event.stopPropagation()
    },
    [
      instance.query.viewport,
      readGestureViewport,
      scheduleWheelCommit,
      viewportPolicy.maxZoom,
      viewportPolicy.minZoom,
      viewportPolicy.wheelEnabled,
      viewportPolicy.wheelSensitivity
    ]
  )

  useWindowPointerSession({
    pointerId: activePointerId,
    onPointerMove: (event) => {
      const pan = panRef.current
      if (!pan || event.pointerId !== pan.pointerId) return
      const zoom = pan.viewport.zoom
      if (!Number.isFinite(zoom) || zoom <= 0) return
      const deltaX = event.clientX - pan.lastX
      const deltaY = event.clientY - pan.lastY
      if (deltaX === 0 && deltaY === 0) return
      pan.lastX = event.clientX
      pan.lastY = event.clientY
      pan.viewport = panViewport(pan.viewport, {
        x: -deltaX / zoom,
        y: -deltaY / zoom
      })
      viewportGestureStore.setPreview(pan.viewport)
      event.preventDefault()
    },
    onPointerUp: (event) => {
      const pan = panRef.current
      if (!pan || event.pointerId !== pan.pointerId) return
      const target = pan.viewport
      resetViewportPan(pan.pointerId)
      commitViewport(target)
      event.preventDefault()
    },
    onPointerCancel: (event) => {
      const pan = panRef.current
      if (!pan || event.pointerId !== pan.pointerId) return
      resetViewportPan(pan.pointerId)
      viewportGestureStore.clearPreview()
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handleBlur = () => {
      viewportGestureStore.setSpacePressed(false)
      reset()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isTextInputElement(event.target)) return
      viewportGestureStore.setSpacePressed(true)
      event.preventDefault()
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      viewportGestureStore.setSpacePressed(false)
      if (!isTextInputElement(event.target)) {
        event.preventDefault()
      }
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [reset])

  useEffect(
    () => () => {
      viewportGestureStore.setSpacePressed(false)
      reset()
    },
    [reset]
  )

  return {
    handleViewportPointerDownCapture,
    handleViewportWheel
  }
}
