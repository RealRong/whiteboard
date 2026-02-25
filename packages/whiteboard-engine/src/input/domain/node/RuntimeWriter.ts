import type { InternalInstance } from '@engine-types/instance/instance'
import type { Operation } from '@whiteboard/core/types'
import type {
  RuntimeOutput
} from './RuntimeOutput'

type WriterOptions = {
  instance: Pick<InternalInstance, 'state' | 'render' | 'mutate'>
}

const isSameSet = <T,>(left: Set<T>, right: Set<T>) => {
  if (left.size !== right.size) return false
  for (const value of left) {
    if (!right.has(value)) return false
  }
  return true
}

export class RuntimeWriter {
  private readonly state: WriterOptions['instance']['state']
  private readonly render: WriterOptions['instance']['render']
  private readonly mutate: WriterOptions['instance']['mutate']

  constructor({ instance }: WriterOptions) {
    this.state = instance.state
    this.render = instance.render
    this.mutate = instance.mutate
  }

  private submitMutations = (operations: Operation[]) => {
    if (!operations.length) return
    void this.mutate(operations, 'interaction')
  }

  private writeInteractionSession = (
    kind: 'nodeDrag' | 'nodeTransform',
    pointerId: number | null
  ) => {
    this.render.write('interactionSession', (prev) => {
      if (pointerId === null) {
        if (prev.active?.kind !== kind) return prev
        return {}
      }
      if (
        prev.active?.kind === kind &&
        prev.active.pointerId === pointerId
      ) {
        return prev
      }
      return {
        active: {
          kind,
          pointerId
        }
      }
    })
  }

  apply = (output: RuntimeOutput) => {
    const runBatch = output.frame
      ? this.render.batchFrame
      : this.render.batch
    runBatch(() => {
      const selection = output.selection
      if (selection) {
        this.state.write('selection', (prev) => {
          let changed = false
          const next = { ...prev }
          if (selection.selectedNodeIds) {
            if (!isSameSet(prev.selectedNodeIds, selection.selectedNodeIds)) {
              next.selectedNodeIds = new Set(selection.selectedNodeIds)
              changed = true
            }
          }
          if ('selectedEdgeId' in selection) {
            if (prev.selectedEdgeId !== selection.selectedEdgeId) {
              next.selectedEdgeId = selection.selectedEdgeId
              changed = true
            }
          }
          if ('groupHovered' in selection) {
            if (prev.groupHovered !== selection.groupHovered) {
              next.groupHovered = selection.groupHovered
              changed = true
            }
          }
          if ('mode' in selection && selection.mode) {
            if (prev.mode !== selection.mode) {
              next.mode = selection.mode
              changed = true
            }
          }
          return changed ? next : prev
        })
      }

      if (output.interaction) {
        this.writeInteractionSession(
          output.interaction.kind,
          output.interaction.pointerId
        )
      }

      if (
        output.nodePayload &&
        'drag' in output.nodePayload &&
        output.nodePayload.drag !== undefined
      ) {
        this.render.write(
          'nodeDrag',
          output.nodePayload.drag === null
            ? {}
            : { payload: output.nodePayload.drag }
        )
      }

      if (
        output.nodePayload &&
        'transform' in output.nodePayload &&
        output.nodePayload.transform !== undefined
      ) {
        this.render.write(
          'nodeTransform',
          output.nodePayload.transform === null
            ? {}
            : { payload: output.nodePayload.transform }
        )
      }

      if (output.nodePreview !== undefined) {
        this.render.write('nodePreview', {
          updates: output.nodePreview
        })
      }

      if (output.guides) {
        this.render.write('dragGuides', output.guides)
      }

      if (output.mutations?.length) {
        this.submitMutations(output.mutations)
      }
    })
  }
}
