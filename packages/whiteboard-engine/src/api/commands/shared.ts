import type { Command } from '@engine-types/command'
import type { DispatchResult } from '@whiteboard/core'

export type ApplyCommandChange = (change: Command) => Promise<DispatchResult>
