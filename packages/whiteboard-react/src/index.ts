import './styles/whiteboard-react.css'

export { Whiteboard } from './Whiteboard'
export { useWhiteboard, useSelection } from './runtime/hooks'
export { createNodeRegistry, createDefaultNodeRegistry } from './features/node/registry'

export type { WhiteboardOptions, HistoryOptions, WhiteboardProps } from './types/common'
export type { WhiteboardInstance } from './runtime/instance'
export type { NodeDefinition, NodeRegistry, NodeRenderProps } from './types/node'
