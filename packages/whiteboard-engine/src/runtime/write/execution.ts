import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import { Writer } from './stages/commit/writer'
import { bus } from './stages/invalidation/changeBus'
import { plan } from './stages/plan/router'
import {
  type Apply
} from './stages/plan/draft'

export type WriteExecution = Pick<
  WriteRuntime,
  'apply' | 'history' | 'resetDoc' | 'changeBus'
>

export const createWriteExecution = ({
  instance,
  scheduler,
  readModelRevisionAtom
}: WriteDeps): WriteExecution => {
  const changeBus = bus()
  const writer = new Writer({
    instance,
    changeBus,
    readModelRevisionAtom,
    now: scheduler.now
  })
  const planner = plan({ instance })
  const apply: Apply = (payload) =>
    writer.applyDraft(
      planner(payload),
      payload.source ?? 'ui',
      payload.trace
    )

  return {
    apply,
    history: writer.history,
    resetDoc: writer.resetDoc,
    changeBus
  }
}
