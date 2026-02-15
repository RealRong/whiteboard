import { layoutMindmap, layoutMindmapTidy, type MindmapLayout, type MindmapNode, type MindmapTree, type Node } from '@whiteboard/core'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { WhiteboardMindmapViewTreeLine } from '@engine-types/instance'
import type { Size } from '@engine-types/common'

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export const getMindmapTree = (node: Node): MindmapTree | undefined => {
  const data = node.data as Record<string, unknown> | undefined
  if (!data) return undefined

  const direct = data as unknown as MindmapTree
  if (direct && typeof direct.rootId === 'string' && typeof direct.nodes === 'object' && typeof direct.children === 'object') {
    return direct
  }

  const nested = data.mindmap as MindmapTree | undefined
  if (nested && typeof nested.rootId === 'string') return nested

  const legacy = data.tree as MindmapTree | undefined
  if (legacy && typeof legacy.rootId === 'string') return legacy
  return undefined
}

export const getMindmapLabel = (node: MindmapNode | undefined) => {
  if (!node?.data || typeof node.data !== 'object' || !('kind' in node.data)) return 'mindmap'
  const data = node.data as { kind: string; text?: string; name?: string; title?: string; url?: string }
  switch (data.kind) {
    case 'text':
      return data.text?.trim() ? data.text : 'Text'
    case 'file':
      return data.name?.trim() ? data.name : 'File'
    case 'link':
      return data.title?.trim() ? data.title : data.url ?? 'Link'
    case 'ref':
      return data.title?.trim() ? data.title : 'Ref'
    default:
      return data.kind ?? 'mindmap'
  }
}

export const toMindmapStructureSignature = (tree: MindmapTree) => {
  const nodesSignature = Object.entries(tree.nodes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, node]) => `${id}:${node.parentId ?? ''}:${node.side ?? ''}:${safeStringify(node.data)}`)
    .join(';')

  const childrenSignature = Object.entries(tree.children)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, children]) => `${id}:${children.join(',')}`)
    .join(';')

  return `${tree.rootId}|${nodesSignature}|${childrenSignature}`
}

const computeConnectionLine = (
  parent: { x: number; y: number; width: number; height: number },
  child: { x: number; y: number; width: number; height: number },
  side?: 'left' | 'right'
) => {
  const parentCenterX = parent.x + parent.width / 2
  const parentCenterY = parent.y + parent.height / 2
  const childCenterY = child.y + child.height / 2
  if (side === 'left') {
    return {
      x1: parent.x,
      y1: parentCenterY,
      x2: child.x + child.width,
      y2: childCenterY
    }
  }
  if (side === 'right') {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  const childCenterX = child.x + child.width / 2
  if (childCenterX >= parentCenterX) {
    return {
      x1: parent.x + parent.width,
      y1: parentCenterY,
      x2: child.x,
      y2: childCenterY
    }
  }
  return {
    x1: parent.x,
    y1: parentCenterY,
    x2: child.x + child.width,
    y2: childCenterY
  }
}

export const computeMindmapLayout = (tree: MindmapTree, nodeSize: Size, layout: MindmapLayoutConfig): MindmapLayout => {
  const mode = layout.mode === 'tidy' ? 'tidy' : 'simple'
  const getNodeSize = () => nodeSize
  const layoutFn = mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
  return layoutFn(tree, getNodeSize, layout.options)
}

export const buildMindmapLines = (tree: MindmapTree, computed: MindmapLayout): WhiteboardMindmapViewTreeLine[] => {
  const result: WhiteboardMindmapViewTreeLine[] = []
  Object.entries(tree.children).forEach(([parentId, childIds]) => {
    const parent = computed.node[parentId]
    if (!parent) return
    childIds.forEach((childId) => {
      const child = computed.node[childId]
      if (!child) return
      const side = parentId === tree.rootId ? tree.nodes[childId]?.side : undefined
      const line = computeConnectionLine(parent, child, side)
      result.push({
        id: `${parentId}-${childId}`,
        x1: line.x1,
        y1: line.y1,
        x2: line.x2,
        y2: line.y2
      })
    })
  })
  return result
}
