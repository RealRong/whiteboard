import type { SliceRoots } from '@whiteboard/core/document'
import type { EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { Editor } from '../../../runtime/instance/types'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../../../runtime/host/clipboard'
import {
  createClipboardPacket,
  parseClipboardPacket,
  readClipboardPacketFromEvent,
  serializeClipboardPacket,
  writeClipboardPacketToEvent
} from '../../../runtime/host/clipboard'

type ClipboardInstance = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

type ClipboardDeps = {
  instance: ClipboardInstance
  runtime: ClipboardRuntime
  port: ClipboardPort
}

export type ClipboardTarget =
  | 'selection'
  | {
      nodeIds?: readonly NodeId[]
      edgeIds?: readonly EdgeId[]
    }

const writePacket = async (
  deps: ClipboardDeps,
  packet: ReturnType<typeof createClipboardPacket>,
  event?: ClipboardEvent
) => {
  deps.runtime.remember(packet)

  if (event?.clipboardData) {
    writeClipboardPacketToEvent(packet, event)
    return true
  }

  await deps.port.writeText(serializeClipboardPacket(packet))
  return true
}

const readPacket = async (
  deps: ClipboardDeps,
  event?: ClipboardEvent
): Promise<ReturnType<typeof createClipboardPacket> | undefined> => {
  const fromEvent = event ? readClipboardPacketFromEvent(event) : undefined
  if (fromEvent) {
    deps.runtime.remember(fromEvent)
    return fromEvent
  }

  const text = await deps.port.readText()
  if (text) {
    const parsed = parseClipboardPacket(text)
    if (parsed) {
      deps.runtime.remember(parsed)
      return parsed
    }
  }

  return deps.runtime.recall() ?? undefined
}

const readPasteAt = (
  deps: ClipboardDeps,
  packet: ReturnType<typeof createClipboardPacket>,
  at?: Point
) => {
  const base = at ?? { ...deps.instance.viewport.get().center }
  return deps.runtime.readPastePoint({
    base,
    packet,
    zoom: deps.instance.viewport.get().zoom
  })
}

const applyInsertedRoots = (
  instance: ClipboardInstance,
  inserted: {
    roots: SliceRoots
    allNodeIds: readonly NodeId[]
    allEdgeIds: readonly EdgeId[]
  }
) => {
  const nodeIds = inserted.roots.nodeIds.length > 0
    ? inserted.roots.nodeIds
    : inserted.allNodeIds
  const edgeIds = inserted.roots.edgeIds.length > 0
    ? inserted.roots.edgeIds
    : inserted.allEdgeIds

  if (nodeIds.length > 0 || edgeIds.length > 0) {
    instance.commands.selection.replace({
      nodeIds,
      edgeIds
    })
    return
  }

  instance.commands.selection.clear()
}

const readSelectionTarget = (
  instance: ClipboardInstance
): Exclude<ClipboardTarget, 'selection'> | undefined => {
  const selection = instance.read.selection.get()

  if (selection.items.count > 0) {
    return {
      nodeIds: selection.target.nodeIds,
      edgeIds: selection.target.edgeIds
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

  return instance.read.slice.fromSelection(resolved)
}

export const copy = async (
  deps: ClipboardDeps,
  target: ClipboardTarget = 'selection',
  event?: ClipboardEvent
) => {
  const exported = readSliceExport(deps.instance, target)
  if (!exported) {
    return false
  }

  return writePacket(deps, createClipboardPacket(exported), event)
}

export const cut = async (
  deps: ClipboardDeps,
  target: ClipboardTarget = 'selection',
  event?: ClipboardEvent
) => {
  const resolved = resolveClipboardTarget(deps.instance, target)
  if (!resolved) {
    return false
  }

  const copied = await copy(deps, resolved, event)
  if (!copied) {
    return false
  }

  if (resolved.edgeIds?.length) {
    const result = deps.instance.commands.edge.delete([...resolved.edgeIds])
    if (!result.ok) {
      return false
    }
  }

  if (resolved.nodeIds?.length) {
    const result = deps.instance.commands.node.deleteCascade([...resolved.nodeIds])
    if (!result.ok) {
      return false
    }
  }

  return true
}

export const paste = async (
  deps: ClipboardDeps,
  options?: {
    at?: Point
    event?: ClipboardEvent
    ownerId?: NodeId
  }
) => {
  const packet = await readPacket(deps, options?.event)
  if (!packet) {
    return false
  }

  const at = readPasteAt(deps, packet, options?.at)
  const inserted = deps.instance.commands.document.insert(packet.slice, {
    at,
    ownerId: options?.ownerId,
    roots: packet.roots
  })
  if (!inserted.ok) {
    return false
  }

  applyInsertedRoots(deps.instance, inserted.data)
  return true
}
