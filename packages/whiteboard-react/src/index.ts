import './styles/whiteboard-react.css'

export { Whiteboard } from './Whiteboard'
export { useInstance, useWhiteboardSelector } from './common/hooks'

export type { WhiteboardConfig, WhiteboardHistoryConfig, WhiteboardProps } from './types/common'
export type { NodeDefinition, NodeRegistry, NodeRenderProps } from './types/node'
export type {
  CreateWhiteboardEngineOptions as CreateWhiteboardInstanceOptions,
  WhiteboardEngine as WhiteboardInstance
} from '@whiteboard/engine'
