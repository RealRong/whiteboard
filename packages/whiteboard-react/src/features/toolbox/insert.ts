import type {
  NodeId,
  NodeInput,
  Point
} from '@whiteboard/core/types'
import type { EditField } from '../../runtime/edit'
import type { WhiteboardInstance } from '../../runtime/instance'
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

const placeNodeInput = (
  world: Point,
  input: Omit<NodeInput, 'position'>,
  placement: InsertPlacement = 'center'
): NodeInput => {
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
  instance: WhiteboardInstance,
  preset: Extract<InsertPreset, { kind: 'node' }>,
  world: Point,
  parentId?: NodeId
): InsertResult | undefined => {
  const result = instance.commands.node.create(
    placeNodeInput(world, {
      ...preset.input(world),
      parentId
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
  instance: WhiteboardInstance,
  preset: Extract<InsertPreset, { kind: 'mindmap' }>,
  world: Point
): InsertResult | undefined => {
  const result = instance.commands.mindmap.create({
    rootData: preset.template.root
  })
  if (!result.ok) {
    return undefined
  }

  preset.template.children?.forEach((child) => {
    instance.commands.mindmap.addChild(
      result.data.mindmapId,
      result.data.rootId,
      child.data,
      {
        side: child.side
      }
    )
  })

  const rect = instance.read.index.node.get(result.data.mindmapId)?.rect
  const width = rect?.width ?? 260
  const height = rect?.height ?? 180

  instance.commands.mindmap.moveRoot({
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
  instance,
  preset,
  world,
  parentId
}: {
  instance: WhiteboardInstance
  preset: InsertPreset
  world: Point
  parentId?: NodeId
}) => {
  const result = preset.kind === 'node'
    ? insertNodePreset(
        instance,
        preset,
        world,
        preset.canNest === false ? undefined : parentId
      )
    : insertMindmapPreset(instance, preset, world)

  if (!result) {
    return undefined
  }

  instance.commands.selection.replace([result.nodeId])
  if (result.edit) {
    instance.commands.edit.start(result.edit.nodeId, result.edit.field)
  }

  return result
}
