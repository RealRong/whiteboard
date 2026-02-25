import type { Edge } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgeEndpoints } from '@engine-types/instance/view'
export type NodeRectReader = QueryCanvas['nodeRect']

export type ResolveEndpoints = (edge: Edge) => EdgeEndpoints | undefined
