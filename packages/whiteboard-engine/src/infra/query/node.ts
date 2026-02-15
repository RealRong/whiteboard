import type { Node } from '@whiteboard/core'

export const toLayerOrderedCanvasNodes = (nodes: Node[]) => {
  const background: Node[] = []
  const normal: Node[] = []
  const overlay: Node[] = []

  nodes.forEach((node) => {
    const layer = node.layer ?? (node.type === 'group' ? 'background' : 'default')
    if (layer === 'background') {
      background.push(node)
      return
    }
    if (layer === 'overlay') {
      overlay.push(node)
      return
    }
    normal.push(node)
  })

  return [...background, ...normal, ...overlay]
}

export const getMindmapRoots = (nodes: Node[]) => nodes.filter((node) => node.type === 'mindmap')
