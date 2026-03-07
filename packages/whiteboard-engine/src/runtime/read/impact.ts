import type { ReadImpact } from '@engine-types/read/impact'

export const createResetReadImpact = (): ReadImpact => ({
  reset: true,
  node: {
    ids: [],
    geometry: false,
    list: false,
    value: false
  },
  edge: {
    ids: [],
    nodeIds: [],
    geometry: false,
    list: false,
    value: false
  },
  mindmap: {
    ids: [],
    view: false
  }
})
