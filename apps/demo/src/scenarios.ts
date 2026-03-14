import type { Document, Edge, MindmapTree, Node } from '@whiteboard/core/types'
import { createDocument } from '@whiteboard/core/types'

type Scenario = {
  id: string
  label: string
  description: string
  create: () => Document
}

const toCollection = <T extends { id: string }>(items: T[]) => ({
  entities: Object.fromEntries(items.map((item) => [item.id, item])),
  order: items.map((item) => item.id)
})

const createBaseDocument = (id: string, nodes: Node[], edges: Edge[]): Document => ({
  ...createDocument(id),
  nodes: toCollection(nodes),
  edges: toCollection(edges)
})

const createBasicDocument = (): Document => {
  const groupId = 'group-1'
  const nodes: Node[] = [
    {
      id: groupId,
      type: 'group',
      position: { x: -260, y: -160 },
      size: { width: 620, height: 380 },
      data: { title: '基础分组', collapsed: false, autoFit: 'expand-only', padding: 24 }
    },
    {
      id: 'node-1',
      type: 'rect',
      position: { x: -200, y: -80 },
      size: { width: 160, height: 100 },
      parentId: groupId,
      data: { title: 'Start' }
    },
    {
      id: 'node-2',
      type: 'rect',
      position: { x: 140, y: -40 },
      size: { width: 180, height: 120 },
      parentId: groupId,
      data: { title: 'Process' }
    },
    {
      id: 'node-3',
      type: 'text',
      position: { x: -120, y: 140 },
      size: { width: 200, height: 120 },
      parentId: groupId,
      data: { text: '双击编辑文本' }
    },
    {
      id: 'node-4',
      type: 'sticky',
      position: { x: 200, y: 160 },
      size: { width: 160, height: 120 },
      data: { text: 'Sticky 便签' }
    }
  ]

  const edges: Edge[] = [
    {
      id: 'edge-1',
      type: 'linear',
      source: { nodeId: 'node-1' },
      target: { nodeId: 'node-2' }
    },
    {
      id: 'edge-2',
      type: 'linear',
      source: { nodeId: 'node-2' },
      target: { nodeId: 'node-3' }
    }
  ]

  return createBaseDocument('demo-basic', nodes, edges)
}

const createDenseDocument = (): Document => {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const rows = 18
  const cols = 22
  const size = { width: 120, height: 70 }
  const gapX = 150
  const gapY = 110

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const id = `grid-${row}-${col}`
      nodes.push({
        id,
        type: 'rect',
        position: {
          x: col * gapX - (cols * gapX) / 2,
          y: row * gapY - (rows * gapY) / 2
        },
        size,
        data: { title: `${row + 1}-${col + 1}` }
      })
    }
  }

  const linkEvery = 4
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row + col) % linkEvery !== 0) continue
      const sourceId = `grid-${row}-${col}`
      const targetCol = col + 1
      if (targetCol >= cols) continue
      edges.push({
        id: `edge-${row}-${col}`,
        type: 'linear',
        source: { nodeId: sourceId },
        target: { nodeId: `grid-${row}-${targetCol}` }
      })
    }
  }

  return createBaseDocument('demo-dense', nodes, edges)
}

