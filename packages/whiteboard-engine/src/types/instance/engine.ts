import type { CoreRegistries, Document, Viewport } from '@whiteboard/core/types'
import type { Commands } from '../command/api'
import type { InstanceConfig } from './config'
import type { EngineRead } from './read'
import type { Api } from './runtime'

export type Instance = {
  runtime: Api
  read: EngineRead
  commands: Commands
}

export type EngineContext = {
  document: {
    get: () => Document
    commit: (doc: Document) => void
  }
  config: InstanceConfig
  viewport: {
    get: () => Viewport
  }
  registries: CoreRegistries
  read: EngineRead
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  /**
   * Engine treats document input as immutable data.
   * Replacing or loading with the same document reference is unsupported.
   */
  document: Document
  onDocumentChange?: (doc: Document) => void
  config?: Partial<InstanceConfig>
}
