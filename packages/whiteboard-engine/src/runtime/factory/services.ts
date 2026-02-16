import type { Core } from '@whiteboard/core'
import type { Instance, Runtime } from '@engine-types/instance'
import { ContainerSizeObserver } from '../services/ContainerSizeObserver'
import { EdgeHover } from '../services/EdgeHover'
import { GroupAutoFit } from '../services/GroupAutoFit'
import { MindmapDrag } from '../services/MindmapDrag'
import { NodeSizeObserver } from '../services/NodeSizeObserver'
import { NodeTransform } from '../services/NodeTransform'
import { ViewportNavigation } from '../services/ViewportNavigation'

export const createServices = (
  core: Core,
  instance: Instance
): Runtime['services'] => {
  return {
    nodeSizeObserver: new NodeSizeObserver(core),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(instance),
    viewportNavigation: new ViewportNavigation(instance),
    edgeHover: new EdgeHover(instance),
    nodeTransform: new NodeTransform(instance),
    mindmapDrag: new MindmapDrag()
  }
}
