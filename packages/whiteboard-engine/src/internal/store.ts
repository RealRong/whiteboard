import type { Document, Viewport } from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import { atom } from 'jotai/vanilla'
import type { Atoms as StoreAtoms } from '@engine-types/internal/store'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../config'

type Result = {
  stateAtoms: StoreAtoms
}

type Options = {
  getDoc: () => Document
}

const createInitialMindmapLayout = (): MindmapLayoutConfig => ({})

const cloneViewport = (viewport: Viewport): Viewport => ({
  center: {
    x: viewport.center.x,
    y: viewport.center.y
  },
  zoom: viewport.zoom
})

export const createStoreState = ({ getDoc }: Options): Result => {
  const initialDoc = getDoc()
  const initialViewport = cloneViewport(initialDoc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
  const stateAtoms: StoreAtoms = {
    mindmapLayout: atom(createInitialMindmapLayout()),
    viewport: atom(initialViewport),
    document: atom(initialDoc)
  }

  return {
    stateAtoms
  }
}
