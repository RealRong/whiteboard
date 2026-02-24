import type { Document, Node } from '@whiteboard/core/types'
import type { ProjectionEdgesSlice } from '@engine-types/projection'
import { VisibleEdgesState } from '../cache/VisibleEdgesState'

type EdgeProjectInput = {
  doc: Document
  canvasNodes: Node[]
}

export class EdgeProjector {
  private readonly visibleEdgesState = new VisibleEdgesState()

  reset = () => {
    this.visibleEdgesState.reset()
  }

  project = ({ doc, canvasNodes }: EdgeProjectInput): ProjectionEdgesSlice => {
    return {
      visible: this.visibleEdgesState.resolve(doc, canvasNodes)
    }
  }
}
