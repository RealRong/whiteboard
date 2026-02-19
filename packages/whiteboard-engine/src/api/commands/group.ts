import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import { applyCommandChange } from './apply'

export const createGroup = (instance: Instance): Commands['group'] => ({
  create: (ids) => applyCommandChange(instance, { type: 'group.create', ids }),
  ungroup: (id) => applyCommandChange(instance, { type: 'group.ungroup', id })
})
