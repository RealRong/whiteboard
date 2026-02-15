import type { Instance } from '@engine-types/instance'
import type { ShortcutContext, ShortcutNativeEvent } from '@engine-types/shortcuts'
import { resolveContextFromEvent } from './contextFromEvent'

export type ContextResolver = (event: ShortcutNativeEvent) => ShortcutContext

export const createContextResolver = (instance: Instance): ContextResolver => {
  const readBaseContext = () => instance.view.read('shortcut.context')
  return (event) => resolveContextFromEvent(readBaseContext(), event)
}
