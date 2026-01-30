import { atom, useAtom, useSetAtom } from 'jotai'
import { Colors } from '@/consts'
import { IPenStyle } from '@/core/components/whiteboard/toolbars/WhiteboardToolsBar'
import { IWhiteboardProps } from '~/typings'
import { useSelectAtomValue } from '@/hooks'

export type IWhiteboardState = {
  zoom: number
  readOnly?: boolean
  dragMode: 'select' | 'drag'
  freeDrawing: boolean
  // pan with space button or middle button
  isPanning: boolean
  isSelecting: boolean
  isDraggingNode: boolean
  currentTool?: 'erase' | 'freehand'
  isErasing: boolean
  loaded: boolean
  erasedNodes?: Set<number>
  highlightedIds?: {
    currentFocusCenterNodeId: number[]
    nodeIds: Set<number>
    edgeIds: Set<number>
  }
  // pointer mode maybe different from toolbar pointer mode, because it can be changed by shortcuts
  pointerMode?: 'pan' | 'select'
  toolbarPointerMode?: 'pan' | 'select'
  freeHandConfig: {
    type: 'pen' | 'marker' | 'ballpen'
    color: string
    style?: IPenStyle
  }
  layout?: IWhiteboardProps['layout']
  state?: IWhiteboardProps['state']
  name?: string
}
export const WhiteboardStateAtom = atom<IWhiteboardState>({
  zoom: 1,
  dragMode: 'drag',
  freeDrawing: false,
  toolbarPointerMode: 'select',
  pointerMode: 'select',
  isDraggingNode: false,
  isErasing: false,
  isPanning: false,
  isSelecting: false,
  loaded: false,
  freeHandConfig: {
    type: 'ballpen',
    color: Colors.Font.Primary
  }
})
export const useSelectWhiteboardState = <Slice>(slice: (v: IWhiteboardState) => Slice) =>
  useSelectAtomValue<IWhiteboardState, Slice>(WhiteboardStateAtom, slice)
export const useSetWhiteboardState = () => useSetAtom(WhiteboardStateAtom)
export const useWhiteboardState = () => useAtom(WhiteboardStateAtom)