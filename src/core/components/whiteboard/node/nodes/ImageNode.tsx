import { IWhiteboardNode } from '~/typings/data'

const ImageNode = ({ node }: { node: IWhiteboardNode & { type: 'image' } }) => {
  return <img style={{ flex: 1, width: '100%', height: '100%' }} src={node.imageUrl} />
}

export default ImageNode
