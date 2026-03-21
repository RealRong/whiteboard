import './styles/whiteboard-react.css'

export { Whiteboard } from './Whiteboard'
export { useWhiteboard, useSelection } from './runtime/hooks'
export { createNodeRegistry, createDefaultNodeRegistry } from './features/node/registry'

export type { WhiteboardOptions, HistoryOptions, WhiteboardProps } from './types/common'
export type { WhiteboardInstance, Tool } from './runtime/instance'
export type {
  ControlId,
  NodeDefinition,
  NodeRegistry,
  NodeRenderProps,
  NodeScene,
  NodeHit,
  NodeMeta,
  NodeFamily
} from './types/node'
