import type { PrimitiveAtom } from 'jotai/vanilla'
import type { Document, Viewport } from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../mindmap/layout'

export type Atoms = {
  mindmapLayout: PrimitiveAtom<MindmapLayoutConfig>
  viewport: PrimitiveAtom<Viewport>
  document: PrimitiveAtom<Document>
}
