import type { InternalInstance } from '@engine-types/instance/engine'
import type { DocumentId } from '@whiteboard/core/types'
import type { Shortcuts } from '@engine-types/shortcuts/manager'
import type { Commands } from '@engine-types/command/api'
import type { Scheduler } from '../../runtime/Scheduler'
import type { Reactions } from '../reactions/Reactions'
import type { ViewportRuntime } from '../../runtime/Viewport'

type RuntimePortDeps = {
  state: InternalInstance['state']
  viewport: ViewportRuntime
  history: Commands['history']
  shortcuts: Shortcuts
  reactions: Pick<Reactions, 'dispose'>
  scheduler: Scheduler
}

export const createRuntimePort = ({
  state,
  viewport,
  history,
  shortcuts,
  reactions,
  scheduler
}: RuntimePortDeps): Pick<InternalInstance['runtime'], 'applyConfig' | 'dispose'> => {
  let previousHistoryDocId: DocumentId | undefined

  const applyConfig: InternalInstance['runtime']['applyConfig'] = (nextConfig) => {
    if (nextConfig.history) {
      history.configure(nextConfig.history)
    }
    if (!nextConfig.docId) {
      previousHistoryDocId = undefined
    } else {
      if (previousHistoryDocId && previousHistoryDocId !== nextConfig.docId) {
        history.clear()
      }
      previousHistoryDocId = nextConfig.docId
    }
    state.write('tool', nextConfig.tool)
    viewport.setViewport(nextConfig.viewport)
    shortcuts.setShortcuts(nextConfig.shortcuts)
    state.write('mindmapLayout', nextConfig.mindmapLayout ?? {})
  }

  const dispose: InternalInstance['runtime']['dispose'] = () => {
    previousHistoryDocId = undefined
    reactions.dispose()
    shortcuts.dispose()
    scheduler.cancelAll()
  }

  return {
    applyConfig,
    dispose
  }
}
