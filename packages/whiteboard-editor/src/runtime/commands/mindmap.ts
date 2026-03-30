import type { Editor } from '../../types/public/editor'
import type { EngineInstance } from '@whiteboard/engine'
import type { EditorCommandHost } from '../../types/internal/editor'
import {
  insertMindmapByPlacement,
  moveMindmapByDrop,
  moveMindmapRoot
} from '../../features/mindmap/commands'

export const createMindmapCommands = ({
  engine,
  commandHost
}: {
  engine: EngineInstance
  commandHost: EditorCommandHost
}): Editor['commands']['mindmap'] => ({
  ...engine.commands.mindmap,
  insertByPlacement: (input) => insertMindmapByPlacement({
    editor: commandHost,
    ...input
  }),
  moveByDrop: (input) => moveMindmapByDrop({
    editor: commandHost,
    ...input
  }),
  moveRoot: (input) => moveMindmapRoot({
    editor: commandHost,
    ...input
  })
})
