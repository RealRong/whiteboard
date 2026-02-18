import type { Core } from '@whiteboard/core'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeServices } from '@engine-types/instance/runtime'
import { ContainerSizeObserver } from '../services/ContainerSizeObserver'
import { EdgeHover } from '../services/EdgeHover'
import { GroupAutoFit } from '../services/GroupAutoFit'
import { MindmapDrag } from '../services/MindmapDrag'
import { NodeDrag } from '../services/NodeDrag'
import { NodeSizeObserver } from '../services/NodeSizeObserver'
import { NodeTransform } from '../services/NodeTransform'
import { ViewportNavigation } from '../services/ViewportNavigation'

export const createServices = (
  core: Core,
  instance: InternalInstance
): RuntimeServices => {
  return {
    nodeSizeObserver: new NodeSizeObserver(core),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(instance),
    viewportNavigation: new ViewportNavigation(instance),
    edgeHover: new EdgeHover(instance),
    nodeDrag: new NodeDrag(instance),
    nodeTransform: new NodeTransform(instance),
    mindmapDrag: new MindmapDrag()
  }
}
