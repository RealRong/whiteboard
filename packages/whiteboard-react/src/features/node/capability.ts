import type { NodeDefinition } from '../../types/node'
import { getNodeScene } from './scene'

export type NodeTransformCapability = {
  resize: boolean
  rotate: boolean
}

export const canNodeResize = (
  definition?: NodeDefinition
) => definition?.canResize ?? true

export const canNodeRotate = (
  definition?: NodeDefinition
) => (
  typeof definition?.canRotate === 'boolean'
    ? definition.canRotate
    : getNodeScene(definition) !== 'container'
)

export const resolveNodeTransformCapability = (
  definition?: NodeDefinition
): NodeTransformCapability => ({
  resize: canNodeResize(definition),
  rotate: canNodeRotate(definition)
})
