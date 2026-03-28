import {
  handlePointerDown as handlePointerDownBase,
  readPointerSamples
} from '@whiteboard/editor/input'
import type { Editor } from '../instance'

export const handlePointerDown = (
  instance: Pick<Editor, 'commands' | 'read' | 'state' | 'host'>,
  container: HTMLDivElement,
  event: PointerEvent
) => handlePointerDownBase(instance, container, event)

export {
  readPointerSamples
}
export type {
  InteractionDecision,
  InteractionStart
} from '@whiteboard/editor/input'
