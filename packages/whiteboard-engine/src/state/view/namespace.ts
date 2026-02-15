import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace,
  WhiteboardViewNamespace
} from '@engine-types/instance'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { createWhiteboardViewRegistry } from '../../state/view'

type CreateWhiteboardViewNamespaceOptions = {
  state: WhiteboardStateNamespace
  query: WhiteboardInstanceQuery
  config: WhiteboardInstanceConfig
  platform: ShortcutContext['platform']
}

export const createWhiteboardViewNamespace = ({
  state,
  query,
  config,
  platform
}: CreateWhiteboardViewNamespaceOptions): WhiteboardViewNamespace =>
  createWhiteboardViewRegistry({
    state,
    query,
    config,
    platform
  })
