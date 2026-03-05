import {
  isSameViewport,
  viewportScreenToWorld,
  viewportWorldToScreen
} from '@whiteboard/core/geometry'
import { isSameBoxTuple } from '@whiteboard/core/utils'
import type { Point, Viewport } from '@whiteboard/core/types'
import type { Size } from '@engine-types/common/base'
import type { PrimitiveAtom, createStore } from 'jotai/vanilla'
import type {
  ContainerRect,
  ViewportApi,
  ViewportReadApi,
  ViewportWriteApi
} from '@engine-types/viewport/api'
import { DEFAULT_INTERNALS } from '../config'

const toContainerSize = (rect: ContainerRect): Size => ({
  width: rect.width,
  height: rect.height
})

const toScreenCenter = (size: Size): Point => ({
  x: size.width / 2,
  y: size.height / 2
})

const copyViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

const copyRect = (rect: ContainerRect): ContainerRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height
})

export class ViewportHost implements ViewportApi, ViewportReadApi, ViewportWriteApi {
  private readonly store: ReturnType<typeof createStore>
  private readonly atom: PrimitiveAtom<Viewport>
  private containerRect: ContainerRect = copyRect(DEFAULT_INTERNALS.containerRect)
  private containerSize: Size = toContainerSize(DEFAULT_INTERNALS.containerRect)
  private screenCenter: Point = toScreenCenter(this.containerSize)

  constructor({ store, atom }: {
    store: ReturnType<typeof createStore>
    atom: PrimitiveAtom<Viewport>
  }) {
    this.store = store
    this.atom = atom
  }

  private readViewport = (): Viewport =>
    this.store.get(this.atom)

  private writeViewport = (viewport: Viewport) => {
    this.store.set(this.atom, viewport)
  }

  private updateDerivedFromRect = (rect: ContainerRect) => {
    this.containerRect = copyRect(rect)
    this.containerSize = toContainerSize(rect)
    this.screenCenter = toScreenCenter(this.containerSize)
  }

  get: ViewportApi['get'] = () => this.readViewport()

  getZoom: ViewportApi['getZoom'] = () => this.readViewport().zoom

  screenToWorld: ViewportApi['screenToWorld'] = (point) =>
    viewportScreenToWorld(point, this.readViewport(), this.screenCenter)

  worldToScreen: ViewportApi['worldToScreen'] = (point) =>
    viewportWorldToScreen(point, this.readViewport(), this.screenCenter)

  clientToScreen: ViewportApi['clientToScreen'] = (clientX, clientY) => ({
    x: clientX - this.containerRect.left,
    y: clientY - this.containerRect.top
  })

  clientToWorld: ViewportApi['clientToWorld'] = (clientX, clientY) =>
    this.screenToWorld(this.clientToScreen(clientX, clientY))

  getScreenCenter: ViewportApi['getScreenCenter'] = () => this.screenCenter

  getContainerSize: ViewportApi['getContainerSize'] = () => this.containerSize

  setViewport: ViewportApi['setViewport'] = (nextViewport) => {
    const previous = this.readViewport()
    if (isSameViewport(nextViewport, previous)) return
    this.writeViewport(copyViewport(nextViewport))
  }

  setContainerRect: ViewportApi['setContainerRect'] = (nextRect) => {
    if (isSameBoxTuple(nextRect, this.containerRect)) return
    this.updateDerivedFromRect(nextRect)
  }
}
