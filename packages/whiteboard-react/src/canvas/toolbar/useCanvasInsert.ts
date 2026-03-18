import { useEffect, type RefObject } from 'react'
import type { Rect } from '@whiteboard/core/types'
import { useInternalInstance } from '../../runtime/hooks'
import { leave } from '../../runtime/container'
import { isBackgroundPointerTarget } from '../target'
import { getInsertPreset } from './presets'

const isPointInRect = (
  point: { x: number; y: number },
  rect: Rect
) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const useCanvasInsert = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (instance.interaction.mode.get() !== 'idle') return

      if (!instance.read.tool.is('insert')) return
      const presetKey = instance.read.tool.preset()
      if (!presetKey) return

      const preset = getInsertPreset(presetKey)
      if (!preset) {
        return
      }

      const pointer = instance.viewport.pointer(event)
      let activeContainer = instance.state.container.get()
      if (activeContainer.id) {
        const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
        const insideActiveContainer = Boolean(
          activeRect && isPointInRect(pointer.world, activeRect)
        )

        if (!insideActiveContainer) {
          leave(instance)
          activeContainer = instance.state.container.get()
        }
      }

      if (!isBackgroundPointerTarget({
        target: event.target,
        currentTarget: container,
        activeContainerId: activeContainer.id
      })) {
        return
      }

      const result = preset.create({
        instance,
        world: pointer.world,
        parentId: preset.canNest === false ? undefined : activeContainer.id
      })
      if (!result) {
        return
      }

      instance.commands.selection.replace([result.nodeId])
      if (result.edit) {
        instance.commands.edit.start(result.edit.nodeId, result.edit.field)
      }
      instance.commands.tool.select()

      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [containerRef, instance])
}
