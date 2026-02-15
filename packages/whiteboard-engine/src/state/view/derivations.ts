import type {
  InstanceConfig,
  Query,
  MindmapDragView,
  MindmapViewTree,
  NodeTransformHandle,
  StateKey,
  State,
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { toMindmapLayoutSignature } from '../../infra/cache'
import {
  buildMindmapLines,
  computeMindmapLayout,
  getMindmapLabel,
  getMindmapRoots,
  getMindmapTree,
  toLayerOrderedCanvasNodes,
  toMindmapStructureSignature,
  toViewportTransformView
} from '../../infra/query'
import { buildTransformHandles } from '../../node/utils/transform'
import { createEdgeViewQuery } from './edgeQuery'

type ViewDerivation<K extends ViewKey> = {
  deps: StateKey[]
  derive: () => ViewSnapshot[K]
}

export type ViewDerivationMap = {
  [K in ViewKey]: ViewDerivation<K>
}

type Options = {
  readState: State['read']
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

const uniqueStateKeys = (keys: StateKey[]) => Array.from(new Set(keys))

const createViewDerivation = <K extends ViewKey>(
  deps: StateKey[],
  derive: () => ViewSnapshot[K]
): ViewDerivation<K> => ({
  deps: uniqueStateKeys(deps),
  derive
})

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
  query,
  config,
  platform
}: Options): ViewDerivationMap => {
  let mindmapTreeCache = new Map<string, { signature: string; tree: MindmapViewTree }>()
  const edgeViewQuery = createEdgeViewQuery({ readState, query })

  return {
    'viewport.transform': createViewDerivation(['viewport'], () => toViewportTransformView(readState('viewport'))),
    'shortcut.context': createViewDerivation(
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
    'edge.entries': createViewDerivation(['visibleEdges', 'canvasNodes'], () => edgeViewQuery.getPathEntries()),
    'edge.reconnect': createViewDerivation(['edgeConnect', 'visibleEdges', 'canvasNodes'], () =>
      edgeViewQuery.getReconnectPathEntry(readState('edgeConnect'))
    ),
    'edge.paths': createViewDerivation(['edgeConnect', 'visibleEdges', 'canvasNodes'], () => {
      const entries = edgeViewQuery.getPathEntries()
      const reconnect = edgeViewQuery.getReconnectPathEntry(readState('edgeConnect'))
      if (!reconnect) return entries
      let matched = false
      const next = entries.map((entry) => {
        if (entry.id !== reconnect.id) return entry
        matched = true
        return reconnect
      })
      return matched ? next : entries
    }),
    'edge.preview': createViewDerivation(['edgeConnect', 'canvasNodes', 'tool'], () => {
      const edgeConnect = readState('edgeConnect')
      const tool = readState('tool')
      const preview = edgeViewQuery.getConnectPreview(edgeConnect)
      return {
        from: preview.showPreviewLine ? preview.from : undefined,
        to: preview.showPreviewLine ? preview.to : undefined,
        snap: tool === 'edge' ? preview.hover : undefined,
        reconnect: preview.reconnect,
        showPreviewLine: preview.showPreviewLine
      }
    }),
    'edge.selectedEndpoints': createViewDerivation(['edgeSelection', 'visibleEdges', 'canvasNodes'], () => {
      const selectedEdgeId = readState('edgeSelection')
      if (!selectedEdgeId) return undefined
      const edge = readState('visibleEdges').find((item) => item.id === selectedEdgeId)
      if (!edge) return undefined
      return edgeViewQuery.getResolvedEndpoints(edge)
    }),
    'edge.selectedRouting': createViewDerivation(['edgeSelection', 'visibleEdges'], () => {
      const selectedEdgeId = readState('edgeSelection')
      if (!selectedEdgeId) return undefined
      const edge = readState('visibleEdges').find((item) => item.id === selectedEdgeId)
      if (!edge) return undefined
      const points = edge.routing?.points
      if (!points?.length) return undefined
      return {
        edge,
        points
      }
    }),
    'node.items': createViewDerivation(['canvasNodes', 'selection', 'groupHovered', 'tool', 'viewport'], () => {
      const activeTool = (readState('tool') as 'select' | 'edge') ?? 'select'
      const viewport = readState('viewport')
      const zoom = viewport.zoom
      const selectedNodeIds = readState('selection').selectedNodeIds
      const hoveredGroupId = readState('groupHovered')
      const orderedNodes = toLayerOrderedCanvasNodes(readState('canvasNodes'))
      const rectByNodeId = new Map(query.getCanvasNodeRects().map((entry) => [entry.node.id, entry.rect]))

      return orderedNodes.map((node) => {
        const rect =
          rectByNodeId.get(node.id) ?? {
            x: node.position.x,
            y: node.position.y,
            width: node.size?.width ?? 0,
            height: node.size?.height ?? 0
          }

        return {
          node,
          rect,
          container: {
            transformBase: `translate(${rect.x}px, ${rect.y}px)`,
            rotation: typeof node.rotation === 'number' ? node.rotation : 0,
            transformOrigin: 'center center'
          },
          selected: activeTool === 'edge' ? false : selectedNodeIds.has(node.id),
          hovered: hoveredGroupId === node.id,
          activeTool,
          zoom
        }
      })
    }),
    'node.transformHandles': createViewDerivation(['canvasNodes', 'selection', 'tool', 'viewport'], () => {
      const handleMap = new Map<string, NodeTransformHandle[]>()
      const rotateHandleOffset = 24
      const activeTool = (readState('tool') as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'select') return handleMap
      const selectedNodeIds = readState('selection').selectedNodeIds
      const zoom = readState('viewport').zoom
      const orderedNodes = toLayerOrderedCanvasNodes(readState('canvasNodes'))
      const rectByNodeId = new Map(query.getCanvasNodeRects().map((entry) => [entry.node.id, entry.rect]))

      orderedNodes.forEach((node) => {
        if (!selectedNodeIds.has(node.id) || node.locked) return
        const rect =
          rectByNodeId.get(node.id) ?? {
            x: node.position.x,
            y: node.position.y,
            width: node.size?.width ?? 0,
            height: node.size?.height ?? 0
          }
        const rotation = typeof node.rotation === 'number' ? node.rotation : 0
        const handles = buildTransformHandles({
          rect,
          rotation,
          canRotate: true,
          rotateHandleOffset,
          zoom
        })
        handleMap.set(node.id, handles)
      })

      return handleMap
    }),
    'mindmap.roots': createViewDerivation(['visibleNodes'], () => getMindmapRoots(readState('visibleNodes'))),
    'mindmap.trees': createViewDerivation(['visibleNodes', 'mindmapLayout'], () => {
      const roots = getMindmapRoots(readState('visibleNodes'))
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
          mode: layout.mode ?? 'simple',
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
    'mindmap.drag': createViewDerivation(['mindmapDrag'], (): MindmapDragView | undefined => {
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
