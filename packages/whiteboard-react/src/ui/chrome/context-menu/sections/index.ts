import { buildCanvasSections } from './canvas'
import { buildEdgeSections } from './edge'
import { buildNodeSections, buildNodesSections } from './node'
import type {
  ContextMenuResolvedTarget,
  ContextMenuSection
} from '../types'

export const resolveContextMenuSections = (
  target: ContextMenuResolvedTarget
): readonly ContextMenuSection[] => {
  switch (target.kind) {
    case 'canvas':
      return buildCanvasSections(target.world)
    case 'node':
      return buildNodeSections(target.node)
    case 'nodes':
      return buildNodesSections(target.nodes)
    case 'edge':
      return buildEdgeSections(target.edgeId)
  }
}
