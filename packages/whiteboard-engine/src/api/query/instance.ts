import type {
  InstanceConfig,
  Query,
  State
} from '@engine-types/instance'
import { createCanvasQuery } from './canvas'
import { createSnapQuery } from './snap'

type Options = {
  readState: State['read']
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createInstanceQuery = ({
  readState,
  config,
  getContainer
}: Options): Query => {
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
