import type { Point, Viewport } from '@whiteboard/core'
import type { Size } from 'types/common'
import type { WhiteboardInstance } from 'types/instance'

export const createViewportRuntime = (): WhiteboardInstance['viewport'] => {
  const defaultViewport: Viewport = { center: { x: 0, y: 0 }, zoom: 1 }
  let viewportSnapshot = defaultViewport
  let screenCenter: Point = { x: 0, y: 0 }
  let containerSize: Size = { width: 0, height: 0 }
  let screenToWorld = (point: Point) => point
  let worldToScreen = (point: Point) => point

  return {
    get: () => viewportSnapshot,
    getZoom: () => viewportSnapshot.zoom,
    screenToWorld: (point) => screenToWorld(point),
    worldToScreen: (point) => worldToScreen(point),
    getScreenCenter: () => screenCenter,
    getContainerSize: () => containerSize,
    set: (next) => {
      viewportSnapshot = next.viewport
      screenCenter = next.screenCenter
      containerSize = next.containerSize
      screenToWorld = next.screenToWorld
      worldToScreen = next.worldToScreen
    }
  }
}
