import type {
  MindmapDragView,
  MindmapViewTree,
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { GraphSnapshot } from '@engine-types/graph'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { DEFAULT_TUNING } from '../../config'
import { toMindmapLayoutSignature } from '../cache'
import {
  buildMindmapLines,
  computeMindmapLayout,
  getMindmapLabel,
  getMindmapRoots,
  getMindmapTree,
  toMindmapStructureSignature,
  toViewportTransformView
} from '../query'
import { createEdgeViewQuery } from './edgeQuery'
import {
  defineViewDerivation,
  type ViewDerivationMap
} from './register'

type Options = {
  readState: State['read']
  readGraph: () => GraphSnapshot
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

const EMPTY_NODE_ITEMS: ViewSnapshot['node.items'] = []
const EMPTY_NODE_HANDLES: ViewSnapshot['node.transformHandles'] = new Map()

export const VIEW_KEYS: ViewKey[] = [
  'viewport.transform',
  'shortcut.context',
  'edge.entries',
  'edge.reconnect',
  'edge.paths',
  'edge.preview',
  'edge.selectedEndpoints',
  'edge.selectedRouting',
  'node.items',
  'node.transformHandles',
  'mindmap.roots',
  'mindmap.trees',
  'mindmap.drag'
]

export const createViewDerivations = ({
  readState,
  readGraph,
  query,
  config,
  platform
}: Options): ViewDerivationMap => {
  let mindmapTreeCache = new Map<string, { signature: string; tree: MindmapViewTree }>()
  const edgeViewQuery = createEdgeViewQuery({ readGraph, query })

  return {
    'viewport.transform': defineViewDerivation(['viewport'], () => toViewportTransformView(readState('viewport'))),
    'shortcut.context': defineViewDerivation(
      ['interaction', 'tool', 'selection', 'edgeSelection', 'edgeConnect', 'viewport'],
      () => {
        const interaction = readState('interaction')
        const tool = readState('tool')
        const selection = readState('selection')
        const selectedEdgeId = readState('edgeSelection')
        const edgeConnect = readState('edgeConnect')
        const selectedNodeIds = Array.from(selection.selectedNodeIds)

        return {
          platform,
          focus: interaction.focus,
          tool: { active: tool },
          selection: {
            count: selectedNodeIds.length,
            hasSelection: selectedNodeIds.length > 0,
            selectedNodeIds,
            selectedEdgeId
          },
          hover: interaction.hover,
          pointer: {
            ...interaction.pointer,
            isDragging: interaction.pointer.isDragging || selection.isSelecting || edgeConnect.isConnecting
          },
          viewport: {
            zoom: readState('viewport').zoom
          }
        }
      }
    ),
    'edge.entries': defineViewDerivation(['graph.visibleEdges', 'graph.canvasNodes'], () => edgeViewQuery.getEntries()),
    'edge.reconnect': defineViewDerivation(['edgeConnect', 'graph.visibleEdges', 'graph.canvasNodes'], () =>
      edgeViewQuery.getReconnectEntry(readState('edgeConnect'))
    ),
    'edge.paths': defineViewDerivation(['edgeConnect', 'graph.visibleEdges', 'graph.canvasNodes'], () => {
      const entries = edgeViewQuery.getEntries()
      const reconnect = edgeViewQuery.getReconnectEntry(readState('edgeConnect'))
      if (!reconnect) return entries
      let matched = false
      const next = entries.map((entry) => {
        if (entry.id !== reconnect.id) return entry
        matched = true
        return reconnect
      })
      return matched ? next : entries
    }),
    'edge.preview': defineViewDerivation(['edgeConnect', 'graph.canvasNodes', 'tool'], () => {
      const edgeConnect = readState('edgeConnect')
      const tool = readState('tool')
      const preview = edgeViewQuery.getPreview(edgeConnect)
      return {
        from: preview.showPreviewLine ? preview.from : undefined,
        to: preview.showPreviewLine ? preview.to : undefined,
        snap: tool === 'edge' ? preview.hover : undefined,
        reconnect: preview.reconnect,
        showPreviewLine: preview.showPreviewLine
      }
    }),
    'edge.selectedEndpoints': defineViewDerivation(['edgeSelection', 'graph.visibleEdges', 'graph.canvasNodes'], () => {
      const selectedEdgeId = readState('edgeSelection')
      if (!selectedEdgeId) return undefined
      const edge = readGraph().visibleEdges.find((item) => item.id === selectedEdgeId)
      if (!edge) return undefined
      return edgeViewQuery.getEndpoints(edge)
    }),
    'edge.selectedRouting': defineViewDerivation(['edgeSelection', 'graph.visibleEdges'], () => {
      const selectedEdgeId = readState('edgeSelection')
      if (!selectedEdgeId) return undefined
      const edge = readGraph().visibleEdges.find((item) => item.id === selectedEdgeId)
      if (!edge) return undefined
      const points = edge.routing?.points
      if (!points?.length) return undefined
      return {
        edge,
        points
      }
    }),
    'node.items': defineViewDerivation([], () => EMPTY_NODE_ITEMS),
    'node.transformHandles': defineViewDerivation([], () => EMPTY_NODE_HANDLES),
    'mindmap.roots': defineViewDerivation(['graph.visibleNodes'], () => getMindmapRoots(readGraph().visibleNodes)),
    'mindmap.trees': defineViewDerivation(['graph.visibleNodes', 'mindmapLayout'], () => {
      const roots = getMindmapRoots(readGraph().visibleNodes)
      const layout = readState('mindmapLayout') ?? {}
      const nextCache = new Map<string, { signature: string; tree: MindmapViewTree }>()
      const nextTrees: MindmapViewTree[] = []

      roots.forEach((root) => {
        const tree = getMindmapTree(root)
        if (!tree) return

        const structureSignature = `${toMindmapStructureSignature(tree)}#${root.position.x}:${root.position.y}:${
          root.size?.width ?? ''
        }:${root.size?.height ?? ''}`
        const signature = toMindmapLayoutSignature({
          treeId: root.id,
          structureSignature,
          nodeSize: config.mindmapNodeSize,
          mode: layout.mode ?? DEFAULT_TUNING.mindmap.defaultMode,
          hGap: layout.options?.hGap,
          vGap: layout.options?.vGap,
          side: layout.options?.side
        })

        const previous = mindmapTreeCache.get(root.id)
        if (previous?.signature === signature) {
          nextCache.set(root.id, previous)
          nextTrees.push(previous.tree)
          return
        }

        const computed = computeMindmapLayout(tree, config.mindmapNodeSize, layout)
        const shiftX = -computed.bbox.x
        const shiftY = -computed.bbox.y
        const labels = Object.fromEntries(
          Object.entries(tree.nodes).map(([nodeId, node]) => [nodeId, getMindmapLabel(node)])
        )
        const model: MindmapViewTree = {
          id: root.id,
          node: root,
          tree,
          layout,
          computed,
          shiftX,
          shiftY,
          lines: buildMindmapLines(tree, computed),
          labels
        }
        const cacheEntry = { signature, tree: model }
        nextCache.set(root.id, cacheEntry)
        nextTrees.push(model)
      })

      mindmapTreeCache = nextCache
      return nextTrees
    }),
    'mindmap.drag': defineViewDerivation(['mindmapDrag'], (): MindmapDragView | undefined => {
      const active = readState('mindmapDrag').active
      if (!active) return undefined

      if (active.kind === 'root') {
        return {
          treeId: active.treeId,
          kind: 'root',
          baseOffset: active.position
        }
      }

      return {
        treeId: active.treeId,
        kind: 'subtree',
        baseOffset: active.baseOffset,
        preview: {
          nodeId: active.nodeId,
          ghost: active.ghost,
          drop: active.drop
        }
      }
    })
  }
}