const createMindmapDocument = (): Document => {
  const tree: MindmapTree = {
    id: 'mindmap-root',
    rootId: 'mm-1',
    nodes: {
      'mm-1': { id: 'mm-1', data: { kind: 'text', text: '核心议题' } },
      'mm-2': { id: 'mm-2', parentId: 'mm-1', side: 'left', data: { kind: 'text', text: '左分支' } },
      'mm-3': { id: 'mm-3', parentId: 'mm-1', side: 'right', data: { kind: 'text', text: '右分支' } },
      'mm-4': { id: 'mm-4', parentId: 'mm-2', data: { kind: 'text', text: '子节点 A' } },
      'mm-5': { id: 'mm-5', parentId: 'mm-2', data: { kind: 'text', text: '子节点 B' } },
      'mm-6': { id: 'mm-6', parentId: 'mm-3', data: { kind: 'text', text: '子节点 C' } },
      'mm-7': { id: 'mm-7', parentId: 'mm-3', data: { kind: 'text', text: '子节点 D' } }
    },
    children: {
      'mm-1': ['mm-2', 'mm-3'],
      'mm-2': ['mm-4', 'mm-5'],
      'mm-3': ['mm-6', 'mm-7'],
      'mm-4': [],
      'mm-5': [],
      'mm-6': [],
      'mm-7': []
    },
    meta: {
      position: { x: 0, y: 0 }
    }
  }

  const nodes: Node[] = [
    {
      id: 'mindmap-root',
      type: 'mindmap',
      position: { x: -80, y: -60 },
      size: { width: 200, height: 140 },
      data: { mindmap: tree }
    },
    {
      id: 'note-1',
      type: 'sticky',
      position: { x: 420, y: -120 },
      size: { width: 180, height: 120 },
      data: { text: '拖拽思维导图节点' }
    }
  ]

  return createBaseDocument('demo-mindmap', nodes, [])
}

const createShapesDocument = (): Document => {
  const nodes: Node[] = [
    {
      id: 'shape-ellipse',
      type: 'ellipse',
      position: { x: -420, y: -140 },
      size: { width: 200, height: 130 },
      data: { title: 'Entry' }
    },
    {
      id: 'shape-diamond',
      type: 'diamond',
      position: { x: -110, y: -150 },
      size: { width: 180, height: 180 },
      data: { title: 'Decision' }
    },
    {
      id: 'shape-triangle',
      type: 'triangle',
      position: { x: 170, y: -130 },
      size: { width: 190, height: 160 },
      data: { title: 'Alert' }
    },
    {
      id: 'shape-arrow',
      type: 'arrow-sticker',
      position: { x: 450, y: -120 },
      size: { width: 220, height: 120 },
      data: { title: 'Ship it' }
    },
    {
      id: 'shape-callout',
      type: 'callout',
      position: { x: -260, y: 120 },
      size: { width: 280, height: 160 },
      data: { text: '新节点已经接入默认 registry，可直接拖拽、缩放、旋转、连线。' }
    },
    {
      id: 'shape-highlight',
      type: 'highlight',
      position: { x: 120, y: 170 },
      size: { width: 240, height: 110 },
      data: { text: 'Highlight' }
    }
  ]

  const edges: Edge[] = [
    {
      id: 'shape-edge-1',
      type: 'linear',
      source: { nodeId: 'shape-ellipse' },
      target: { nodeId: 'shape-diamond' }
    },
    {
      id: 'shape-edge-2',
      type: 'linear',
      source: { nodeId: 'shape-diamond' },
      target: { nodeId: 'shape-triangle' }
    },
    {
      id: 'shape-edge-3',
      type: 'linear',
      source: { nodeId: 'shape-triangle' },
      target: { nodeId: 'shape-arrow' }
    },
    {
      id: 'shape-edge-4',
      type: 'linear',
      source: { nodeId: 'shape-callout' },
      target: { nodeId: 'shape-diamond' }
    },
    {
      id: 'shape-edge-5',
      type: 'linear',
      source: { nodeId: 'shape-highlight' },
      target: { nodeId: 'shape-arrow' }
    }
  ]

  return createBaseDocument('demo-shapes', nodes, edges)
}

export const scenarios: Scenario[] = [
  {
    id: 'basic',
    label: '基础流程',
    description: '常规节点 + 连线 + 分组',
    create: createBasicDocument
  },
  {
    id: 'dense',
    label: '超多节点',
    description: '大规模节点渲染压力测试',
    create: createDenseDocument
  },
  {
    id: 'mindmap',
    label: '思维导图',
    description: '内置 Mindmap 树与交互',
    create: createMindmapDocument
  },
  {
    id: 'shapes',
    label: '图形节点',
    description: '第一批 shape / sticker 节点',
    create: createShapesDocument
  }
]

export type { Scenario }
