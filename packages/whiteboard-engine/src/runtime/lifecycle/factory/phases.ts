import type { Instance } from '@engine-types/instance'
import {
  createEdgeInputWindowBindings,
  createMindmapInputWindowBinding,
  createNodeInputWindowBindings,
  createSelectionInputBindings,
  type CanvasEventHandlers,
  type SelectionBoxSessionRuntime
} from '../input'
import { History } from '../history'
import { Container } from '../container'
import { WindowKey } from '../keyboard'
import { AutoFit } from '../group'
import { Cleanup } from '../cleanup'
import { Bindings } from '../bindings'
import {
  Start,
  Update,
  Stop,
  ConfigApply,
  RuntimeEffects
} from '../phase'
import {
  createBindingsContext,
  createSharedContext
} from './context'

type Options = {
  instance: Instance
  getHandlers: () => CanvasEventHandlers
  getOnWheel: () => (event: WheelEvent) => void
  getSelectionBox: () => SelectionBoxSessionRuntime
  resetInput: () => void
  cancelInput: () => void
}

export type Phases = {
  start: Start
  update: Update
  stop: Stop
}

export const createPhases = ({
  instance,
  getHandlers,
  getOnWheel,
  getSelectionBox,
  resetInput,
  cancelInput
}: Options): Phases => {
  const history = new History(instance)
  const container = new Container({
    instance,
    getHandlers,
    getOnWheel
  })
  const windowKey = new WindowKey(instance)
  const autoFit = new AutoFit(instance)
  const cleanup = new Cleanup(instance)

  const edgeBindings = createEdgeInputWindowBindings(instance)
  const nodeBindings = createNodeInputWindowBindings(instance)
  const mindmapBinding = createMindmapInputWindowBinding(instance)
  const selectionBindings = createSelectionInputBindings({
    instance,
    getSelectionBox
  })

  const windowBindings = new Bindings({
    bindings: [
      edgeBindings.edgeConnectWindowBinding,
      edgeBindings.edgeRoutingPointDragWindowBinding,
      nodeBindings.nodeDragWindowBinding,
      nodeBindings.nodeTransformWindowBinding,
      mindmapBinding,
      selectionBindings.selectionBoxWindowBinding
    ]
  })

  const configApply = new ConfigApply({
    instance,
    resetInput,
    selectionCallbacksBinding: selectionBindings.selectionCallbacksBinding,
    history
  })
  const runtimeEffects = new RuntimeEffects({
    instance,
    windowBindings,
    container
  })
  const startContext = {
    shared: createSharedContext({
      history,
      container,
      windowKey,
      autoFit
    }),
    bindings: createBindingsContext({
      selectionCallbacksBinding: selectionBindings.selectionCallbacksBinding,
      windowBindings
    })
  }

  return {
    start: new Start({
      context: startContext
    }),
    update: new Update({
      configApply,
      runtimeEffects
    }),
    stop: new Stop({
      context: {
        ...startContext,
        cancelInput,
        cleanup
      }
    })
  }
}
