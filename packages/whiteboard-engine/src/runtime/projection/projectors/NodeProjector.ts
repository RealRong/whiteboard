import type {
  Document,
  NodeId
} from '@whiteboard/core/types'
import type {
  ProjectionNodesSlice
} from '@engine-types/projection'
import type { NodeOverride } from '../cache/NodeOverride'
import { ViewNodesState } from '../cache/ViewNodesState'
import { orderByIds } from '../cache/shared'
import {
  deriveCanvasNodes,
  deriveVisibleNodes
} from '../../actors/node/domain'

type NodeProjectInput = {
  doc: Document
  overrides: Map<NodeId, NodeOverride>
}

export class NodeProjector {
  private readonly viewNodesState = new ViewNodesState()

  reset = () => {
    this.viewNodesState.reset()
  }

  project = ({
    doc,
    overrides
  }: NodeProjectInput): ProjectionNodesSlice => {
    const viewNodes = this.viewNodesState.update(
      doc,
      overrides
    ).cache

    const nodeOrder = doc.order?.nodes ?? doc.nodes.map((node) => node.id)
    const orderedViewNodes = orderByIds(viewNodes.nodes, nodeOrder)
    const visible = deriveVisibleNodes(orderedViewNodes)
    const canvas = deriveCanvasNodes(visible)
    return {
      visible,
      canvas
    }
  }
}
