import { atom } from 'jotai'
import { selectAtom } from 'jotai/utils'
import type { Core, Document, Point } from '@whiteboard/core'
import type { RefObject } from 'react'
import type { Size } from '../types'
import type { MindmapLayoutConfig } from '../../mindmap/types'
import type { WhiteboardInstance } from '../instance/whiteboardInstance'

export type WhiteboardInputState = {
  doc: Document | null
  docRef: RefObject<Document> | null
  core: Core | null
  containerRef: RefObject<HTMLDivElement> | null
  screenToWorld: ((point: Point) => Point) | null
  mindmapLayout: MindmapLayoutConfig
  instance: WhiteboardInstance | null
}

export const whiteboardInputAtom = atom<WhiteboardInputState>({
  doc: null,
  docRef: null,
  core: null,
  containerRef: null,
  screenToWorld: null,
  mindmapLayout: {},
  instance: null
})

export const docAtom = selectAtom(whiteboardInputAtom, (state) => state.doc)
export const docRefAtom = selectAtom(whiteboardInputAtom, (state) => state.docRef)
export const coreAtom = selectAtom(whiteboardInputAtom, (state) => state.core)
export const containerRefAtom = selectAtom(whiteboardInputAtom, (state) => state.containerRef)
export const screenToWorldAtom = selectAtom(whiteboardInputAtom, (state) => state.screenToWorld)
export const mindmapLayoutAtom = selectAtom(whiteboardInputAtom, (state) => state.mindmapLayout)
export const instanceAtom = selectAtom(whiteboardInputAtom, (state) => state.instance)

export const nodeSizeAtom = atom<Size | null>(null)
export const mindmapNodeSizeAtom = atom<Size | null>(null)
