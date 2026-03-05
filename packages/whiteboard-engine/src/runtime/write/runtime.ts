import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import { createWriteExecution } from './execution'
import { createWriteCommands } from './commands'

// Write runtime composition (single write funnel):
// 1) `execution` owns planner + writer + changeBus + history.
// 2) `commands` exposes semantic APIs and always dispatches to `execution.apply`.
// 3) External entry remains `instance.commands.*` -> `writeRuntime.apply`.
// 4) Any system reaction write also re-enters the same `apply` path.
// 5) No secondary write path is allowed outside this assembly.
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
