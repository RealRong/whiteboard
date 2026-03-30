import type { EngineInstance } from '@whiteboard/engine'
import type { NodeProjectionRuntime } from '../../../features/node/projection/store'
import type { Editor } from '../../../types/public/editor'
import { createNodeAppearanceCommands } from './appearance'
import { createNodeDocumentCommands } from './document'
import { createNodeLockCommands } from './lock'
import { createNodeTextCommands } from './text'

export const createNodeCommands = ({
  engine,
  read,
  runtime,
  edit,
  selection
}: {
  engine: EngineInstance
  read: Editor['read']
  runtime: NodeProjectionRuntime
  edit: Editor['commands']['edit']
  selection: Editor['commands']['selection']
}): Editor['commands']['node'] => {
  const document = createNodeDocumentCommands(engine)
  const appearance = createNodeAppearanceCommands({
    engine,
    document
  })
  const text = createNodeTextCommands({
    read,
    runtime,
    edit,
    selection,
    deleteCascade: engine.commands.node.deleteCascade,
    document,
    appearance
  })
  const lock = createNodeLockCommands({
    engine,
    document
  })

  return {
    create: engine.commands.node.create,
    move: engine.commands.node.move,
    align: engine.commands.node.align,
    distribute: engine.commands.node.distribute,
    delete: engine.commands.node.delete,
    deleteCascade: engine.commands.node.deleteCascade,
    duplicate: engine.commands.node.duplicate,
    group: engine.commands.node.group,
    order: engine.commands.node.order,
    document,
    lock,
    text,
    appearance
  }
}
