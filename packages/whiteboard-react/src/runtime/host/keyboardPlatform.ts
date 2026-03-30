import type { ShortcutPlatform } from '@whiteboard/editor'

export const detectShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === 'undefined') {
    return 'win'
  }

  const value = navigator.platform.toLowerCase()
  if (value.includes('mac')) return 'mac'
  if (value.includes('win')) return 'win'
  return 'linux'
}
