import {
  useCallback,
  useEffect,
  useRef,
  type RefObject
} from 'react'
import type {
  EdgeCreateDown,
  EdgeDown
} from '../../../runtime/input/pointer'
import {
  useInternalInstance,
  useStoreValue,
  useTool
} from '../../../runtime/hooks'
import { createRafTask } from '../../../runtime/utils/rafTask'
import { useEdgeConnectInput } from './useEdgeConnectInput'
import { useEdgeDragInput } from './useEdgeDragInput'
import { useEdgeRouteInput } from './useEdgeRouteInput'

export const useEdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const tool = useTool()
  const mode = useStoreValue(instance.interaction.mode)
  const hoverPointRef = useRef<ReturnType<typeof instance.viewport.pointer>['world'] | null>(null)
  const hoverTaskRef = useRef(createRafTask(() => {
    if (!instance.read.tool.is('edge')) {
      instance.internals.edge.preview.hint.clear()
      return
    }

    const activeMode = instance.interaction.mode.get()
    if (activeMode === 'edge-connect') {
      return
    }
    if (activeMode !== 'idle') {
      instance.internals.edge.preview.hint.clear()
      return
    }

    const hoverPoint = hoverPointRef.current
    if (!hoverPoint) {
      instance.internals.edge.preview.hint.clear()
      return
    }

    const target = instance.internals.snap.edge.connect(hoverPoint)
    instance.internals.edge.preview.hint.set(
      target
        ? { snap: target.pointWorld }
        : undefined
    )
  }))
  const connect = useEdgeConnectInput()
  const drag = useEdgeDragInput()
  const route = useEdgeRouteInput()

  const create = useCallback((input: EdgeCreateDown) => (
    connect.create(input)
  ), [connect])

  const down = useCallback((input: EdgeDown) => {
    return (
      drag.down(input)
      || connect.reconnect(input)
      || route.down(input)
    )
  }, [connect, drag, route])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      hoverPointRef.current = instance.viewport.pointer(event).world
      hoverTaskRef.current.schedule()
    }

    const handlePointerLeave = () => {
      hoverTaskRef.current.cancel()
      hoverPointRef.current = null
      if (instance.interaction.mode.get() !== 'edge-connect') {
        instance.internals.edge.preview.hint.clear()
      }
    }

    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)
    return () => {
      hoverTaskRef.current.cancel()
      hoverPointRef.current = null
      if (instance.interaction.mode.get() !== 'edge-connect') {
        instance.internals.edge.preview.hint.clear()
      }
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, instance])

  useEffect(() => {
    if (tool.type !== 'edge') {
      instance.internals.edge.preview.hint.clear()
      return
    }

    if (mode !== 'idle' && mode !== 'edge-connect') {
      instance.internals.edge.preview.hint.clear()
    }
  }, [instance, mode, tool.type])

  return {
    create,
    down,
    keyDown: route.keyDown
  }
}
