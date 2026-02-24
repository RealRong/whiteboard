import type { InstanceConfig } from '@engine-types/instance/config'
import type { NodeViewUpdate } from '@engine-types/projection'
import type {
  Document,
  Node,
  NodeId,
  NodePatch,
  Operation,
  Point
} from '@whiteboard/core/types'
import { getNodeAABB, isPointEqual, isSizeEqual, rectContains } from '@whiteboard/core/geometry'
import {
  expandGroupRect,
  getGroupDescendants,
  getNodesBoundingRect,
  rectEquals
} from '@whiteboard/core/node'
import { DEFAULT_TUNING } from '../../../../config'
import type { NodeDragSession } from './SessionStore'

type CompilerOptions = {
  readDoc: () => Document
  readCanvasNodes: () => Node[]
  config: Pick<InstanceConfig, 'node' | 'nodeSize'>
}

type CompileInput = {
  session: NodeDragSession
  finalPosition: Point
  updates: NodeViewUpdate[]
  hoveredGroupId?: NodeId
}

const hasParentIdPatch = (patch: NodePatch): patch is NodePatch & { parentId: NodeId | undefined } =>
  Object.prototype.hasOwnProperty.call(patch, 'parentId')

const toNodeById = (nodes: Node[]) =>
  new Map(nodes.map((node) => [node.id, node]))

export class CommitCompiler {
  private readonly readDoc: CompilerOptions['readDoc']
  private readonly readCanvasNodes: CompilerOptions['readCanvasNodes']
  private readonly config: CompilerOptions['config']

  constructor(options: CompilerOptions) {
    this.readDoc = options.readDoc
    this.readCanvasNodes = options.readCanvasNodes
    this.config = options.config
  }

  compile = ({
    session,
    finalPosition,
    updates,
    hoveredGroupId
  }: CompileInput): Operation[] => {
    const patches = new Map<NodeId, NodePatch>()
    updates.forEach((update) => {
      const patch: NodePatch = {}
      if (update.position) patch.position = update.position
      if (update.size) patch.size = update.size
      this.mergePatch(patches, update.id, patch)
    })

    if (!session.children && session.nodeType !== 'group') {
      this.appendDropToGroupPatch(
        patches,
        session,
        finalPosition,
        hoveredGroupId
      )
    }

    return this.toOperations(patches)
  }

  private mergePatch = (
    patches: Map<NodeId, NodePatch>,
    id: NodeId,
    patch: NodePatch
  ) => {
    if (!Object.keys(patch).length) return
    const prev = patches.get(id)
    patches.set(id, prev ? { ...prev, ...patch } : { ...patch })
  }

  private appendDropToGroupPatch = (
    patches: Map<NodeId, NodePatch>,
    session: NodeDragSession,
    finalPosition: Point,
    hoveredGroupId?: NodeId
  ) => {
    const nodes = this.readCanvasNodes()
    const nodeById = toNodeById(nodes)
    const currentNode = nodeById.get(session.nodeId)
    if (!currentNode) return

    const parentId = currentNode.parentId

    if (hoveredGroupId && hoveredGroupId !== parentId) {
      const hovered = nodeById.get(hoveredGroupId)
      if (!hovered) return

      this.mergePatch(patches, session.nodeId, { parentId: hovered.id })

      const groupRect = getNodeAABB(hovered, this.config.nodeSize)
      const children = getGroupDescendants(nodes, hovered.id)
      const virtualNode: Node = {
        ...currentNode,
        position: finalPosition
      }
      const contentRect = getNodesBoundingRect(
        [...children, virtualNode],
        this.config.nodeSize
      )
      if (!contentRect) return

      const padding = (
        hovered.data &&
        typeof hovered.data.padding === 'number'
      )
        ? hovered.data.padding
        : this.config.node.groupPadding
      const expanded = expandGroupRect(groupRect, contentRect, padding)
      if (rectEquals(expanded, groupRect, DEFAULT_TUNING.group.rectEpsilon)) {
        return
      }

      this.mergePatch(patches, hovered.id, {
        position: {
          x: expanded.x,
          y: expanded.y
        },
        size: {
          width: expanded.width,
          height: expanded.height
        }
      })
      return
    }

    if (!hoveredGroupId && parentId) {
      const parentNode = nodeById.get(parentId)
      if (!parentNode) return

      const nodeRect = {
        x: finalPosition.x,
        y: finalPosition.y,
        width: session.size.width,
        height: session.size.height
      }
      const parentRect = getNodeAABB(parentNode, this.config.nodeSize)
      if (!rectContains(parentRect, nodeRect)) {
        this.mergePatch(patches, session.nodeId, { parentId: undefined })
      }
    }
  }

  private normalizePatch = (
    currentNode: Node,
    patch: NodePatch
  ): NodePatch | undefined => {
    const normalized: NodePatch = {}

    if (patch.position && !isPointEqual(patch.position, currentNode.position)) {
      normalized.position = patch.position
    }
    if (patch.size && !isSizeEqual(patch.size, currentNode.size)) {
      normalized.size = patch.size
    }
    if (
      hasParentIdPatch(patch) &&
      patch.parentId !== currentNode.parentId
    ) {
      normalized.parentId = patch.parentId
    }

    return Object.keys(normalized).length ? normalized : undefined
  }

  private toOperations = (patches: Map<NodeId, NodePatch>): Operation[] => {
    if (!patches.size) return []

    const doc = this.readDoc()
    const nodeById = toNodeById(doc.nodes)
    const operations: Operation[] = []
    patches.forEach((patch, id) => {
      const currentNode = nodeById.get(id)
      if (!currentNode) return
      const normalized = this.normalizePatch(currentNode, patch)
      if (!normalized) return
      operations.push({
        type: 'node.update',
        id,
        patch: normalized
      })
    })

    return operations
  }
}
