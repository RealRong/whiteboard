export { Surface } from './app/Surface'
export { useClipboardActions } from './app/useClipboardActions'

export {
  isContextMenuIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isKeyboardIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget
} from './host/domTargets'

export {
  resolveHostPoint,
  resolveKeyboardInput,
  resolvePointerInput,
  resolveWheelInput
} from './host/input'

export {
  createShortcutMap,
  detectShortcutPlatform,
  readShortcut,
  resolveShortcutBindings
} from './host/shortcut'

export { createHostRuntime } from './host/runtime'

export type { WhiteboardHostRuntime } from './host/runtime'
export type { ClipboardHostAdapter } from './host/clipboard'
export type { PickRegistry } from './host/pickRegistry'
export type { PointerSession } from './host/pointerSession'
export type { DocumentSelectionLock } from './host/selectionLock'
export type { EditorPick } from './host/pick'
export type {
  HostResolvedPoint
} from './host/input'
export type {
  KeyboardInput,
  ModifierKeys,
  PointerDownInput,
  PointerInput,
  PointerMoveInput,
  PointerPhase,
  PointerSample,
  PointerStateStore,
  PointerUpInput,
  WheelInput
} from './host/types'
