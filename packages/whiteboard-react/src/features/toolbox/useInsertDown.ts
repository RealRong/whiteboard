import { useCallback } from 'react'
import { useInternalInstance } from '../../runtime/hooks'
import type { InsertDown } from '../../runtime/input/pointer'

export const useInsertDown = () => {
  const instance = useInternalInstance()

  const down = useCallback((
    input: InsertDown
  ) => {
    const presetKey = input.tool.preset
    if (!presetKey) return false

    if (input.pick.kind !== 'background') {
      return false
    }

    const frameTargetId = input.frame.id ?? instance.read.node.frameAt(input.point.world)

    const result = instance.commands.insert.preset(presetKey, {
      at: input.point.world,
      ownerId: input.frame.id ?? frameTargetId
    })
    if (!result) {
      return false
    }

    instance.commands.tool.select()

    input.event.preventDefault()
    input.event.stopPropagation()
    return true
  }, [instance])

  return {
    down
  }
}
