import type { Core } from '@whiteboard/core'
import type { WhiteboardInstance, WhiteboardRuntimeNamespace } from '@engine-types/instance'
import { ContainerSizeObserverService } from '../services/ContainerSizeObserverService'
import { EdgeHoverService } from '../services/EdgeHoverService'
import { GroupAutoFitService } from '../services/GroupAutoFitService'
import { MindmapDragService } from '../services/MindmapDragService'
import { NodeTransformService } from '../services/NodeTransformService'
import { NodeSizeObserverService } from '../services/NodeSizeObserverService'
import { ViewportNavigationService } from '../services/ViewportNavigationService'

export const createWhiteboardRuntimeServices = (
  core: Core,
  instance: WhiteboardInstance
): WhiteboardRuntimeNamespace['services'] => {
  return {
    nodeSizeObserver: new NodeSizeObserverService(core),
    containerSizeObserver: new ContainerSizeObserverService(),
    groupAutoFit: new GroupAutoFitService(core),
    viewportNavigation: new ViewportNavigationService(instance),
    edgeHover: new EdgeHoverService(instance),
    nodeTransform: new NodeTransformService(instance),
    mindmapDrag: new MindmapDragService()
  }
}
