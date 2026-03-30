import {
  resolveDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import type {
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import {
  type ReadStore,
  type StagedValueStore
} from '@whiteboard/engine'
import type { PointerDown } from '../../runtime/input/pointer'
import { createInteractionSessionSlot } from '../../runtime/interaction'
import type { EditorRuntime } from '../../types/internal/editor'
import { createRafValueStore } from '../../runtime/utils/rafStore'
import type { DrawBrushKind } from '../../types/public/tool'
import type { NodeProjectionRuntime } from '../node/projection/store'
import {
  readDrawStyle,
  type DrawPreview,
  type ResolvedDrawStyle
} from './state'
import { getSegmentBounds } from '@whiteboard/core/geometry'

const DRAW_MIN_LENGTH_SCREEN = 4
const SAMPLE_DISTANCE_SCREEN = 1
const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

type ActiveStroke = {
  ownerId?: NodeId
  kind: DrawBrushKind
  style: ResolvedDrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

type ActiveErase = {
  ids: Set<NodeId>
  lastWorld: Point
}

type ActiveDraw =
  | {
      kind: 'stroke'
      value: ActiveStroke
    }
  | {
      kind: 'erase'
      value: ActiveErase
    }

type DrawPreviewStore = Pick<
  StagedValueStore<DrawPreview | null>,
  'clear' | 'flush' | 'get' | 'subscribe' | 'write'
>

type DrawInputRuntimeDeps = Pick<
  EditorRuntime,
  'commands' | 'interaction' | 'read' | 'viewport'
> & {
  internals: {
    projections: {
      model: {
        node: Pick<NodeProjectionRuntime, 'hidden'>
      }
    }
  }
}

export type DrawInputRuntime = {
  preview: ReadStore<DrawPreview | null>
  startStroke: (input: PointerDown) => boolean
  startErase: (input: PointerDown) => boolean
  cancel: () => void
}

const readPointerSamples = (
  event: PointerEvent
) => {
  if (typeof event.getCoalescedEvents !== 'function') {
    return [event]
  }

  const samples = event.getCoalescedEvents()
  return samples.length > 0 ? samples : [event]
}

const hasMovedEnough = (
  left: Point,
  right: Point
) => {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return (dx * dx) + (dy * dy) >= SAMPLE_DISTANCE_SCREEN * SAMPLE_DISTANCE_SCREEN
}

const createDrawPreviewStore = (): DrawPreviewStore => {
  const preview = createRafValueStore<DrawPreview | null>({
    initial: null,
    isEqual: (left, right) => left === right
  })

  return {
    get: preview.get,
    subscribe: preview.subscribe,
    write: preview.write,
    clear: preview.clear,
    flush: preview.flush
  }
}

export const createDrawInputRuntime = (
  editor: DrawInputRuntimeDeps
): DrawInputRuntime => {
  const previewStore = createDrawPreviewStore()
  const interaction = createInteractionSessionSlot<ActiveDraw>({
    interaction: editor.interaction,
    cleanup: () => {
      writePreview(null)
      syncHidden(null)
    }
  })

  const readActiveStroke = (): ActiveStroke | null => {
    const active = interaction.getActive()
    return active?.kind === 'stroke'
      ? active.value
      : null
  }

  const readActiveErase = (): ActiveErase | null => {
    const active = interaction.getActive()
    return active?.kind === 'erase'
      ? active.value
      : null
  }

  const writeActiveStroke = (
    active: ActiveStroke | null
  ) => {
    interaction.setActive(active ? {
      kind: 'stroke',
      value: active
    } : null)
  }

  const writeActiveErase = (
    active: ActiveErase | null
  ) => {
    interaction.setActive(active ? {
      kind: 'erase',
      value: active
    } : null)
  }

  const resolvePoints = (
    points: readonly Point[]
  ) => {
    const zoom = editor.viewport.get().zoom
    return resolveDrawPoints({
      points,
      zoom
    })
  }

  const writePreview = (
    preview: DrawPreview | null
  ) => {
    if (!preview) {
      previewStore.clear()
      return
    }

    previewStore.write(preview)
  }

  const syncStrokePreview = (
    active: ActiveStroke | null
  ) => {
    if (!active) {
      writePreview(null)
      return
    }

    writePreview({
      kind: active.kind,
      style: active.style,
      points: resolvePoints(active.points)
    })
  }

  const syncHidden = (
    active: ActiveErase | null
  ) => {
    if (!active) {
      editor.internals.projections.model.node.hidden.clear()
      return
    }

    editor.internals.projections.model.node.hidden.write([...active.ids])
  }

  const pushPoint = (
    active: ActiveStroke,
    event: PointerEvent,
    force = false
  ) => {
    const pointer = editor.viewport.pointer(event)
    const previous = active.points[active.points.length - 1]

    if (
      !force
      && !hasMovedEnough(active.lastScreen, pointer.screen)
    ) {
      return false
    }

    if (
      previous
      && previous.x === pointer.world.x
      && previous.y === pointer.world.y
    ) {
      active.lastScreen = pointer.screen
      return false
    }

    active.points.push(pointer.world)
    active.lengthScreen += Math.hypot(
      pointer.screen.x - active.lastScreen.x,
      pointer.screen.y - active.lastScreen.y
    )
    active.lastScreen = pointer.screen
    return true
  }

  const pushEventPoints = (
    active: ActiveStroke,
    event: PointerEvent,
    force = false
  ) => {
    let changed = false
    const samples = readPointerSamples(event)

    for (let index = 0; index < samples.length; index += 1) {
      changed = pushPoint(
        active,
        samples[index]!,
        force && index === samples.length - 1
      ) || changed
    }

    if (changed) {
      syncStrokePreview(active)
    }
  }

  const commitStroke = (
    active: ActiveStroke
  ) => {
    if (
      active.points.length < 2
      || active.lengthScreen < DRAW_MIN_LENGTH_SCREEN
    ) {
      return
    }

    const points = resolvePoints(active.points)
    const stroke = resolveDrawStroke({
      points,
      width: active.style.width
    })
    if (!stroke) {
      return
    }

    editor.commands.node.create({
      type: 'draw',
      ownerId: active.ownerId,
      position: stroke.position,
      size: stroke.size,
      data: {
        points: stroke.points,
        baseSize: stroke.size
      },
      style: {
        stroke: active.style.color,
        strokeWidth: active.style.width,
        opacity: active.style.opacity
      }
    })
  }

  const collectRect = (
    active: ActiveErase,
    rect: Rect
  ) => {
    const nodeIds = editor.read.node.idsInRect(rect, {
      match: 'touch'
    })
    let changed = false

    nodeIds.forEach((nodeId) => {
      const item = editor.read.node.item.get(nodeId)
      if (!item || item.node.type !== 'draw' || active.ids.has(nodeId)) {
        return
      }

      active.ids.add(nodeId)
      changed = true
    })

    if (changed) {
      syncHidden(active)
    }
  }

  const collectPoint = (
    active: ActiveErase,
    world: Point
  ) => {
    const halfWorld = ERASER_HIT_EPSILON_SCREEN / Math.max(editor.viewport.get().zoom, ZOOM_EPSILON)
    collectRect(active, getSegmentBounds(active.lastWorld, world, halfWorld))
    active.lastWorld = world
  }

  const collectEvent = (
    active: ActiveErase,
    event: PointerEvent
  ) => {
    const samples = readPointerSamples(event)

    for (let index = 0; index < samples.length; index += 1) {
      const pointer = editor.viewport.pointer(samples[index]!)
      collectPoint(active, pointer.world)
    }
  }

  const startStroke = (
    input: PointerDown
  ) => {
    if (
      input.tool.type !== 'draw'
      || input.tool.kind === 'eraser'
      || input.pick.kind !== 'background'
    ) {
      return false
    }

    const frameTargetId = input.frame.id ?? editor.read.node.frameAt(input.point.world)
    const active: ActiveStroke = {
      ownerId: input.frame.id ?? frameTargetId,
      kind: input.tool.kind,
      style: readDrawStyle(editor.read.draw.preferences.get(), input.tool.kind),
      points: [input.point.world],
      lastScreen: input.point.screen,
      lengthScreen: 0
    }

    const nextSession = interaction.start({
      mode: 'draw',
      pointerId: input.event.pointerId,
      capture: input.capture,
      move: (moveEvent) => {
        const activeStroke = readActiveStroke()
        if (!activeStroke) {
          return
        }

        pushEventPoints(activeStroke, moveEvent)
      },
      up: (upEvent, interactionSession) => {
        const activeStroke = readActiveStroke()
        if (!activeStroke) {
          interactionSession.finish()
          return
        }

        pushEventPoints(activeStroke, upEvent, true)
        commitStroke(activeStroke)
        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    writeActiveStroke(active)
    input.event.preventDefault()
    input.event.stopPropagation()
    return true
  }

  const startErase = (
    input: PointerDown
  ) => {
    if (input.tool.type !== 'draw' || input.tool.kind !== 'eraser') {
      return false
    }

    const active: ActiveErase = {
      ids: new Set<NodeId>(),
      lastWorld: input.point.world
    }
    collectPoint(active, input.point.world)

    const nextSession = interaction.start({
      mode: 'draw',
      pointerId: input.event.pointerId,
      capture: input.capture,
      move: (moveEvent) => {
        const activeErase = readActiveErase()
        if (!activeErase) {
          return
        }

        collectEvent(activeErase, moveEvent)
      },
      up: (upEvent, interactionSession) => {
        const activeErase = readActiveErase()
        if (!activeErase) {
          interactionSession.finish()
          return
        }

        collectEvent(activeErase, upEvent)
        if (activeErase.ids.size > 0) {
          editor.commands.node.delete([...activeErase.ids])
        }
        interactionSession.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    writeActiveErase(active)
    syncHidden(active)
    input.event.preventDefault()
    input.event.stopPropagation()
    return true
  }

  return {
    preview: {
      get: previewStore.get,
      subscribe: previewStore.subscribe
    },
    startStroke: (input) => {
      if (interaction.hasActive()) {
        return false
      }

      return startStroke(input)
    },
    startErase: (input) => {
      if (interaction.hasActive()) {
        return false
      }

      return startErase(input)
    },
    cancel: () => {
      interaction.cancel()
    }
  }
}
