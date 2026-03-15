import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { ContainerView } from './container'
import type { SelectionState } from './selection'
import type { EditorTool } from '../instance/types'

export type ValueView<T> = ReadStore<T>

export type WhiteboardView = {
  tool: ValueView<EditorTool>
  nodeIds: ValueView<readonly NodeId[]>
  edgeIds: ValueView<readonly EdgeId[]>
  mindmapIds: ValueView<readonly NodeId[]>
  selection: ValueView<SelectionState>
  container: ValueView<ContainerView>
}
