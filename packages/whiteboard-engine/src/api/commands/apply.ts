import type { Change, ChangeSource } from '@engine-types/change'
import type { Instance } from '@engine-types/instance/instance'
import type { DispatchResult } from '@whiteboard/core'

export const applyCommandChange = async (
  instance: Instance,
  change: Change,
  source: ChangeSource = 'command'
): Promise<DispatchResult> => {
  const applied = await instance.apply([change], { source })
  const result = applied.dispatchResults[0]?.result
  if (!result) {
    throw new Error(`Change did not produce dispatch result: ${change.type}`)
  }
  return result
}
