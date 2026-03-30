import type { NodeId, Point, SpatialNodeInput } from '@whiteboard/core/types'
import type { Editor, EditorInsertResult } from '../../types/editor'
import type { EditorCommandHost } from '../../types/internal/editor'
import type { EditField } from '../edit'
import type {
  InsertPlacement,
  InsertPreset,
  InsertPresetCatalog
} from '../../types/toolbox'
import { moveMindmapRoot } from './mindmap'

type InsertCommandEditor = Pick<EditorCommandHost, 'commands' | 'read'>

const placeNodeInput = (
  world: Point,
  input: Omit<SpatialNodeInput, 'position'>,
  placement: InsertPlacement = 'center'
): SpatialNodeInput => {
  const width = input.size?.width ?? 160
  const height = input.size?.height ?? 80

  return {
    ...input,
    position: placement === 'point'
      ? world
      : {
          x: world.x - width / 2,
          y: world.y - height / 2
        }
  }
}

const toInsertResult = (
  nodeId: NodeId,
  field?: EditField
): EditorInsertResult => ({
  nodeId,
  edit: field
    ? {
        nodeId,
        field
      }
    : undefined
})

const insertNodePreset = (
  editor: InsertCommandEditor,
  preset: Extract<InsertPreset, { kind: 'node' }>,
  world: Point,
  ownerId?: NodeId
): EditorInsertResult | undefined => {
  const result = editor.commands.node.create(
    placeNodeInput(
      world,
      {
        ...preset.input(world),
        ownerId
      },
      preset.placement
    )
  )
  if (!result.ok) {
    return undefined
  }

  return toInsertResult(result.data.nodeId, preset.focus)
}

const insertMindmapPreset = (
  editor: InsertCommandEditor,
  preset: Extract<InsertPreset, { kind: 'mindmap' }>,
  world: Point
): EditorInsertResult | undefined => {
  const result = editor.commands.mindmap.create({
    rootData: preset.template.root
  })
  if (!result.ok) {
    return undefined
  }

  preset.template.children?.forEach((child) => {
    editor.commands.mindmap.insert(result.data.mindmapId, {
      kind: 'child',
      parentId: result.data.rootId,
      payload: child.data,
      options: {
        side: child.side
      }
    })
  })

  const rect = editor.read.index.node.get(result.data.mindmapId)?.rect
  const width = rect?.width ?? 260
  const height = rect?.height ?? 180

  moveMindmapRoot({
    editor,
    nodeId: result.data.mindmapId,
    position: {
      x: world.x - width / 2,
      y: world.y - height / 2
    },
    threshold: 0
  })

  return toInsertResult(result.data.mindmapId)
}

const runInsertPreset = ({
  editor,
  preset,
  world,
  ownerId
}: {
  editor: InsertCommandEditor
  preset: InsertPreset
  world: Point
  ownerId?: NodeId
}) => {
  const result = preset.kind === 'node'
    ? insertNodePreset(
        editor,
        preset,
        world,
        preset.canNest === false ? undefined : ownerId
      )
    : insertMindmapPreset(editor, preset, world)

  if (!result) {
    return undefined
  }

  editor.commands.selection.replace({
    nodeIds: [result.nodeId]
  })
  if (result.edit) {
    editor.commands.edit.start(result.edit.nodeId, result.edit.field)
  }

  return result
}

export const createInsertCommands = ({
  commandHost,
  catalog
}: {
  commandHost: EditorCommandHost
  catalog: InsertPresetCatalog
}): Editor['commands']['insert'] => {
  const insertPresetByKey = (
    presetKey: string,
    options: {
      at: { x: number; y: number }
      ownerId?: string
    }
  ) => {
    const preset = catalog.get(presetKey)
    if (!preset) {
      return undefined
    }

    return runInsertPreset({
      editor: commandHost,
      preset,
      world: options.at,
      ownerId: options.ownerId
    })
  }

  return {
    preset: (presetKey, options) => insertPresetByKey(presetKey, options),
    text: (options) => insertPresetByKey(catalog.defaults.text, options),
    frame: (options) => insertPresetByKey(catalog.defaults.frame, options),
    sticky: ({ toneKey = catalog.defaults.sticky, at, ownerId }) =>
      insertPresetByKey(toneKey, { at, ownerId }),
    shape: ({ kind, at, ownerId }) =>
      insertPresetByKey(catalog.defaults.shape(kind), { at, ownerId }),
    mindmap: ({ templateKey = catalog.defaults.mindmap, at }) =>
      insertPresetByKey(templateKey, { at })
  }
}
