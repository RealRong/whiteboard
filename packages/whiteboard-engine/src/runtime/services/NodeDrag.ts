import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance'
import type { NodeDrag as NodeDragApi } from '@engine-types/instance/services'
import type { NodeViewUpdate } from '@engine-types/state'
import {
  findSmallestGroupAtPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  expandGroupRect,
  rectEquals
} from '../../node/utils/group'
import { getNodeAABB, rectContains } from '../../infra/geometry'
import { computeSnap } from '../../node/utils/snap'

const MIN_ZOOM = 0.0001

type DragChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
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

export class NodeDrag implements NodeDragApi {
  private readonly instance: Instance
  private session: DragSession | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  private getCanvasNodes = () => this.instance.state.read('canvasNodes')

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
    this.instance.commands.transient.dragGuides.clear()
  }

  private finish = () => {
    this.clearGuides()
    this.setHoveredGroup(undefined)
    this.session = null
    this.setDragState(undefined)
  }

  private applyNodePatch = (nodeId: NodeId, patch: NodePatch) => {
    void this.instance.runtime.core.dispatch({ type: 'node.update', id: nodeId, patch })
  }

  private buildGroupChildren = (groupNodes: Node[], nodeId: NodeId, origin: Point): DragChildren | undefined => {
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

    const zoom = Math.max(this.instance.runtime.viewport.getZoom(), MIN_ZOOM)
    const nodeConfig = this.instance.runtime.config.node
    const thresholdWorld = Math.min(nodeConfig.snapThresholdScreen / zoom, nodeConfig.snapMaxThresholdWorld)
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
    const baseCandidates = this.instance.query.getSnapCandidatesInRect(queryRect)
    const excludeSet = childrenIds?.length ? new Set([nodeId, ...childrenIds]) : new Set([nodeId])
    const candidates = baseCandidates.filter((candidate) => !excludeSet.has(candidate.id))

    const result = computeSnap(movingRect, candidates, thresholdWorld, nodeId, {
      allowCross,
      crossThreshold: thresholdWorld * 0.6
    })
    this.instance.commands.transient.dragGuides.set(result.guides)

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
    this.setHoveredGroup(hovered?.id)

    this.instance.commands.transient.nodeOverrides.set([
      { id: session.nodeId, position: nextPosition }
    ])
  }

  private moveGroup = (session: DragSession, nextPosition: Point) => {
    const updates = this.buildGroupUpdates(session, nextPosition)
    this.instance.commands.transient.nodeOverrides.set(updates)
    this.setHoveredGroup(undefined)
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
      if (rectEquals(expanded, groupRect)) return

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

  start: NodeDragApi['start'] = ({ nodeId, pointerId, clientX, clientY }) => {
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
      pointerId,
      nodeId: node.id,
      nodeType: node.type,
      start: { x: clientX, y: clientY },
      origin,
      last: origin,
      size,
      children:
        node.type === 'group'
          ? this.buildGroupChildren(this.getCanvasNodes(), node.id, origin)
          : undefined
    }
    this.setDragState({
      pointerId,
      nodeId: node.id,
      nodeType: node.type
    })

    return true
  }

  update: NodeDragApi['update'] = ({ pointerId, clientX, clientY, altKey }) => {
    const session = this.session
    if (!session || session.pointerId !== pointerId) return false

    const zoom = Math.max(this.instance.runtime.viewport.getZoom(), MIN_ZOOM)
    let nextPosition = {
      x: session.origin.x + (clientX - session.start.x) / zoom,
      y: session.origin.y + (clientY - session.start.y) / zoom
    }
    nextPosition = this.resolveMove({
      nodeId: session.nodeId,
      position: nextPosition,
      size: session.size,
      childrenIds: session.children?.ids,
      allowCross: altKey
    })

    if (session.children) {
      this.moveGroup(session, nextPosition)
    } else {
      this.movePlain(session, nextPosition)
    }

    session.last = nextPosition
    return true
  }

  end: NodeDragApi['end'] = ({ pointerId }) => {
    const session = this.session
    if (!session || session.pointerId !== pointerId) return false

    const finalPos = session.last
    if (session.children) {
      this.instance.commands.transient.nodeOverrides.commit(
        this.buildGroupUpdates(session, finalPos)
      )
    } else {
      this.instance.commands.transient.nodeOverrides.commit([
        { id: session.nodeId, position: finalPos }
      ])
      this.handleDropToGroup(session, finalPos)
    }

    this.finish()
    return true
  }

  cancel: NodeDragApi['cancel'] = (options) => {
    const session = this.session
    if (!session) return false
    if (typeof options?.pointerId === 'number' && session.pointerId !== options.pointerId) {
      return false
    }

    const ids = [session.nodeId, ...(session.children?.ids ?? [])]
    this.instance.commands.transient.nodeOverrides.clear(ids)
    this.finish()
    return true
  }

  dispose: NodeDragApi['dispose'] = () => {
    if (!this.session) {
      this.clearGuides()
      this.setHoveredGroup(undefined)
      this.setDragState(undefined)
      return
    }
    this.finish()
  }
}
