import { isPointInRect } from '@whiteboard/core/geometry'
import { useCallback } from 'react'
import type { CanvasDown } from '../../runtime/input/down'
import { useInternalInstance } from '../../runtime/hooks'
import {
  getInsertPreset
} from './presets'
import { insertPreset } from './insert'

export const useInsertDown = () => {
  const instance = useInternalInstance()

  const down = useCallback((
    input: CanvasDown
  ) => {
    const { event } = input

    if (event.defaultPrevented) return false
    if (event.button !== 0) return false
    if (input.mode !== 'idle') return false

    if (input.tool.type !== 'insert') return false
    const presetKey = input.tool.preset
    if (!presetKey) return false

    const preset = getInsertPreset(presetKey)
    if (!preset) {
      return false
    }

    let activeContainer = instance.state.container.get()
    if (activeContainer.id) {
      const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
      const insideActiveContainer = Boolean(
        activeRect && isPointInRect(input.point.world, activeRect)
      )

      if (!insideActiveContainer) {
        instance.commands.container.exit()
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

    const result = insertPreset({
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
    down
  }
}
