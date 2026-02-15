import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace,
  WhiteboardViewNamespace
} from '@engine-types/instance'
import { createWhiteboardViewRegistry } from '../../state/view'

type CreateWhiteboardViewNamespaceOptions = {
  state: WhiteboardStateNamespace
  query: WhiteboardInstanceQuery
  config: WhiteboardInstanceConfig
}

export const createWhiteboardViewNamespace = ({
  state,
  query,
  config
}: CreateWhiteboardViewNamespaceOptions): WhiteboardViewNamespace =>
  createWhiteboardViewRegistry({
    state,
    query,
    config
  })
