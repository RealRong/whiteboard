import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace
} from '@engine-types/instance'
import { createCanvasQuery } from './createCanvasQuery'
import { createSnapQuery } from './createSnapQuery'

type CreateInstanceQueryOptions = {
  readState: WhiteboardStateNamespace['read']
  config: WhiteboardInstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createInstanceQuery = ({
  readState,
  config,
  getContainer
}: CreateInstanceQueryOptions): WhiteboardInstanceQuery => {
  const canvasQuery = createCanvasQuery({
    readState,
    config,
    getContainer
  })
  const snapQuery = createSnapQuery({
    readState,
    config
  })

  return {
    ...canvasQuery,
    ...snapQuery
  }
}
