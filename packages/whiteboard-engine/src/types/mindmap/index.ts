import type { MindmapLayoutOptions } from '@whiteboard/core'

export type MindmapLayoutMode = 'simple' | 'tidy'

export type MindmapLayoutConfig = {
  mode?: MindmapLayoutMode
  options?: MindmapLayoutOptions
}
