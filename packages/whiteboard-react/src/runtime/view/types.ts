import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { ContainerView } from './container'
import type { SelectionState } from './selection'
import type { EditorTool } from '../instance/types'

export type WhiteboardView = {
  tool: ReadStore<EditorTool>
  nodeIds: ReadStore<readonly NodeId[]>
  edgeIds: ReadStore<readonly EdgeId[]>
  mindmapIds: ReadStore<readonly NodeId[]>
  selection: ReadStore<SelectionState>
  container: ReadStore<ContainerView>
}
