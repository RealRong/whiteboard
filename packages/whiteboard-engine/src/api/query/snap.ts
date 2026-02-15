import type {
  InstanceConfig,
  Query,
  State
} from '@engine-types/instance'
import { getNodeAABB } from '../../infra/geometry'
import { buildSnapCandidates, createGridIndex, queryGridIndex } from '../../node/utils/snap'

type Options = {
  readState: State['read']
  config: InstanceConfig
}

export const createSnapQuery = ({
  readState,
  config
}: Options): Pick<Query, 'getSnapCandidates' | 'getSnapCandidatesInRect'> => {
  const initialNodes = readState('canvasNodes')

  const buildCandidates = (nodes: typeof initialNodes) =>
    buildSnapCandidates(
      nodes.map((node) => ({
        id: node.id,
        rect: getNodeAABB(node, config.nodeSize)
      }))
    )

  const getCellSize = () => Math.max(config.node.snapGridCellSize, config.node.groupPadding * 6)

  let cachedNodes = initialNodes
  let cachedCandidates = buildCandidates(cachedNodes)
  let cachedIndex = createGridIndex(cachedCandidates, getCellSize())

  const ensureSnapCache = () => {
    const nodes = readState('canvasNodes')
    if (nodes === cachedNodes) return
    cachedNodes = nodes
    cachedCandidates = buildCandidates(nodes)
    cachedIndex = createGridIndex(cachedCandidates, getCellSize())
  }

  const getSnapCandidates: Query['getSnapCandidates'] = () => {
    ensureSnapCache()
    return cachedCandidates
  }

  const getSnapCandidatesInRect: Query['getSnapCandidatesInRect'] = (rect) => {
    ensureSnapCache()
    return queryGridIndex(cachedIndex, rect)
  }

  return {
    getSnapCandidates,
    getSnapCandidatesInRect
  }
}
