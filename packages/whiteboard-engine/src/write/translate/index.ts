import type { WriteInstance } from '@engine-types/write'
import type { WriteCommandMap, WriteDomain, WriteInput, WriteOutput } from '@engine-types/command'
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

  return <D extends WriteDomain, C extends WriteCommandMap[D]>(
    payload: WriteInput<D, C>
  ): Draft<WriteOutput<D, C>> => {
    switch (payload.domain) {
      case 'node':
        return node(payload.command as WriteCommandMap['node']) as Draft<WriteOutput<D, C>>
      case 'edge':
        return edge(payload.command as WriteCommandMap['edge']) as Draft<WriteOutput<D, C>>
      case 'mindmap':
        return mindmap(payload.command as WriteCommandMap['mindmap']) as Draft<WriteOutput<D, C>>
      default:
        return invalid('Unsupported write action domain.') as Draft<WriteOutput<D, C>>
    }
  }
}
