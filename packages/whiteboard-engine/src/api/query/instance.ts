import type {
  InstanceConfig,
  Query,
  State
} from '@engine-types/instance'
import { createCanvas } from './canvas'
import { createSnap } from './snap'

type Options = {
  readState: State['read']
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createQuery = ({
  readState,
  config,
  getContainer
}: Options): Query => {
  const canvasQuery = createCanvas({
    readState,
    config,
    getContainer
  })
  const snapQuery = createSnap({
    readState,
    config
  })

  return {
    ...canvasQuery,
    ...snapQuery
  }
}
