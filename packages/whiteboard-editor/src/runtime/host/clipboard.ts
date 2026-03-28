import type {
  Slice,
  SliceExportResult,
  SliceRoots
} from '@whiteboard/core/document'
import type { Point } from '@whiteboard/core/types'

const ClipboardPacketType = 'whiteboard/slice'
const ClipboardPacketVersion = 1
const ClipboardMime = 'application/x-whiteboard-slice'
const PasteOffsetScreen = 24

export type ClipboardPacket = {
  type: typeof ClipboardPacketType
  version: typeof ClipboardPacketVersion
  slice: Slice
  roots?: SliceRoots
}

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

export const createClipboardPacket = (
  exported: SliceExportResult
): ClipboardPacket => ({
  type: ClipboardPacketType,
  version: ClipboardPacketVersion,
  slice: exported.slice,
  roots: exported.roots
})

export const serializeClipboardPacket = (
  packet: ClipboardPacket
) => JSON.stringify(packet)

export const parseClipboardPacket = (
  value: string
): ClipboardPacket | undefined => {
  try {
    const parsed = JSON.parse(value) as Partial<ClipboardPacket> | null
    if (!parsed || parsed.type !== ClipboardPacketType || parsed.version !== ClipboardPacketVersion) {
      return undefined
    }
    if (!parsed.slice || parsed.slice.version !== 1) {
      return undefined
    }

    return {
      type: ClipboardPacketType,
      version: ClipboardPacketVersion,
      slice: parsed.slice,
      roots: parsed.roots
        ? {
            nodeIds: [...parsed.roots.nodeIds],
            edgeIds: [...parsed.roots.edgeIds]
          }
        : undefined
    }
  } catch {
    return undefined
  }
}

export const writeClipboardPacketToEvent = (
  packet: ClipboardPacket,
  event: ClipboardEvent
) => {
  const serialized = serializeClipboardPacket(packet)
  event.clipboardData?.setData(ClipboardMime, serialized)
  event.clipboardData?.setData('text/plain', serialized)
}

export const readClipboardPacketFromEvent = (
  event: ClipboardEvent
): ClipboardPacket | undefined => {
  const custom = event.clipboardData?.getData(ClipboardMime)
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

      const offset = (lastPasteCount * PasteOffsetScreen) / Math.max(0.0001, zoom)

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
