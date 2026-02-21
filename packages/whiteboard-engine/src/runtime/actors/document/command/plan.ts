import type { Command } from '@engine-types/command'
import { planDocCommand } from './handlers/doc'
import { planNodeCommand } from './handlers/node'
import { planEdgeCommand } from './handlers/edge'
import { planOrderCommand } from './handlers/order'
import { planGroupCommand } from './handlers/group'
import { planViewportCommand } from './handlers/viewport'
import { planMindmapCommand } from './handlers/mindmap'
import type { ExecutionPlan, ReduceContext } from './handlers/helpers'

export const planCommand = (
  context: ReduceContext,
  command: Command
): ExecutionPlan => {
  switch (command.type) {
    case 'doc.reset':
      return planDocCommand(command)
    case 'node.create':
    case 'node.update':
    case 'node.delete':
    case 'node.move':
    case 'node.resize':
    case 'node.rotate':
      return planNodeCommand(context, command)
    case 'edge.create':
    case 'edge.update':
    case 'edge.delete':
    case 'edge.connect':
    case 'edge.reconnect':
      return planEdgeCommand(context, command)
    case 'node.order.set':
    case 'node.order.bringToFront':
    case 'node.order.sendToBack':
    case 'node.order.bringForward':
    case 'node.order.sendBackward':
    case 'edge.order.set':
    case 'edge.order.bringToFront':
    case 'edge.order.sendToBack':
    case 'edge.order.bringForward':
    case 'edge.order.sendBackward':
      return planOrderCommand(context, command)
    case 'group.create':
    case 'group.ungroup':
      return planGroupCommand(context, command)
    case 'viewport.set':
    case 'viewport.panBy':
    case 'viewport.zoomBy':
    case 'viewport.zoomTo':
    case 'viewport.reset':
      return planViewportCommand(context, command)
    case 'mindmap.create':
    case 'mindmap.replace':
    case 'mindmap.delete':
    case 'mindmap.addChild':
    case 'mindmap.addSibling':
    case 'mindmap.moveSubtree':
    case 'mindmap.removeSubtree':
    case 'mindmap.cloneSubtree':
    case 'mindmap.toggleCollapse':
    case 'mindmap.setNodeData':
    case 'mindmap.reorderChild':
    case 'mindmap.setSide':
    case 'mindmap.attachExternal':
      return planMindmapCommand(context, command)
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown command type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}
