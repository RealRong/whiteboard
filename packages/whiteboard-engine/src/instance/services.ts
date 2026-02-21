import type { Core } from '@whiteboard/core'
import type { ServiceContext } from '../../context'
import type { RuntimeServices } from '@engine-types/instance/runtime'
import { ContainerSizeObserver } from '../services/ContainerSizeObserver'
import { GroupAutoFit } from '../services/GroupAutoFit'
import { NodeSizeObserver } from '../services/NodeSizeObserver'
import { ViewportNavigation } from '../services/ViewportNavigation'

export const createServices = (
  core: Core,
  context: ServiceContext
): RuntimeServices => {
  return {
    nodeSizeObserver: new NodeSizeObserver(core),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(context),
    viewportNavigation: new ViewportNavigation(context)
  }
}
