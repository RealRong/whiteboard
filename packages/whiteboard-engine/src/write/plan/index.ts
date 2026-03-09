import type { WriteInstance } from '@engine-types/write'
import type { WriteInput } from '@engine-types/command'
import type { Draft } from '../draft'
import { invalid } from '../draft'
import { node as planNode } from './node'
import { edge as planEdge } from './edge'
import { mindmap as planMindmap } from './mindmap'

export const plan = ({
  instance
}: {
  instance: WriteInstance
}) => {
  const node = planNode({ instance })
  const edge = planEdge({ instance })
  const mindmap = planMindmap({ instance })

  return (payload: WriteInput): Draft => {
    switch (payload.domain) {
      case 'node':
        return node(payload.command)
      case 'edge':
        return edge(payload.command)
      case 'mindmap':
        return mindmap(payload.command)
      default:
        return invalid('Unsupported write action domain.')
    }
  }
}
