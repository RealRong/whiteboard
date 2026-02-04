import type { Core, Document } from '@whiteboard/core'
import type { RefObject } from 'react'
import { createNodeSizeObserverService } from './nodeSizeObserverService'
import type { NodeSizeObserverService } from './nodeSizeObserverService'

export type WhiteboardInstance = {
  core: Core
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement>
  getContainer: () => HTMLDivElement | null
  services: {
    nodeSizeObserver: NodeSizeObserverService
  }
  addWindowEventListener: <K extends keyof WindowEventMap>(
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
  addContainerEventListener: <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ) => () => void
}

export type CreateWhiteboardInstanceOptions = {
  core: Core
  docRef: RefObject<Document>
  containerRef: RefObject<HTMLDivElement>
}

export const createWhiteboardInstance = ({ core, docRef, containerRef }: CreateWhiteboardInstanceOptions): WhiteboardInstance => {
  const getContainer = () => containerRef.current
  const services = {
    nodeSizeObserver: createNodeSizeObserverService(core, containerRef)
  }
  const addWindowEventListener: WhiteboardInstance['addWindowEventListener'] = (type, listener, options) => {
    window.addEventListener(type, listener as EventListener, options)
    return () => {
      window.removeEventListener(type, listener as EventListener, options)
    }
  }
  const addContainerEventListener: WhiteboardInstance['addContainerEventListener'] = (
    type,
    listener,
    options
  ) => {
    const container = containerRef.current
    if (!container) return () => {}
    container.addEventListener(type, listener as EventListener, options)
    return () => {
      container.removeEventListener(type, listener as EventListener, options)
    }
  }

  return {
    core,
    docRef,
    containerRef,
    getContainer,
    services,
    addWindowEventListener,
    addContainerEventListener
  }
}
