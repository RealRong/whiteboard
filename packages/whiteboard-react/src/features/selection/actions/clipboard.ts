import type {
  Slice,
  SliceExportResult,
  SliceRoots
} from '@whiteboard/core/document'
import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../../runtime/instance'

const ClipboardPacketType = 'whiteboard/slice'
const ClipboardPacketVersion = 1
const ClipboardMime = 'application/x-whiteboard-slice'
const PasteOffsetScreen = 24

type ClipboardInstance = Pick<WhiteboardInstance, 'commands' | 'read' | 'state' | 'viewport'>

type ClipboardPacket = {
  type: typeof ClipboardPacketType
  version: typeof ClipboardPacketVersion
  slice: Slice
  roots?: SliceRoots
}

export type ClipboardTarget =
  | 'selection'
  | {
      nodeIds: readonly NodeId[]
    }
  | {
      edgeId: EdgeId
    }

let memoryPacket: ClipboardPacket | null = null
let lastPasteKey: string | null = null
let lastPasteCount = 0

const toPacket = (
  exported: SliceExportResult
): ClipboardPacket => ({
  type: ClipboardPacketType,
  version: ClipboardPacketVersion,
  slice: exported.slice,
  roots: exported.roots
})

const serializePacket = (packet: ClipboardPacket) => JSON.stringify(packet)

const parsePacket = (value: string): ClipboardPacket | undefined => {
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

const writePacketToClipboardEvent = (
  packet: ClipboardPacket,
  event: ClipboardEvent
) => {
  event.clipboardData?.setData(ClipboardMime, serializePacket(packet))
  event.clipboardData?.setData('text/plain', serializePacket(packet))
}

const writePacket = async (
  packet: ClipboardPacket,
  event?: ClipboardEvent
) => {
  memoryPacket = packet

  if (event?.clipboardData) {
    writePacketToClipboardEvent(packet, event)
    return true
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return true
  }

  try {
    await navigator.clipboard.writeText(serializePacket(packet))
    return true
  } catch {
    return true
  }
}

const readPacketFromClipboardEvent = (
  event: ClipboardEvent
): ClipboardPacket | undefined => {
  const custom = event.clipboardData?.getData(ClipboardMime)
  if (custom) {
    const parsed = parsePacket(custom)
    if (parsed) return parsed
  }

  const text = event.clipboardData?.getData('text/plain')
  if (text) {
    const parsed = parsePacket(text)
    if (parsed) return parsed
  }

  return undefined
}

const readPacket = async (
  event?: ClipboardEvent
): Promise<ClipboardPacket | undefined> => {
  const fromEvent = event ? readPacketFromClipboardEvent(event) : undefined
  if (fromEvent) {
    memoryPacket = fromEvent
    return fromEvent
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = parsePacket(text)
      if (parsed) {
        memoryPacket = parsed
        return parsed
      }
    } catch {
      // Ignore clipboard read failures and fall back to memory.
    }
  }

  return memoryPacket ?? undefined
}

const readPasteAt = (
  instance: ClipboardInstance,
  at?: Point
) => {
  const base = at ?? { ...instance.viewport.get().center }
  const packetKey = memoryPacket ? serializePacket(memoryPacket) : null

  if (!packetKey) {
    return base
  }

  if (lastPasteKey === packetKey) {
    lastPasteCount += 1
  } else {
    lastPasteKey = packetKey
    lastPasteCount = 0
  }

  const zoom = Math.max(0.0001, instance.viewport.get().zoom)
  const offset = (lastPasteCount * PasteOffsetScreen) / zoom

  return {
    x: base.x + offset,
    y: base.y + offset
  }
}

const applyInsertedRoots = (
  instance: ClipboardInstance,
  inserted: {
    roots: SliceRoots
    allNodeIds: readonly NodeId[]
    allEdgeIds: readonly EdgeId[]
  }
) => {
  if (inserted.roots.nodeIds.length > 0) {
    instance.commands.selection.replace(inserted.roots.nodeIds)
    return
  }

  if (inserted.roots.edgeIds.length > 0) {
    instance.commands.selection.selectEdge(inserted.roots.edgeIds[0])
    return
  }

  if (inserted.allNodeIds.length > 0) {
    instance.commands.selection.replace(inserted.allNodeIds)
    return
  }

  if (inserted.allEdgeIds.length > 0) {
    instance.commands.selection.selectEdge(inserted.allEdgeIds[0])
    return
  }

  instance.commands.selection.clear()
}

const readSelectionTarget = (
  instance: ClipboardInstance,
): Exclude<ClipboardTarget, 'selection'> | undefined => {
  const selection = instance.read.selection.get()

  if (selection.target.edgeId !== undefined) {
    return {
      edgeId: selection.target.edgeId
    }
  }

  if (selection.target.nodeIds.length > 0) {
    return {
      nodeIds: selection.target.nodeIds
    }
  }

  return undefined
}

const resolveClipboardTarget = (
  instance: ClipboardInstance,
  target: ClipboardTarget
): Exclude<ClipboardTarget, 'selection'> | undefined => (
  target === 'selection'
    ? readSelectionTarget(instance)
    : target
)

const readSliceExport = (
  instance: ClipboardInstance,
  target: ClipboardTarget
) => {
  const resolved = resolveClipboardTarget(instance, target)
  if (!resolved) {
    return undefined
  }

  if ('edgeId' in resolved) {
    return instance.read.slice.fromEdge(resolved.edgeId)
  }

  return instance.read.slice.fromNodes(resolved.nodeIds)
}

export const copy = async (
  instance: ClipboardInstance,
  target: ClipboardTarget = 'selection',
  event?: ClipboardEvent
) => {
  const exported = readSliceExport(instance, target)
  if (!exported) {
    return false
  }

  return writePacket(toPacket(exported), event)
}

export const cut = async (
  instance: ClipboardInstance,
  target: ClipboardTarget = 'selection',
  event?: ClipboardEvent
) => {
  const resolved = resolveClipboardTarget(instance, target)
  if (!resolved) {
    return false
  }

  const copied = await copy(instance, resolved, event)
  if (!copied) {
    return false
  }

  if ('edgeId' in resolved) {
    const result = instance.commands.edge.delete([resolved.edgeId])
    return result.ok
  }

  const result = instance.commands.node.deleteCascade([...resolved.nodeIds])
  return result.ok
}

export const paste = async (
  instance: ClipboardInstance,
  options?: {
    at?: Point
    event?: ClipboardEvent
    parentId?: NodeId
  }
) => {
  const packet = await readPacket(options?.event)
  if (!packet) return false

  const at = readPasteAt(instance, options?.at)
  const inserted = instance.commands.document.insert(packet.slice, {
    at,
    parentId: options?.parentId,
    roots: packet.roots
  })
  if (!inserted.ok) return false

  applyInsertedRoots(instance, inserted.data)
  return true
}
