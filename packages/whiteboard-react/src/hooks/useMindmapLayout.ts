import { useMemo } from 'react'
import { layoutMindmap, layoutMindmapTidy, type MindmapLayout, type MindmapLayoutOptions, type MindmapTree } from '@whiteboard/core'
import type { MindmapLayoutMode, Size } from '../types'

type UseMindmapLayoutOptions = {
  tree: MindmapTree
  nodeSize: Size
  mode?: MindmapLayoutMode
  options?: MindmapLayoutOptions
}

export const useMindmapLayout = ({ tree, nodeSize, mode = 'simple', options }: UseMindmapLayoutOptions): MindmapLayout => {
  const hGap = options?.hGap
  const vGap = options?.vGap
  const side = options?.side

  return useMemo(() => {
    const getNodeSize = () => nodeSize
    const layoutFn = mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
    return layoutFn(tree, getNodeSize, options)
  }, [tree, nodeSize.width, nodeSize.height, mode, hGap, vGap, side])
}
