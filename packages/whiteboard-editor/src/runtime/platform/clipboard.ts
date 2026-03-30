import type { Point } from '@whiteboard/core/types'
import type { ClipboardPacket } from '@whiteboard/core/document'
import {
  parseClipboardPacket,
  serializeClipboardPacket
} from '@whiteboard/core/document'

const CLIPBOARD_MIME = 'application/x-whiteboard-slice'
const PASTE_OFFSET_SCREEN = 24

export type ClipboardPort = {
  writeText: (text: string) => Promise<void>
  readText: () => Promise<string | undefined>
}

export type ClipboardRuntime = {
  remember: (packet: ClipboardPacket) => void
  recall: () => ClipboardPacket | null
  readPastePoint: (input: {
    base: Point
    zoom: number
    packet: ClipboardPacket
  }) => Point
}

export const writeClipboardPacketToEvent = (
  packet: ClipboardPacket,
  event: ClipboardEvent
) => {
  const serialized = serializeClipboardPacket(packet)
  event.clipboardData?.setData(CLIPBOARD_MIME, serialized)
  event.clipboardData?.setData('text/plain', serialized)
}

export const readClipboardPacketFromEvent = (
  event: ClipboardEvent
): ClipboardPacket | undefined => {
  const custom = event.clipboardData?.getData(CLIPBOARD_MIME)
  if (custom) {
    const parsed = parseClipboardPacket(custom)
    if (parsed) {
      return parsed
    }
  }

  const text = event.clipboardData?.getData('text/plain')
  if (!text) {
    return undefined
  }

  return parseClipboardPacket(text)
}

export const createClipboardRuntime = (): ClipboardRuntime => {
  let memoryPacket: ClipboardPacket | null = null
  let lastPasteKey: string | null = null
  let lastPasteCount = 0

  return {
    remember: (packet) => {
      memoryPacket = packet
    },
    recall: () => memoryPacket,
    readPastePoint: ({
      base,
      zoom,
      packet
    }) => {
      const packetKey = serializeClipboardPacket(packet)

      if (lastPasteKey === packetKey) {
        lastPasteCount += 1
      } else {
        lastPasteKey = packetKey
        lastPasteCount = 0
      }

      const offset = (lastPasteCount * PASTE_OFFSET_SCREEN) / Math.max(0.0001, zoom)

      return {
        x: base.x + offset,
        y: base.y + offset
      }
    }
  }
}

export const createBrowserClipboardPort = (): ClipboardPort => ({
  writeText: async (text) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Ignore clipboard write failures.
    }
  },
  readText: async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) {
      return undefined
    }

    try {
      return await navigator.clipboard.readText()
    } catch {
      return undefined
    }
  }
})
