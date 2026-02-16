import type { Core, Document } from '@whiteboard/core'
import type { InstanceConfig, Runtime } from '@engine-types/instance'
import type { RefLike } from '@engine-types/ui'
import { createViewport, getPlatformInfo } from '..'

type Options = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  config: InstanceConfig
}

export type RuntimeBase = Omit<Runtime, 'services' | 'shortcuts' | 'lifecycle'>

export const createRuntime = ({
  core,
  docRef,
  containerRef,
  config
}: Options): RuntimeBase => {
  const platform = getPlatformInfo()
  const getContainer = () => containerRef.current

  return {
    core,
    docRef,
    containerRef,
    getContainer,
    config,
    platform,
    viewport: createViewport()
  }
}
