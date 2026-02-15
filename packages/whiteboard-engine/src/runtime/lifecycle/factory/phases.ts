import type { Instance } from '@engine-types/instance'
import {
  createEdgeBindings,
  createMindmap,
  createNodeBindings,
  createSelection,
  type CanvasEventHandlers,
  type SelectionBoxSession
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
  createBindingContext,
  createSharedContext
} from './context'

type Options = {
  instance: Instance
  getHandlers: () => CanvasEventHandlers
  getOnWheel: () => (event: WheelEvent) => void
  getSelectionBox: () => SelectionBoxSession
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

  const edgeBindings = createEdgeBindings(instance)
  const nodeBindings = createNodeBindings(instance)
  const mindmapBinding = createMindmap(instance)
  const selectionBindings = createSelection({
    instance,
    getSelectionBox
  })

  const window = new Bindings({
    bindings: [
      edgeBindings.edgeConnect,
      edgeBindings.routingDrag,
      nodeBindings.nodeDrag,
      nodeBindings.nodeTransform,
      mindmapBinding,
      selectionBindings.selectionBox
    ]
  })

  const configApply = new ConfigApply({
    instance,
    resetInput,
    selectionCallbacks: selectionBindings.selectionCallbacks,
    history
  })
  const runtimeEffects = new RuntimeEffects({
    instance,
    window,
    container
  })
  const startContext = {
    shared: createSharedContext({
      history,
      container,
      windowKey,
      autoFit
    }),
    bindings: createBindingContext({
      selectionCallbacks: selectionBindings.selectionCallbacks,
      window
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
