import type { Core, Document } from '@whiteboard/core'
import type { WhiteboardInstanceConfig, WhiteboardRuntimeNamespace } from '@engine-types/instance'
import type { RefLike } from '@engine-types/ui'
import { getPlatformInfo } from '../../shortcuts'
import { createViewportRuntime } from '../runtime/createViewportRuntime'
import { createWhiteboardRuntimeEvents } from './createWhiteboardRuntimeEvents'

type CreateWhiteboardRuntimeNamespaceOptions = {
  core: Core
  docRef: RefLike<Document>
  containerRef: RefLike<HTMLDivElement | null>
  config: WhiteboardInstanceConfig
}

export type WhiteboardRuntimeBase = Omit<WhiteboardRuntimeNamespace, 'services' | 'shortcuts' | 'lifecycle'>

export const createWhiteboardRuntimeNamespace = ({
  core,
  docRef,
  containerRef,
  config
}: CreateWhiteboardRuntimeNamespaceOptions): WhiteboardRuntimeBase => {
  const platform = getPlatformInfo()
  const getContainer = () => containerRef.current

  return {
    core,
    docRef,
    containerRef,
    getContainer,
    config,
    platform,
    viewport: createViewportRuntime(),
    events: createWhiteboardRuntimeEvents(containerRef)
  }
}
