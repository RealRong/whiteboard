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
import type { EditorPlatformBridge } from '../../types/public/editor'
import type { EditorPlatform } from '../../types/internal/editor'

export const createPlatform = (
  platform?: EditorPlatformBridge
): EditorPlatform => ({
  clipboardRuntime: createClipboardRuntime(),
  clipboardPort: platform?.clipboard ?? createBrowserClipboardPort(),
  selectionLock: platform?.selectionLock ?? createBrowserDocumentSelectionLock(),
  pointerContinuation: platform?.pointerContinuation ?? createBrowserPointerContinuation()
})
