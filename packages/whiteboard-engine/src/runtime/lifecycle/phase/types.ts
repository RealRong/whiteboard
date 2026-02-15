import type { SelectionCallbacksBinding, Bindings } from '../bindings'
import type { Cleanup } from '../cleanup'
import type { Container } from '../container'
import type { AutoFit } from '../group'
import type { History } from '../history'
import type { WindowKey } from '../keyboard'

export type SharedContext = {
  history: History
  container: Container
  windowKey: WindowKey
  autoFit: AutoFit
}

export type BindingsContext = {
  selectionCallbacks: SelectionCallbacksBinding
  window: Bindings
}

export type StartContext = {
  shared: SharedContext
  bindings: BindingsContext
}

export type StopContext = StartContext & {
  cancelInput: () => void
  cleanup: Cleanup
}
