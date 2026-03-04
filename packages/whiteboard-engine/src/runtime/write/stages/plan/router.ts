import type { InternalInstance } from '@engine-types/instance/engine'
import type { WriteInput } from '@engine-types/command/api'
import type { Draft } from './draft'
import { invalid } from './draft'
import { node as planNode } from './domains/node'
import { edge as planEdge } from './domains/edge'
import { viewport as planViewport } from './domains/viewport'
import { mindmap as planMindmap } from './domains/mindmap'

export const plan = ({
  instance
}: {
  instance: Pick<
    InternalInstance,
    'document' | 'config' | 'registries' | 'viewport'
  >
}) => {
  const node = planNode({ instance })
  const edge = planEdge({ instance })
  const viewport = planViewport({ instance })
  const mindmap = planMindmap({ instance })

  return (payload: WriteInput): Draft => {
    switch (payload.domain) {
      case 'node':
        return node(payload.command)
      case 'edge':
        return edge(payload.command)
      case 'viewport':
        return viewport(payload.command)
      case 'mindmap':
        return mindmap(payload.command)
      default:
        return invalid('Unsupported write action domain.')
    }
  }
}
