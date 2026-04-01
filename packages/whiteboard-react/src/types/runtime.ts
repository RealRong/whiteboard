import type {
  Editor as EditorBaseRuntime,
  EditorInput,
  EditorInteractionState
} from '@whiteboard/editor'
import type { ReadStore } from '@whiteboard/engine'

export type WhiteboardRuntime = Omit<EditorBaseRuntime, 'state' | 'configure' | 'dispose'> & {
  state: EditorBaseRuntime['state'] & {
    interaction: ReadStore<EditorInteractionState>
  }
  input: EditorInput
  configure: (config: {
    tool: Parameters<EditorBaseRuntime['configure']>[0]['tool']
    viewport: Parameters<EditorBaseRuntime['configure']>[0]['viewport'] & {
      enablePan: boolean
      enableWheel: boolean
      wheelSensitivity: number
    }
    mindmapLayout: Parameters<EditorBaseRuntime['configure']>[0]['mindmapLayout']
    history?: Parameters<EditorBaseRuntime['configure']>[0]['history']
  }) => void
  dispose: () => void
}

export type WhiteboardInstance = WhiteboardRuntime
