import type { InstanceConfig } from '@engine-types/instance/config'
import type { QueryConfig } from '@engine-types/instance/query'

type Options = {
  config: InstanceConfig
}

export const config = ({ config }: Options): QueryConfig => ({
  get: () => config
})
