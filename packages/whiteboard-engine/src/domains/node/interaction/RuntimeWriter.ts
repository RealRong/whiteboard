import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  RuntimeOutput
} from './RuntimeOutput'
import { writeInteractionSession } from '../shared/interactionSession'
import { InteractionWriter } from '../writer/InteractionWriter'

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

export class RuntimeWriter extends InteractionWriter<RuntimeOutput> {
  private readonly state: WriterOptions['instance']['state']

  constructor({ instance }: WriterOptions) {
    super(instance)
    this.state = instance.state
  }

  apply = (output: RuntimeOutput) => {
    this.inRenderBatch(output, () => {
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
        writeInteractionSession(
          this.render,
          output.interaction.kind,
          output.interaction.pointerId
        )
      }

      if ('groupHover' in output) {
        this.render.write('groupHover', {
          nodeId: output.groupHover
        })
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
