import type { NodeDefinition } from '../../../../types/node'
import { createNodeRegistry } from '../nodeRegistry'
import { DrawNodeDefinition } from './draw'
import { GroupNodeDefinition } from './group'
import { RectNodeDefinition, ShapeNodeDefinitions } from './shape'
import { StickyNodeDefinition, TextNodeDefinition } from './text'

export const DEFAULT_NODE_DEFINITIONS: NodeDefinition[] = [
  RectNodeDefinition,
  DrawNodeDefinition,
  TextNodeDefinition,
  StickyNodeDefinition,
  ...ShapeNodeDefinitions,
  GroupNodeDefinition
]

export const createDefaultNodeRegistry = () => createNodeRegistry(DEFAULT_NODE_DEFINITIONS)
