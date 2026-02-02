import type { EdgeType } from '../../types/core'
import type { EdgeRouter } from '../types'

const routers = new Map<EdgeType, EdgeRouter>()

export const registerEdgeRouter = (type: EdgeType, router: EdgeRouter) => {
  routers.set(type, router)
}

export const getEdgeRouter = (type: EdgeType) => routers.get(type)

export const hasEdgeRouter = (type: EdgeType) => routers.has(type)
