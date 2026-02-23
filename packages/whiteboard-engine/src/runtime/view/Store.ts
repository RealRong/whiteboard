import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionChange, ProjectionStore } from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import { createViewRegistry } from './Registry'

type StoreOptions = {
  state: State
  projection: ProjectionStore
  query: Query
  config: InstanceConfig
}

export class ViewStore {
  readonly view: View

  private readonly applyProjectionRuntime: (change: ProjectionChange) => void

  constructor({
    state,
    projection,
    query,
    config
  }: StoreOptions) {
    const runtime = createViewRegistry({
      state,
      projection,
      query,
      config
    })
    this.view = runtime.view
    this.applyProjectionRuntime = runtime.applyProjection
  }

  apply = (change: ProjectionChange | undefined) => {
    if (!change) return
    this.applyProjectionRuntime(change)
  }
}
