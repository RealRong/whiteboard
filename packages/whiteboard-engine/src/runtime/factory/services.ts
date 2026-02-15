import type { Core } from '@whiteboard/core'
import type { Instance, Runtime } from '@engine-types/instance'
import {
  ContainerSizeObserver,
  EdgeHover,
  GroupAutoFit,
  MindmapDrag,
  NodeSizeObserver,
  NodeTransform,
  ViewportNavigation
} from '../services'

export const createServices = (
  core: Core,
  instance: Instance
): Runtime['services'] => {
  return {
    nodeSizeObserver: new NodeSizeObserver(core),
    containerSizeObserver: new ContainerSizeObserver(),
    groupAutoFit: new GroupAutoFit(core),
    viewportNavigation: new ViewportNavigation(instance),
    edgeHover: new EdgeHover(instance),
    nodeTransform: new NodeTransform(instance),
    mindmapDrag: new MindmapDrag()
  }
}
