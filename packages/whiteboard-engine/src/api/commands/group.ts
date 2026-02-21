import type { Command } from '@engine-types/command'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import type { ApplyCommandChange } from './shared'

export const createGroup = (_instance: Instance, applyChange: ApplyCommandChange): Commands['group'] => {
  const applyGroupChange = (change: Command) => applyChange(change)

  return {
    create: (ids) => applyGroupChange({ type: 'group.create', ids }),
    ungroup: (id) => applyGroupChange({ type: 'group.ungroup', id })
  }
}
