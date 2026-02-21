import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core'
import type {
  NodeDragCancelOptions,
  NodeDragEndOptions,
  NodeDragStartOptions,
  NodeDragUpdateOptions
} from '@engine-types/commands'
import type { NodeViewUpdate } from '@engine-types/graph'
import type { Guide } from '@engine-types/node/snap'
import type { InternalInstance } from '@engine-types/instance/instance'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'
import {
  expandGroupRect,
  computeSnap,
  findSmallestGroupAtPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  rectEquals
} from './domain'
import { getNodeAABB, rectContains } from '../../../runtime/common/geometry'

type DragInstance = Pick<
  InternalInstance,
  'state' | 'graph' | 'runtime' | 'query' | 'mutate'
>

type DragChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

type DragTransient = {
  setGuides: (guides: Guide[]) => void
  clearGuides: () => void
  setOverrides: (updates: NodeViewUpdate[]) => void
  commitOverrides: (updates?: NodeViewUpdate[]) => void
  clearOverrides: (ids?: NodeId[]) => void
}

type DragSession = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: { width: number; height: number }
  children?: DragChildren
}

type DragOptions = {
  instance: DragInstance
  transient: DragTransient
}

export class Drag {
  private readonly instance: DragInstance
  private readonly transient: DragTransient
  private session: DragSession | null = null

  constructor({ instance, transient }: DragOptions) {
    this.instance = instance
    this.transient = transient
  }

  private getCanvasNodes = () => this.instance.graph.read().canvasNodes

  private setDragState = (active?: {
    pointerId: number
    nodeId: NodeId
    nodeType: Node['type']
  }) => {
    this.instance.state.write('nodeDrag', active ? { active } : {})
  }

  private setHoveredGroup = (groupId?: NodeId) => {
    if (this.instance.state.read('groupHovered') === groupId) return
    this.instance.state.write('groupHovered', groupId)
  }

  private clearGuides = () => {
    this.transient.clearGuides()
  }

  private finish = () => {
    this.instance.state.batch(() => {
      this.clearGuides()
      this.setHoveredGroup(undefined)
      this.session = null
      this.setDragState(undefined)
    })
  }

  private applyNodePatch = (nodeId: NodeId, patch: NodePatch) => {
    void this.instance.mutate(
      [{ type: 'node.update', id: nodeId, patch }],
      {
        source: 'interaction',
        actor: 'node.drag'
      }
    )
  }

  private buildGroupChildren = (
    groupNodes: Node[],
    nodeId: NodeId,
    origin: Point
  ): DragChildren | undefined => {
    const children = getGroupDescendants(groupNodes, nodeId).map((child) => child.id)
    if (!children.length) return undefined

    const nodeById = new Map(groupNodes.map((node) => [node.id, node]))
    const offsets = new Map<NodeId, Point>()
    children.forEach((childId) => {
      const childNode = nodeById.get(childId)
      if (!childNode) return
      offsets.set(childId, {
        x: childNode.position.x - origin.x,
        y: childNode.position.y - origin.y
      })
    })

    return { ids: children, offsets }
  }

  private buildGroupUpdates = (session: DragSession, position: Point): NodeViewUpdate[] => {
    const updates: NodeViewUpdate[] = [{ id: session.nodeId, position }]
    session.children?.ids.forEach((childId) => {
      const offset = session.children?.offsets.get(childId)
      if (!offset) return
      updates.push({
        id: childId,
        position: {
          x: position.x + offset.x,
          y: position.y + offset.y
        }
      })
    })
    return updates
  }

  private resolveMove = (options: {
    nodeId: NodeId
    position: Point
    size: { width: number; height: number }
    childrenIds?: NodeId[]
    allowCross?: boolean
  }): Point => {
    const { nodeId, position, size, childrenIds, allowCross } = options

    if (this.instance.state.read('tool') !== 'select') {
      this.clearGuides()
      return position
    }

    const zoom = Math.max(
      this.instance.runtime.viewport.getZoom(),
      DEFAULT_INTERNALS.zoomEpsilon
    )
    const nodeConfig = this.instance.runtime.config.node
    const thresholdWorld = Math.min(
      nodeConfig.snapThresholdScreen / zoom,
      nodeConfig.snapMaxThresholdWorld
    )
    const movingRect: Rect = {
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height
    }
    const queryRect: Rect = {
      x: movingRect.x - thresholdWorld,
      y: movingRect.y - thresholdWorld,
      width: movingRect.width + thresholdWorld * 2,
      height: movingRect.height + thresholdWorld * 2
    }
    const baseCandidates = this.instance.query.snap.candidatesInRect(queryRect)
    const excludeSet = childrenIds?.length
      ? new Set([nodeId, ...childrenIds])
      : new Set([nodeId])
    const candidates = baseCandidates.filter((candidate) => !excludeSet.has(candidate.id))

    const result = computeSnap(movingRect, candidates, thresholdWorld, nodeId, {
      allowCross,
      crossThreshold: thresholdWorld * DEFAULT_TUNING.nodeDrag.snapCrossThresholdRatio
    })
    this.transient.setGuides(result.guides)

    return {
      x: result.dx !== undefined ? position.x + result.dx : position.x,
      y: result.dy !== undefined ? position.y + result.dy : position.y
    }
  }

