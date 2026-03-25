import { isPointInRect } from '@whiteboard/core/geometry'
import { isContainerNode } from '@whiteboard/core/node'
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

    let activeFrame = instance.state.frame.get()
    if (activeFrame.id) {
      const activeRect = instance.read.index.node.get(activeFrame.id)?.rect
      const insideActiveFrame = Boolean(
        activeRect && isPointInRect(input.point.world, activeRect)
      )

      if (!insideActiveFrame) {
        instance.commands.frame.exit()
        activeFrame = instance.state.frame.get()
      }
    }

    if (input.editable || input.ignoreInput || input.ignoreSelection) {
      return false
    }

    const frameTargetId =
      input.pick.kind === 'node'
      && input.pick.part === 'container'
      && isContainerNode(instance.read.node.item.get(input.pick.id)?.node ?? { type: '' })
        ? input.pick.id
        : undefined
    const canInsert =
      input.pick.kind === 'background'
      || frameTargetId !== undefined
    if (!canInsert) {
      return false
    }

    const result = insertPreset({
      instance,
      preset,
      world: input.point.world,
      containerId: activeFrame.id ?? frameTargetId
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
