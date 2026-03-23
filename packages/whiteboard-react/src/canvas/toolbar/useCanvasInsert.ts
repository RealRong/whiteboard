import { isPointInRect } from '@whiteboard/core/geometry'
import { useCallback } from 'react'
import { useInternalInstance } from '../../runtime/hooks'
import { leave } from '../../runtime/container'
import {
  getInsertPreset,
  runInsertPreset
} from './presets'

export const useCanvasInsert = () => {
  const instance = useInternalInstance()

  const handleCanvasPointerDown = useCallback((
    container: HTMLDivElement,
    event: PointerEvent
  ) => {
    if (event.defaultPrevented) return false
    if (event.button !== 0) return false
    if (instance.interaction.mode.get() !== 'idle') return false

    if (!instance.read.tool.is('insert')) return false
    const presetKey = instance.read.tool.preset()
    if (!presetKey) return false

    const preset = getInsertPreset(presetKey)
    if (!preset) {
      return false
    }

    const input = instance.read.pick.from(event, container)
    let activeContainer = instance.state.container.get()
    if (activeContainer.id) {
      const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
      const insideActiveContainer = Boolean(
        activeRect && isPointInRect(input.point.world, activeRect)
      )

      if (!insideActiveContainer) {
        leave(instance)
        activeContainer = instance.state.container.get()
      }
    }

    if (input.editable || input.ignoreInput || input.ignoreSelection) {
      return false
    }

    const canInsert =
      input.pick.kind === 'background'
      || (
        input.pick.kind === 'node'
        && input.pick.part === 'container'
        && input.pick.id === activeContainer.id
      )
    if (!canInsert) {
      return false
    }

    const result = runInsertPreset({
      instance,
      preset,
      world: input.point.world,
      parentId: activeContainer.id
    })
    if (!result) {
      return false
    }

    instance.commands.tool.select()

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [instance])

  return {
    handleCanvasPointerDown
  }
}
