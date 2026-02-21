import type { Command } from '@engine-types/command'
import { resetDocPlan } from './helpers'

type DocCommand = Extract<Command, { type: 'doc.reset' }>

export const planDocCommand = (
  command: DocCommand
) => resetDocPlan(command.doc)
