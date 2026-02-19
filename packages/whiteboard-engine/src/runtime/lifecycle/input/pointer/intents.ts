import type { PointerInput } from '@engine-types/common'
import type { Size } from '@whiteboard/core'
import type { LifecycleContext } from '../../../../context'

export type PointerIntent =
  | {
      type: 'edge-connect.updateTo'
      pointer: PointerInput
    }
  | {
      type: 'edge-connect.commitTo'
      pointer: PointerInput
    }
  | {
      type: 'routing-drag.update'
      pointer: PointerInput
    }
  | {
      type: 'routing-drag.end'
      pointer: PointerInput
    }
  | {
      type: 'routing-drag.cancel'
      pointer: PointerInput
    }
  | {
      type: 'node-drag.update'
      pointer: PointerInput
    }
  | {
      type: 'node-drag.end'
      pointer: PointerInput
    }
  | {
      type: 'node-drag.cancel'
      pointer: PointerInput
    }
  | {
      type: 'node-transform.update'
      pointer: PointerInput
      minSize: Size
    }
  | {
      type: 'node-transform.end'
      pointer: PointerInput
    }
  | {
      type: 'node-transform.cancel'
      pointer: PointerInput
    }
  | {
      type: 'mindmap-drag.update'
      pointer: PointerInput
    }
  | {
      type: 'mindmap-drag.end'
      pointer: PointerInput
    }
  | {
      type: 'mindmap-drag.cancel'
      pointer: PointerInput
    }

export type PointerIntentDispatcher = (intent: PointerIntent) => void

export const createPointerIntentDispatcher = (
  context: LifecycleContext
): PointerIntentDispatcher => {
  return (intent) => {
    switch (intent.type) {
      case 'edge-connect.updateTo': {
        context.runtime.interaction.edgeConnect.updateTo(intent.pointer)
        return
      }
      case 'edge-connect.commitTo': {
        context.runtime.interaction.edgeConnect.commitTo(intent.pointer)
        return
      }
      case 'routing-drag.update': {
        context.runtime.interaction.routingDrag.update({ pointer: intent.pointer })
        return
      }
      case 'routing-drag.end': {
        context.runtime.interaction.routingDrag.end({ pointer: intent.pointer })
        return
      }
      case 'routing-drag.cancel': {
        context.runtime.interaction.routingDrag.cancel({ pointer: intent.pointer })
        return
      }
      case 'node-drag.update': {
        context.runtime.interaction.nodeDrag.update({ pointer: intent.pointer })
        return
      }
      case 'node-drag.end': {
        context.runtime.interaction.nodeDrag.end({ pointer: intent.pointer })
        return
      }
      case 'node-drag.cancel': {
        context.runtime.interaction.nodeDrag.cancel({ pointer: intent.pointer })
        return
      }
      case 'node-transform.update': {
        context.runtime.interaction.nodeTransform.update({
          pointer: intent.pointer,
          minSize: intent.minSize
        })
        return
      }
      case 'node-transform.end': {
        context.runtime.interaction.nodeTransform.end({ pointer: intent.pointer })
        return
      }
      case 'node-transform.cancel': {
        context.runtime.interaction.nodeTransform.cancel({ pointer: intent.pointer })
        return
      }
      case 'mindmap-drag.update': {
        context.runtime.interaction.mindmapDrag.update({ pointer: intent.pointer })
        return
      }
      case 'mindmap-drag.end': {
        context.runtime.interaction.mindmapDrag.end({ pointer: intent.pointer })
        return
      }
      case 'mindmap-drag.cancel': {
        context.runtime.interaction.mindmapDrag.cancel({ pointer: intent.pointer })
        return
      }
    }
  }
}
