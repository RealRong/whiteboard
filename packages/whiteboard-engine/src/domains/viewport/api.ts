import type { Commands } from '@engine-types/commands'
import type { ViewportDomainApi } from '@engine-types/domains'
import type { Query } from '@engine-types/instance/query'
import type { View } from '@engine-types/instance/view'

type Options = {
  commands: Pick<Commands, 'viewport'>
  query: Query
  view: View
}

export const createViewportDomainApi = ({
  commands,
  query,
  view
}: Options): ViewportDomainApi => ({
  commands: commands.viewport,
  query: query.viewport,
  view: {
    get: () => view.getState().viewport,
    subscribe: view.subscribe
  }
})
