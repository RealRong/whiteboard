import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { MindmapViewTree } from '@engine-types/instance/read'
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
} from '@whiteboard/core/mindmap'

type MindmapModelOptions = {
  config: InstanceConfig
}

type MindmapModelInput = {
  visibleNodes: Node[]
  layout: MindmapLayoutConfig
}

export type MindmapReadModel = {
  trees: (input: MindmapModelInput) => MindmapViewTree[]
}

export const model = ({
  config
}: MindmapModelOptions): MindmapReadModel => {
  let treeCache = new Map<string, { signature: string; tree: MindmapViewTree }>()

  const trees: MindmapReadModel['trees'] = ({
    visibleNodes,
    layout
  }) => {
    const allRoots = getMindmapRoots(visibleNodes)
    const nextCache = new Map<string, { signature: string; tree: MindmapViewTree }>()
    const nextTrees: MindmapViewTree[] = []
    const nextLayout = layout ?? {}

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
        mode: nextLayout.mode ?? DEFAULT_TUNING.mindmap.defaultMode,
        hGap: nextLayout.options?.hGap,
        vGap: nextLayout.options?.vGap,
        side: nextLayout.options?.side
      })

      const previous = treeCache.get(root.id)
      if (previous?.signature === signature) {
        nextCache.set(root.id, previous)
        nextTrees.push(previous.tree)
        return
      }

      const computed = computeMindmapLayout(tree, config.mindmapNodeSize, nextLayout)
      const shiftX = -computed.bbox.x
      const shiftY = -computed.bbox.y
      const labels = Object.fromEntries(
        Object.entries(tree.nodes).map(([nodeId, node]) => [nodeId, getMindmapLabel(node)])
      )
      const treeModel: MindmapViewTree = {
        id: root.id,
        node: root,
        tree,
        layout: nextLayout,
        computed,
        shiftX,
        shiftY,
        lines: buildMindmapLines(tree, computed),
        labels
      }
      const cacheEntry = { signature, tree: treeModel }
      nextCache.set(root.id, cacheEntry)
      nextTrees.push(treeModel)
    })

    treeCache = nextCache
    return nextTrees
  }

  return {
    trees
  }
}
