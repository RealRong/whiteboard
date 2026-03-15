import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { ScopeView } from './scope'
import type { SelectionState } from './selection'
import type { EditorTool } from '../instance/toolState'

export type ValueView<T> = ReadStore<T>

export type WhiteboardView = {
  tool: ValueView<EditorTool>
  nodeIds: ValueView<readonly NodeId[]>
  edgeIds: ValueView<readonly EdgeId[]>
  mindmapIds: ValueView<readonly NodeId[]>
  selection: ValueView<SelectionState>
  scope: ValueView<ScopeView>
}
