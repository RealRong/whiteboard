import type { Viewport } from '@whiteboard/core/types'
import type { InternalEditor } from '../instance'

export const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

export type ViewportRuntime = InternalEditor['internals']['viewport']
export type ViewportRead = InternalEditor['viewport']
export type ViewportCommands = InternalEditor['commands']['viewport']
export type ViewportInputRuntime = ViewportRuntime['input']
export type ViewportPointer = ReturnType<ViewportRead['pointer']>
export type { ViewportInputOptions } from './useBindViewportInput'
export { useBindViewportInput } from './useBindViewportInput'
