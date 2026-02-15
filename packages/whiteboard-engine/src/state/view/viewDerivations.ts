import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardMindmapDragView,
  WhiteboardMindmapViewTree,
  WhiteboardNodeTransformHandle,
  WhiteboardStateKey,
  WhiteboardStateNamespace,
  WhiteboardViewKey,
  WhiteboardViewSnapshot
} from '@engine-types/instance'
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

type ViewDerivation<K extends WhiteboardViewKey> = {
  deps: WhiteboardStateKey[]
  derive: () => WhiteboardViewSnapshot[K]
}

export type WhiteboardViewDerivationMap = {
  [K in WhiteboardViewKey]: ViewDerivation<K>
}

type CreateWhiteboardViewDerivationsOptions = {
  readState: WhiteboardStateNamespace['read']
  query: WhiteboardInstanceQuery
  config: WhiteboardInstanceConfig
}

const uniqueStateKeys = (keys: WhiteboardStateKey[]) => Array.from(new Set(keys))

const createViewDerivation = <K extends WhiteboardViewKey>(
  deps: WhiteboardStateKey[],
  derive: () => WhiteboardViewSnapshot[K]
): ViewDerivation<K> => ({
  deps: uniqueStateKeys(deps),
  derive
})

export const WHITEBOARD_VIEW_KEYS: WhiteboardViewKey[] = [
  'viewport.transform',
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

export const createWhiteboardViewDerivations = ({
  readState,
  query,
  config
}: CreateWhiteboardViewDerivationsOptions): WhiteboardViewDerivationMap => {
  let mindmapTreeCache = new Map<string, { signature: string; tree: WhiteboardMindmapViewTree }>()

  return {
    'viewport.transform': createViewDerivation(['viewport'], () => toViewportTransformView(readState('viewport'))),
    'edge.entries': createViewDerivation(['visibleEdges', 'canvasNodes'], () => query.getEdgePathEntries()),
    'edge.reconnect': createViewDerivation(['edgeConnect', 'visibleEdges', 'canvasNodes'], () =>
      query.getEdgeReconnectPathEntry(readState('edgeConnect'))
    ),
    'edge.paths': createViewDerivation(['edgeConnect', 'visibleEdges', 'canvasNodes'], () => {
      const entries = query.getEdgePathEntries()
      const reconnect = query.getEdgeReconnectPathEntry(readState('edgeConnect'))
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
      const preview = query.getEdgeConnectPreview(edgeConnect)
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
      return query.getEdgeResolvedEndpoints(edge)
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
      const handleMap = new Map<string, WhiteboardNodeTransformHandle[]>()
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
      const nextCache = new Map<string, { signature: string; tree: WhiteboardMindmapViewTree }>()
      const nextTrees: WhiteboardMindmapViewTree[] = []

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
        const model: WhiteboardMindmapViewTree = {
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
    'mindmap.drag': createViewDerivation(['mindmapDrag'], (): WhiteboardMindmapDragView | undefined => {
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
