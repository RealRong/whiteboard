import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import { createWriteExecution } from './execution'
import { createWriteCommands } from './commands'

export const runtime = ({
  instance,
  scheduler,
  readModelRevisionAtom
}: WriteDeps): WriteRuntime => {
  const execution = createWriteExecution({
    instance,
    scheduler,
    readModelRevisionAtom
  })
  const commands = createWriteCommands({
    instance,
    apply: execution.apply,
    history: execution.history
  })

  return {
    apply: execution.apply,
    history: execution.history,
    resetDoc: execution.resetDoc,
    changeBus: execution.changeBus,
    commands
  }
}
