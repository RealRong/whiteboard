import type { Instance } from '@engine-types/instance'
import type { ShortcutContext, ShortcutNativeEvent } from '@engine-types/shortcuts'
import { resolveShortcutContextFromEvent } from './contextFromEvent'

export type ShortcutContextResolver = (event: ShortcutNativeEvent) => ShortcutContext

export const createShortcutContextResolver = (instance: Instance): ShortcutContextResolver => {
  const readBaseContext = () => instance.view.read('shortcut.context')
  return (event) => resolveShortcutContextFromEvent(readBaseContext(), event)
}

