import type { EditorPlatformRuntime } from '../../types/internal/editor'
import type { EditorPlatformBridge } from '../../types/public/editor'
import {
  createBrowserClipboardPort,
  createClipboardRuntime
} from '../platform/clipboard'
import { createBrowserDocumentSelectionLock } from '../platform/selectionLock'
import { createBrowserPointerContinuation } from '../platform/pointerContinuation'

export const composePlatform = (
  platform?: EditorPlatformBridge
): EditorPlatformRuntime => ({
  clipboardRuntime: createClipboardRuntime(),
  clipboardPort: platform?.clipboard ?? createBrowserClipboardPort(),
  selectionLock: platform?.selectionLock ?? createBrowserDocumentSelectionLock(),
  pointerContinuation: platform?.pointerContinuation ?? createBrowserPointerContinuation()
})
