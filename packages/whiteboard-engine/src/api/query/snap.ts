import type {
  WhiteboardInstanceConfig,
  WhiteboardInstanceQuery,
  WhiteboardStateNamespace
} from '@engine-types/instance'
import { getNodeAABB } from '../../infra/geometry'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../../node/utils/snap'

type CreateSnapQueryOptions = {
  readState: WhiteboardStateNamespace['read']
  config: WhiteboardInstanceConfig
}

export const createSnapQuery = ({
  readState,
  config
}: CreateSnapQueryOptions): Pick<WhiteboardInstanceQuery, 'getSnapCandidates' | 'getSnapCandidatesInRect'> => {
  const initialNodes = readState('canvasNodes')

  const buildSnapCandidatesFromNodes = (nodes: typeof initialNodes) =>
    buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, config.nodeSize)
      }))
    )

  const toSnapGridCellSize = () => Math.max(config.node.snapGridCellSize, config.node.groupPadding * 6)

  let cachedSnapNodes = initialNodes
  let cachedSnapCandidates = buildSnapCandidatesFromNodes(cachedSnapNodes)
  let cachedSnapIndex = createGridIndex(cachedSnapCandidates, toSnapGridCellSize())

  const ensureSnapCache = () => {
    const nodes = readState('canvasNodes')
    if (nodes === cachedSnapNodes) return
    cachedSnapNodes = nodes
    cachedSnapCandidates = buildSnapCandidatesFromNodes(nodes)
    cachedSnapIndex = createGridIndex(cachedSnapCandidates, toSnapGridCellSize())
  }

  const getSnapCandidates: WhiteboardInstanceQuery['getSnapCandidates'] = () => {
    ensureSnapCache()
    return cachedSnapCandidates
  }

  const getSnapCandidatesInRect: WhiteboardInstanceQuery['getSnapCandidatesInRect'] = (rect) => {
    ensureSnapCache()
    return queryGridIndex(cachedSnapIndex, rect)
  }

  return {
    getSnapCandidates,
    getSnapCandidatesInRect
  }
}
