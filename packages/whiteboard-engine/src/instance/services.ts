import type { Core } from '@whiteboard/core'
import type { ServiceRuntimeContext } from '../runtime/common/contracts'
import type { RuntimeServices } from '@engine-types/instance/runtime'
import { GroupAutoFit, NodeSizeObserver } from '../runtime/actors/node/services'
import {
  ContainerSizeObserver,
  ViewportNavigation
} from '../runtime/actors/viewport/services'

export const createServices = (
  core: Core,
  context: ServiceRuntimeContext
): RuntimeServices => {
  return {
    nodeSizeObserver: new NodeSizeObserver(core),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(context),
    viewportNavigation: new ViewportNavigation(context)
  }
}
