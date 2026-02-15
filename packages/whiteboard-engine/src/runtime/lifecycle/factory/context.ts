import type { SelectionCallbacksBinding, Bindings } from '../bindings'
import type { Container } from '../container'
import type { AutoFit } from '../group'
import type { History } from '../history'
import type { WindowKey } from '../keyboard'
import type { BindingsContext, SharedContext } from '../phase'

type SharedOptions = {
  history: History
  container: Container
  windowKey: WindowKey
  autoFit: AutoFit
}

type BindingsOptions = {
  selectionCallbacks: SelectionCallbacksBinding
  window: Bindings
}

export const createSharedContext = ({
  history,
  container,
  windowKey,
  autoFit
}: SharedOptions): SharedContext => ({
  history,
  container,
  windowKey,
  autoFit
})

export const createBindingContext = ({
  selectionCallbacks,
  window
}: BindingsOptions): BindingsContext => ({
  selectionCallbacks,
  window
})
