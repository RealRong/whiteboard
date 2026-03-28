import {
  dispatchCanvasDown as dispatchCanvasDownBase,
  readCanvasDown as readCanvasDownBase,
  readContextOpen as readContextOpenBase,
  readPointerSamples,
  resolveContextTarget
} from '@whiteboard/editor/input'
import type { Editor } from '../instance'

export const readCanvasDown = (
  instance: Editor,
  container: HTMLDivElement,
  event: PointerEvent
) => readCanvasDownBase(instance, container, event)

export const dispatchCanvasDown = (
  instance: Pick<Editor, 'commands' | 'read' | 'state' | 'host'>,
  input: import('@whiteboard/editor/input').CanvasDown,
  handlers: import('@whiteboard/editor/input').CanvasDownHandlers
) => dispatchCanvasDownBase(instance, input, handlers)

export const readContextOpen = (
  instance: Pick<Editor, 'read' | 'state'>,
  input: ReturnType<Editor['read']['pick']['from']>
) => readContextOpenBase(instance, input)

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
