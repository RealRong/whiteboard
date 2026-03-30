import type { Point } from '@whiteboard/core/types'
import type { ValueStore } from '@whiteboard/engine'
import type { ViewportRead } from '../../viewport'

export type PointerSnapshot = {
  client: Point
  screen: Point
  world: Point
}

export type PointerSnapshotStore = Pick<ValueStore<PointerSnapshot | null>, 'get' | 'set'>

export const readPointerSnapshot = (
  viewport: ViewportRead,
  input: {
    clientX: number
    clientY: number
  }
): PointerSnapshot => {
  const point = viewport.pointer(input)

  return {
    client: {
      x: input.clientX,
      y: input.clientY
    },
    screen: point.screen,
    world: point.world
  }
}