  private movePlain = (session: DragSession, nextPosition: Point) => {
    const { width, height } = session.size
    const center = {
      x: nextPosition.x + width / 2,
      y: nextPosition.y + height / 2
    }
    const hovered = findSmallestGroupAtPoint(
      this.getCanvasNodes(),
      this.instance.runtime.config.nodeSize,
      center,
      session.nodeId
    )
    this.instance.state.batch(() => {
      this.setHoveredGroup(hovered?.id)
      this.transient.setOverrides([
        { id: session.nodeId, position: nextPosition }
      ])
    })
  }

  private moveGroup = (session: DragSession, nextPosition: Point) => {
    const updates = this.buildGroupUpdates(session, nextPosition)
    this.instance.state.batch(() => {
      this.transient.setOverrides(updates)
      this.setHoveredGroup(undefined)
    })
  }

  private handleDropToGroup = (session: DragSession, finalPos: Point) => {
    if (session.nodeType === 'group') return

    const nodes = this.getCanvasNodes()
    const currentNode = nodes.find((node) => node.id === session.nodeId)
    if (!currentNode) return

    const hoveredId = this.instance.state.read('groupHovered')
    const parentId = currentNode.parentId
    const nodeSize = this.instance.runtime.config.nodeSize

    if (hoveredId && hoveredId !== parentId) {
      const hovered = nodes.find((node) => node.id === hoveredId)
      if (!hovered) return

      this.applyNodePatch(session.nodeId, { parentId: hovered.id })

      const groupRect = getNodeAABB(hovered, nodeSize)
      const children = getGroupDescendants(nodes, hovered.id)
      const virtualNode: Node = {
        ...currentNode,
        position: finalPos
      }
      const contentRect = getNodesBoundingRect([...children, virtualNode], nodeSize)
      if (!contentRect) return

      const padding =
        hovered.data && typeof hovered.data.padding === 'number'
          ? hovered.data.padding
          : this.instance.runtime.config.node.groupPadding
      const expanded = expandGroupRect(groupRect, contentRect, padding)
      if (rectEquals(expanded, groupRect, DEFAULT_TUNING.group.rectEpsilon)) return

      this.applyNodePatch(hovered.id, {
        position: { x: expanded.x, y: expanded.y },
        size: { width: expanded.width, height: expanded.height }
      })
      return
    }

    if (!hoveredId && parentId) {
      const parent = nodes.find((node) => node.id === parentId)
      if (!parent) return

      const nodeRect = {
        x: finalPos.x,
        y: finalPos.y,
        width: session.size.width,
        height: session.size.height
      }
      const parentRect = getNodeAABB(parent, nodeSize)
      if (!rectContains(parentRect, nodeRect)) {
        this.applyNodePatch(session.nodeId, { parentId: undefined })
      }
    }
  }

  start = ({ nodeId, pointer }: NodeDragStartOptions) => {
    if (this.session) return false
    if (this.instance.state.read('nodeDrag').active) return false
    if (this.instance.state.read('tool') !== 'select') return false

    const node = this.getCanvasNodes().find((item) => item.id === nodeId)
    if (!node) return false

    const size = {
      width: node.size?.width ?? this.instance.runtime.config.nodeSize.width,
      height: node.size?.height ?? this.instance.runtime.config.nodeSize.height
    }
    const origin = {
      x: node.position.x,
      y: node.position.y
    }

    this.setHoveredGroup(undefined)
    this.session = {
      pointerId: pointer.pointerId,
      nodeId: node.id,
      nodeType: node.type,
      start: {
        x: pointer.client.x,
        y: pointer.client.y
      },
      origin,
      last: origin,
      size,
      children:
        node.type === 'group'
          ? this.buildGroupChildren(this.getCanvasNodes(), node.id, origin)
          : undefined
    }
    this.setDragState({
      pointerId: pointer.pointerId,
      nodeId: node.id,
      nodeType: node.type
    })

    return true
  }

  update = ({ pointer }: NodeDragUpdateOptions) => {
    const session = this.session
    if (!session || session.pointerId !== pointer.pointerId) return false

    this.instance.state.batchFrame(() => {
      const zoom = Math.max(
        this.instance.runtime.viewport.getZoom(),
        DEFAULT_INTERNALS.zoomEpsilon
      )
      let nextPosition = {
        x: session.origin.x + (pointer.client.x - session.start.x) / zoom,
        y: session.origin.y + (pointer.client.y - session.start.y) / zoom
      }
      nextPosition = this.resolveMove({
        nodeId: session.nodeId,
        position: nextPosition,
        size: session.size,
        childrenIds: session.children?.ids,
        allowCross: pointer.modifiers.alt
      })

      if (session.children) {
        this.moveGroup(session, nextPosition)
      } else {
        this.movePlain(session, nextPosition)
      }

      session.last = nextPosition
    })
    return true
  }

  end = ({ pointer }: NodeDragEndOptions) => {
    const session = this.session
    if (!session || session.pointerId !== pointer.pointerId) return false

    const finalPos = session.last
    if (session.children) {
      this.transient.commitOverrides(
        this.buildGroupUpdates(session, finalPos)
      )
    } else {
      this.transient.commitOverrides([
        { id: session.nodeId, position: finalPos }
      ])
      this.handleDropToGroup(session, finalPos)
    }

    this.finish()
    return true
  }

  cancel = (options?: NodeDragCancelOptions) => {
    const session = this.session
    if (!session) return false
    if (options?.pointer && session.pointerId !== options.pointer.pointerId) {
      return false
    }

    const ids = [session.nodeId, ...(session.children?.ids ?? [])]
    this.transient.clearOverrides(ids)
    this.finish()
    return true
  }
}
