import type { NodeId, NodeInput, Point } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'

type CommandsInstance = Pick<WhiteboardInstance, 'commands'>

export type CreateNodePreset = {
  key: string
  label: string
  input: (world: Point) => NodeInput
}

const centerNodeInput = (
  world: Point,
  input: Omit<NodeInput, 'position'>
): NodeInput => {
  const width = input.size?.width ?? 160
  const height = input.size?.height ?? 80

  return {
    ...input,
    position: {
      x: world.x - width / 2,
      y: world.y - height / 2
    }
  }
}

export const CREATE_NODE_PRESETS: readonly CreateNodePreset[] = [
  {
    key: 'create.text',
    label: 'Add text',
    input: (world) => centerNodeInput(world, {
      type: 'text',
      size: { width: 180, height: 44 },
      data: { text: '' }
    })
  },
  {
    key: 'create.sticky',
    label: 'Add sticky',
    input: (world) => centerNodeInput(world, {
      type: 'sticky',
      size: { width: 180, height: 140 },
      data: { text: '' }
    })
  },
  {
    key: 'create.rect',
    label: 'Add rectangle',
    input: (world) => centerNodeInput(world, {
      type: 'rect',
      size: { width: 180, height: 100 },
      data: { title: 'Rectangle' }
    })
  },
  {
    key: 'create.ellipse',
    label: 'Add ellipse',
    input: (world) => centerNodeInput(world, {
      type: 'ellipse',
      size: { width: 180, height: 100 },
      data: { title: 'Ellipse' }
    })
  },
  {
    key: 'create.diamond',
    label: 'Add diamond',
    input: (world) => centerNodeInput(world, {
      type: 'diamond',
      size: { width: 180, height: 120 },
      data: { title: 'Decision' }
    })
  },
  {
    key: 'create.triangle',
    label: 'Add triangle',
    input: (world) => centerNodeInput(world, {
      type: 'triangle',
      size: { width: 180, height: 130 },
      data: { title: 'Triangle' }
    })
  },
  {
    key: 'create.callout',
    label: 'Add callout',
    input: (world) => centerNodeInput(world, {
      type: 'callout',
      size: { width: 220, height: 130 },
      data: { text: 'Callout' }
    })
  },
  {
    key: 'create.arrow-sticker',
    label: 'Add arrow sticker',
    input: (world) => centerNodeInput(world, {
      type: 'arrow-sticker',
      size: { width: 220, height: 110 },
      data: { title: 'Arrow' }
    })
  },
  {
    key: 'create.highlight',
    label: 'Add highlight',
    input: (world) => centerNodeInput(world, {
      type: 'highlight',
      size: { width: 220, height: 90 },
      data: { text: 'Highlight' }
    })
  }
]

export const createNodeFromPreset = (
  instance: CommandsInstance,
  preset: CreateNodePreset,
  world: Point,
  parentId?: NodeId
) => {
  const input = preset.input(world)
  const result = instance.commands.node.create(
    parentId ? { ...input, parentId } : input
  )
  if (!result.ok) return
  instance.commands.selection.replace([result.data.nodeId])
}
