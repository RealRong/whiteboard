import type { State } from '@engine-types/instance/state'
import type { FrameContext } from './types'

export const readFrameContext = (state: State): FrameContext => ({
  tool: state.read('tool'),
  selectedNodeIds: state.read('selection').selectedNodeIds,
  hoveredGroupId: state.read('groupHovered'),
  viewportZoom: state.read('viewport').zoom,
  docId: undefined
})

export const withFrameDocId = (
  frame: FrameContext,
  docId: string | undefined
): FrameContext => {
  if (frame.docId === docId) return frame
  return {
    ...frame,
    docId
  }
}
