import { FreehandPoint, IWhiteboard, IWhiteboardNode } from '~/typings'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'

const groupFreehands = (updater: (up: (draft: IWhiteboard) => void) => void, ids: number[]) => {
  updater(draft => {
    const nodes = draft.nodes
    if (nodes) {
      const freehandIds = ids.filter(id => nodes.get(id)?.type === 'freehand')
      const freehandNodes = freehandIds.map(id => nodes.get(id)) as (IWhiteboardNode & { type: 'freehand' })[]
      const box = getBoxOfBoxes(freehandNodes.map(i => ({ left: i.x, top: i.y, width: i.width, height: i.height })))
      if (!box) return
      const normalizePoint = (point: [number, number, number], deltaX: number, deltaY: number): FreehandPoint => {
        const [x, y, pressure] = point
        return [x + deltaX, y + deltaY, pressure]
      }
      const normalizedPoints = freehandNodes.map(n => {
        const points = n.points
        const deltaLeft = n.x - box.left
        const deltaTop = n.y - box.top
        if (Array.isArray(points[0][0])) {
          return (points as FreehandPoint[][]).flatMap(p => p.map(o => normalizePoint(o, deltaLeft, deltaTop)))
        } else {
          return (points as FreehandPoint[]).map(p => normalizePoint(p, deltaLeft, deltaTop))
        }
      })
      const first = freehandIds.shift()
      freehandIds.forEach(id => {
        draft.nodes?.delete(id)
      })
      nodes.set(first, {
        ...nodes.get(first),
        points: normalizedPoints,
        x: box.left,
        y: box.top,
        width: box.width,
        height: box.height
      })
    }
  })
}

export default groupFreehands
