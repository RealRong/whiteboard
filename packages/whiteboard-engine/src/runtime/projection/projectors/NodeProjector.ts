import type {
  Document
} from '@whiteboard/core/types'
import type {
  ProjectionNodesSlice
} from '@engine-types/projection'
import { ViewNodesState } from '../cache/ViewNodesState'
import { orderByIds } from '../cache/shared'
import {
  deriveCanvasNodes,
  deriveVisibleNodes
} from '@whiteboard/core/node'

type NodeProjectInput = {
  doc: Document
}

export class NodeProjector {
  private readonly viewNodesState = new ViewNodesState()

  reset = () => {
    this.viewNodesState.reset()
  }

  project = ({
    doc
  }: NodeProjectInput): ProjectionNodesSlice => {
    const viewNodes = this.viewNodesState.update(doc).cache

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
