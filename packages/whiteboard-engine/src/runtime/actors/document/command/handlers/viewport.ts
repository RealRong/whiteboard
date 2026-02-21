import type { Command } from '@engine-types/command'
import { operationsPlan, invalidPlan, type ReduceContext } from './helpers'

type ViewportCommand = Extract<
  Command,
  | { type: 'viewport.set' }
  | { type: 'viewport.panBy' }
  | { type: 'viewport.zoomBy' }
  | { type: 'viewport.zoomTo' }
  | { type: 'viewport.reset' }
>

export const planViewportCommand = (
  context: ReduceContext,
  command: ViewportCommand
) => {
  switch (command.type) {
    case 'viewport.set': {
      if (!Number.isFinite(command.viewport.center.x) || !Number.isFinite(command.viewport.center.y)) {
        return invalidPlan('Missing viewport center.')
      }
      if (!Number.isFinite(command.viewport.zoom) || command.viewport.zoom <= 0) {
        return invalidPlan('Invalid viewport zoom.')
      }
      const before = context.core.query.viewport()
      return operationsPlan(
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: { x: command.viewport.center.x, y: command.viewport.center.y },
              zoom: command.viewport.zoom
            }
          }
        ]
      )
    }
    case 'viewport.panBy': {
      if (!Number.isFinite(command.delta.x) || !Number.isFinite(command.delta.y)) {
        return invalidPlan('Invalid pan delta.')
      }
      const before = context.core.query.viewport()
      return operationsPlan(
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: {
                x: before.center.x + command.delta.x,
                y: before.center.y + command.delta.y
              },
              zoom: before.zoom
            }
          }
        ]
      )
    }
    case 'viewport.zoomBy': {
      if (!Number.isFinite(command.factor) || command.factor <= 0) {
        return invalidPlan('Invalid zoom factor.')
      }
      if (
        command.anchor &&
        (!Number.isFinite(command.anchor.x) || !Number.isFinite(command.anchor.y))
      ) {
        return invalidPlan('Invalid zoom anchor.')
      }
      const before = context.core.query.viewport()
      const afterCenter = command.anchor
        ? {
            x: command.anchor.x - (command.anchor.x - before.center.x) / command.factor,
            y: command.anchor.y - (command.anchor.y - before.center.y) / command.factor
          }
        : before.center
      return operationsPlan(
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: afterCenter,
              zoom: before.zoom * command.factor
            }
          }
        ]
      )
    }
    case 'viewport.zoomTo': {
      if (!Number.isFinite(command.zoom) || command.zoom <= 0) {
        return invalidPlan('Invalid viewport zoom.')
      }
      if (
        command.anchor &&
        (!Number.isFinite(command.anchor.x) || !Number.isFinite(command.anchor.y))
      ) {
        return invalidPlan('Invalid zoom anchor.')
      }
      const before = context.core.query.viewport()
      if (before.zoom === 0) {
        return operationsPlan(
          [
            {
              type: 'viewport.update',
              before,
              after: { center: { x: 0, y: 0 }, zoom: command.zoom }
            }
          ]
        )
      }
      const factor = command.zoom / before.zoom
      const afterCenter = command.anchor
        ? {
            x: command.anchor.x - (command.anchor.x - before.center.x) / factor,
            y: command.anchor.y - (command.anchor.y - before.center.y) / factor
          }
        : before.center
      return operationsPlan(
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: afterCenter,
              zoom: command.zoom
            }
          }
        ]
      )
    }
    case 'viewport.reset': {
      const before = context.core.query.viewport()
      return operationsPlan(
        [
          {
            type: 'viewport.update',
            before,
            after: { center: { x: 0, y: 0 }, zoom: 1 }
          }
        ]
      )
    }
    default: {
      const exhaustive: never = command
      throw new Error(`Unknown command type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}
