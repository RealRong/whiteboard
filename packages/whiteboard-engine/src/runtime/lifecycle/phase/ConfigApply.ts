import type { Instance } from '@engine-types/instance'
import type { LifecycleConfig } from '@engine-types/instance'
import type { SelectionCallbacksBinding } from '../bindings'
import type { History } from '../history'

type Options = {
  instance: Instance
  resetInput: () => void
  selectionCallbacks: SelectionCallbacksBinding
  history: History
}

export class ConfigApply {
  private instance: Instance
  private resetInput: () => void
  private selectionCallbacks: SelectionCallbacksBinding
  private history: History

  constructor(options: Options) {
    this.instance = options.instance
    this.resetInput = options.resetInput
    this.selectionCallbacks = options.selectionCallbacks
    this.history = options.history
  }

  apply = (config: LifecycleConfig) => {
    this.resetInput()
    this.selectionCallbacks.update({
      onSelectionChange: config.onSelectionChange,
      onEdgeSelectionChange: config.onEdgeSelectionChange
    })
    this.history.update(config)

    this.instance.commands.tool.set(config.tool)
    this.instance.runtime.viewport.setViewport(config.viewport)
    this.instance.runtime.shortcuts.setShortcuts(config.shortcuts)
    this.instance.state.write('mindmapLayout', config.mindmapLayout ?? {})
  }
}
