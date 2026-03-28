import type { Editor } from '../instance/types'
import type { EngineInstance } from '@whiteboard/engine'
import {
  insertMindmapByPlacement,
  moveMindmapByDrop,
  moveMindmapRoot
} from '../../features/mindmap/commands'

type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export const createMindmapCommands = ({
  engine,
  commandHost
}: {
  engine: EngineInstance
  commandHost: EditorCommandHost
}): Editor['commands']['mindmap'] => ({
  ...engine.commands.mindmap,
  insertByPlacement: (input) => insertMindmapByPlacement({
    instance: commandHost,
    ...input
  }),
  moveByDrop: (input) => moveMindmapByDrop({
    instance: commandHost,
    ...input
  }),
  moveRoot: (input) => moveMindmapRoot({
    instance: commandHost,
    ...input
  })
})
