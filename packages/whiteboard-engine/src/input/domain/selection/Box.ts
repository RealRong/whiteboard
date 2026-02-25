import type { InternalInstance } from '@engine-types/instance/instance'
import type { SelectionMode } from '@engine-types/state'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  applySelection,
  resolveSelectionMode
} from '../../../shared/selection'
import type { RuntimeOutput } from './RuntimeOutput'

type BoxInstance = Pick<InternalInstance, 'state' | 'query' | 'config'>

type BoxOptions = {
  instance: BoxInstance
  emit: (output: RuntimeOutput) => void
}

type BoxSession = {
  pointerId: number
  mode: SelectionMode
  startScreen: Point
  startWorld: Point
  isSelecting: boolean
  latestRectWorld?: Rect
}

type StartInput = {
  pointerId: number
  screen: Point
  world: Point
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

type UpdateInput = {
  pointerId: number
  screen: Point
  world: Point
}

const EMPTY_SELECTION_BOX = {
  isSelecting: false,
  selectionRect: undefined,
  selectionRectWorld: undefined
} as const

export class Box {
  private readonly instance: BoxInstance
  private readonly emit: (output: RuntimeOutput) => void
  private session: BoxSession | null = null
  private scheduled = false

  constructor({ instance, emit }: BoxOptions) {
    this.instance = instance
    this.emit = emit
  }

  private static isSameSet = <T,>(left: Set<T>, right: Set<T>) => {
    if (left.size !== right.size) return false
    for (const value of left) {
      if (!right.has(value)) return false
    }
    return true
  }

  private flushSelection = () => {
    this.scheduled = false
    const session = this.session
    if (!session) return
    const rectWorld = session.latestRectWorld
    session.latestRectWorld = undefined
    if (!rectWorld) return
    const matched = this.instance.query.canvas.nodeIdsInRect(rectWorld)
    if (!matched.length) return
    this.emit({
      selection: (prev) => {
        const selectedNodeIds = applySelection(
          prev.selectedNodeIds,
          matched,
          session.mode
        )
        const changed =
          !Box.isSameSet(prev.selectedNodeIds, selectedNodeIds)
          || prev.selectedEdgeId !== undefined
          || prev.mode !== session.mode
        if (!changed) return prev
        return {
          ...prev,
          selectedNodeIds,
          selectedEdgeId: undefined,
          mode: session.mode
        }
      }
    })
  }

  start = ({
    pointerId,
    screen,
    world,
    modifiers
  }: StartInput) => {
    if (this.session) return false
    const mode = resolveSelectionMode(modifiers)
    this.session = {
      pointerId,
      mode,
      startScreen: screen,
      startWorld: world,
      isSelecting: false
    }
    this.emit({
      routingDrag: {},
      clearRoutingInteraction: true,
      groupHover: undefined,
      selectionBox: EMPTY_SELECTION_BOX,
      selection: (prev) => {
        if (
          prev.selectedEdgeId === undefined
          && prev.mode === mode
        ) {
          return prev
        }
        return {
          ...prev,
          selectedEdgeId: undefined,
          mode
        }
      }
    })
    return true
  }

  update = ({
    pointerId,
    screen,
    world
  }: UpdateInput) => {
    const session = this.session
    if (!session || session.pointerId !== pointerId) return false

    const minDragDistance = this.instance.config.node.selectionMinDragDistance
    const dx = Math.abs(screen.x - session.startScreen.x)
    const dy = Math.abs(screen.y - session.startScreen.y)
    if (!session.isSelecting && dx < minDragDistance && dy < minDragDistance) {
      return true
    }

    const rectScreen = rectFromPoints(session.startScreen, screen)
    const rectWorld = rectFromPoints(session.startWorld, world)
    session.isSelecting = true
    session.latestRectWorld = rectWorld

    this.emit({
      frame: true,
      selectionBox: {
        isSelecting: true,
        selectionRect: rectScreen,
        selectionRectWorld: rectWorld
      }
    })

    if (this.scheduled) {
      return true
    }
    this.scheduled = true
    this.instance.state.batchFrame(this.flushSelection)
    return true
  }

  end = (pointerId: number) => {
    const session = this.session
    if (!session || session.pointerId !== pointerId) return false
    if (!session.isSelecting && session.mode === 'replace') {
      this.emit({
        selection: (prev) => {
          if (
            !prev.selectedNodeIds.size
            && prev.selectedEdgeId === undefined
          ) {
            return prev
          }
          return {
            ...prev,
            selectedNodeIds: new Set<NodeId>(),
            selectedEdgeId: undefined
          }
        }
      })
    }
    this.clearSession()
    return true
  }

  cancel = (pointerId?: number) => {
    const session = this.session
    if (!session) return false
    if (pointerId !== undefined && session.pointerId !== pointerId) return false
    this.clearSession()
    return true
  }

  reset = () => {
    this.clearSession()
  }

  private clearSession = () => {
    this.session = null
    this.scheduled = false
    this.emit({
      selectionBox: EMPTY_SELECTION_BOX
    })
  }
}
