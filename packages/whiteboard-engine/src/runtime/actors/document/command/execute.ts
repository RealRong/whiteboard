import type { ApplyDispatchResult, CommandBatch } from '@engine-types/command'
import { executeMutationPlan, toCoreOrigin, type ReduceContext } from './handlers/helpers'
import { planCommand } from './plan'

export const dispatchCommandBatch = async (
  context: ReduceContext,
  commandBatch: CommandBatch
): Promise<ApplyDispatchResult[]> => {
  const dispatchResults: ApplyDispatchResult[] = []
  const origin = toCoreOrigin(commandBatch.source)

  for (let index = 0; index < commandBatch.commands.length; index += 1) {
    const command = commandBatch.commands[index]
    const plan = planCommand(context, command)
    const result = executeMutationPlan(context, plan, origin)
    if (!result) continue
    dispatchResults.push({
      index,
      type: command.type,
      result
    })
  }

  return dispatchResults
}
