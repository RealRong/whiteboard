import type {
  EdgeId,
  Node,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import type { Editor } from '../../../types/public/editor'
import type { NodeRegistry } from '../../../types/node'
import type { ContextResolved } from './target'
import {
  resolveContextNodeMeta,
  resolveContextSelectionCan,
  summarizeContextNodes
} from '../selection/summary'
import type {
  ContextMenuView,
  SelectionStyleSummary
} from '../../../types/public/context'

type ContextMenuHost = Pick<Editor, 'read'> & {
  registry: Pick<NodeRegistry, 'get'>
}

const hasStyleField = (
  schema: NodeSchema | undefined,
  path: string
) => schema?.fields.some((field) => field.scope === 'style' && field.path === path) ?? false

const canEditStrokeStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'stroke')
  || hasStyleField(schema, 'strokeWidth')
  || typeof node.style?.stroke === 'string'
  || typeof node.style?.strokeWidth === 'number'
)

const canEditOpacityStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'opacity')
  || typeof node.style?.opacity === 'number'
)

const readSelectionStyleSummary = ({
  editor,
  nodes
}: {
  editor: ContextMenuHost
  nodes: readonly Node[]
}): SelectionStyleSummary | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: editor.registry.get(node.type)?.schema
  }))
  const supportsStroke = sources.every(({ node, schema }) => canEditStrokeStyle(node, schema))
  if (!supportsStroke) {
    return undefined
  }

  const supportsOpacity = sources.every(({ node, schema }) => canEditOpacityStyle(node, schema))
  const primary = nodes[0]
  const stroke = typeof primary.style?.stroke === 'string'
    ? primary.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidth = typeof primary.style?.strokeWidth === 'number'
    ? primary.style.strokeWidth
    : 1
  const opacity = typeof primary.style?.opacity === 'number'
    ? primary.style.opacity
    : 1

  return {
    stroke,
    strokeWidth,
    strokeWidthPreset: nodes.every((node) => node.type === 'draw')
      ? 'draw'
      : 'default',
    opacity: supportsOpacity ? opacity : undefined
  }
}

const readCanvasMenuView = ({
  editor,
  screen,
  world
}: {
  editor: ContextMenuHost
  screen: Point
  world: Point
}): ContextMenuView => ({
  kind: 'canvas',
  screen,
  canvas: {
    world,
    ownerId: editor.read.frame.scope.get().id
  }
})

const readNodeMenuView = ({
  editor,
  screen,
  nodes
}: {
  editor: ContextMenuHost
  screen: Point
  nodes: readonly Node[]
}): ContextMenuView => {
  const resolveMeta = (node: Node) => resolveContextNodeMeta(editor.registry, node)
  const summary = summarizeContextNodes({
    nodes,
    resolveMeta
  })

  return {
    kind: 'selection',
    screen,
    selection: {
      summary,
      can: resolveContextSelectionCan({
        nodes,
        resolveMeta
      }),
      filter: summary.mixed
        ? {
            types: summary.types
          }
        : undefined,
      style: readSelectionStyleSummary({
        editor,
        nodes
      })
    }
  }
}

const readEdgeMenuView = ({
  screen,
  edgeId
}: {
  screen: Point
  edgeId: EdgeId
}): ContextMenuView => ({
  kind: 'edge',
  screen,
  edge: {
    id: edgeId
  }
})

export const readContextMenuView = ({
  editor,
  target,
  screen
}: {
  editor: ContextMenuHost
  target: ContextResolved | undefined
  screen: Point
}): ContextMenuView | undefined => {
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'canvas':
      return readCanvasMenuView({
        editor,
        screen,
        world: target.world
      })
    case 'node':
      return readNodeMenuView({
        editor,
        screen,
        nodes: [target.node]
      })
    case 'nodes':
      return readNodeMenuView({
        editor,
        screen,
        nodes: target.nodes
      })
    case 'edge':
      return readEdgeMenuView({
        screen,
        edgeId: target.edgeId
      })
  }
}
