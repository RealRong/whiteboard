import type { ProjectionSnapshot } from '@engine-types/projection'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { State } from '@engine-types/instance/state'
import type { Render } from '@engine-types/instance/render'
import type { MindmapDragView, MindmapViewTree } from '@engine-types/instance/view'
import type { Node } from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../../config'
import { toMindmapLayoutSignature } from '@whiteboard/core/cache'
import {
  buildMindmapLines,
  computeMindmapLayout,
  getMindmapLabel,
  getMindmapTree,
  getMindmapRoots,
  toMindmapStructureSignature
} from '../query'

type MindmapDerivationOptions = {
  readState: State['read']
  readRender: Render['read']
  readProjection: () => ProjectionSnapshot
  config: InstanceConfig
}

export const createMindmapViewDerivations = ({
  readState,
  readRender,
  readProjection,
  config
}: MindmapDerivationOptions) => {
  let treeCache = new Map<string, { signature: string; tree: MindmapViewTree }>()

  const roots = (): Node[] =>
    getMindmapRoots(readProjection().nodes.visible)

  const trees = (): MindmapViewTree[] => {
    const allRoots = roots()
    const layout = readState('mindmapLayout') ?? {}
    const nextCache = new Map<string, { signature: string; tree: MindmapViewTree }>()
    const nextTrees: MindmapViewTree[] = []

    allRoots.forEach((root) => {
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

      const previous = treeCache.get(root.id)
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

    treeCache = nextCache
    return nextTrees
  }

  const drag = (): MindmapDragView | undefined => {
    const active = readRender('mindmapDrag').payload
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
  }

  return {
    roots,
    trees,
    drag
  }
}
