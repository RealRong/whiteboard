import {
  dispatchCanvasDown as dispatchCanvasDownBase,
  readCanvasDown as readCanvasDownBase,
  readContextOpen as readContextOpenBase,
  readPointerSamples,
  resolveContextTarget
} from '@whiteboard/editor/input'
import type { InternalEditor as EditorInternalEditor } from '@whiteboard/editor'
import type { InternalEditor } from '../instance'

export const readCanvasDown = (
  instance: InternalEditor,
  container: HTMLDivElement,
  event: PointerEvent
) => readCanvasDownBase(
  instance as unknown as EditorInternalEditor,
  container,
  event
)

export const dispatchCanvasDown = (
  instance: Pick<InternalEditor, 'commands' | 'read' | 'state' | 'interaction'>,
  input: import('@whiteboard/editor/input').CanvasDown,
  handlers: import('@whiteboard/editor/input').CanvasDownHandlers
) => dispatchCanvasDownBase(
  instance as unknown as EditorInternalEditor,
  input,
  handlers
)

export const readContextOpen = (
  instance: Pick<InternalEditor, 'commands' | 'read' | 'state' | 'viewport'>,
  input: ReturnType<InternalEditor['read']['pick']['from']>
) => readContextOpenBase(
  instance as unknown as EditorInternalEditor,
  input
)

export {
  readPointerSamples,
  resolveContextTarget
}
export type {
  CanvasDown,
  CanvasDownHandlers,
  CanvasFrameDown,
  ContextOpen,
  ContextTarget,
  DrawDown,
  EdgeCreateDown,
  EdgeDown,
  EraserDown,
  GestureDown,
  InsertDown,
  MindmapDown,
  TransformDown
} from '@whiteboard/editor/input'
