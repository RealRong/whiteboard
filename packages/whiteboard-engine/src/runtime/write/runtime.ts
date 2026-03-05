import type { Write } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import { Writer } from './stages/commit/writer'
import { bus } from './stages/invalidation/changeBus'
import { plan } from './stages/plan/router'
import type { Apply } from './stages/plan/draft'

// Write assembly (single write funnel):
// `commands` may call into write, but write itself owns the only document mutation path:
// `apply -> plan -> commit -> read projection -> change publish`.
export const createWrite = ({
  instance,
  scheduler,
  readModelRevisionAtom,
  project
}: WriteDeps): Write => {
  const changeBus = bus()
  const writer = new Writer({
    instance,
    changeBus,
    readModelRevisionAtom,
    project,
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
