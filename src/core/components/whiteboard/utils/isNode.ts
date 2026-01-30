import { IWhiteboardNode } from '~/typings'

const isTextNode = (n: IWhiteboardNode) => {
  return n.type === 'text' || (n.type === 'mindmap' && n.nodeType === 'text')
}

export default {
  isTextNode
}
