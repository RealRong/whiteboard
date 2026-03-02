import type { PrimitiveAtom } from 'jotai/vanilla'
import type { Document, Viewport } from '@whiteboard/core/types'
import type { MindmapLayoutConfig } from '../mindmap/layout'
import type { InteractionState, SelectionState } from './model'

export type Atoms = {
  interaction: PrimitiveAtom<InteractionState>
  tool: PrimitiveAtom<'select' | 'edge'>
  selection: PrimitiveAtom<SelectionState>
  mindmapLayout: PrimitiveAtom<MindmapLayoutConfig>
  viewport: PrimitiveAtom<Viewport>
  document: PrimitiveAtom<Document>
  readModelRevision: PrimitiveAtom<number>
}
