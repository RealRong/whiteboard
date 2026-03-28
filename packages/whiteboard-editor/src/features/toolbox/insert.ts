import type {
  NodeId,
  Point,
  SpatialNodeInput
} from '@whiteboard/core/types'
import type { EditField } from '../../runtime/edit'
import type { Editor } from '../../runtime/editor/types'
import { moveMindmapRoot } from '../mindmap/commands'
import type {
  InsertPlacement,
  InsertPreset
} from './presets'

export type InsertResult = {
  nodeId: NodeId
  edit?: {
    nodeId: NodeId
    field: EditField
  }
}

type InsertEditor = Pick<Editor, 'commands' | 'read'>

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

const insertNodePreset = (
  editor: InsertEditor,
  preset: Extract<InsertPreset, { kind: 'node' }>,
  world: Point,
  ownerId?: NodeId
): InsertResult | undefined => {
  const result = editor.commands.node.create(
    placeNodeInput(world, {
      ...preset.input(world),
      ownerId
    }, preset.placement)
  )
  if (!result.ok) {
    return undefined
  }

  return {
    nodeId: result.data.nodeId,
    edit: preset.focus
      ? {
          nodeId: result.data.nodeId,
          field: preset.focus
        }
      : undefined
  }
}

const insertMindmapPreset = (
  editor: InsertEditor,
  preset: Extract<InsertPreset, { kind: 'mindmap' }>,
  world: Point
): InsertResult | undefined => {
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

  return {
    nodeId: result.data.mindmapId
  }
}

export const insertPreset = ({
  editor,
  preset,
  world,
  ownerId
}: {
  editor: InsertEditor
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
