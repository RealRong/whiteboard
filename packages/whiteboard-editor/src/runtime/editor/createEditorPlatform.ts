import {
  createBrowserClipboardPort,
  createClipboardRuntime,
  type ClipboardPort,
  type ClipboardRuntime
} from '../host/clipboard'
import {
  createBrowserDocumentSelectionLock,
  type DocumentSelectionLock
} from '../host/selectionLock'
import {
  createBrowserPointerContinuation,
  type PointerContinuation
} from '../host/pointerContinuation'
import type { EditorHostBridge } from '../../types/public/editor'
import type { EditorPlatform } from '../../types/internal/editor'

export const createEditorPlatform = (
  host?: EditorHostBridge
): EditorPlatform => ({
  clipboardRuntime: createClipboardRuntime(),
  clipboardPort: host?.clipboard ?? createBrowserClipboardPort(),
  selectionLock: host?.selectionLock ?? createBrowserDocumentSelectionLock(),
  pointerContinuation: host?.pointerContinuation ?? createBrowserPointerContinuation()
})
