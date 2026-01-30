import { IWhiteboardNode } from '~/typings'

export default (selected: IWhiteboardNode[]) => {
  const first = selected[0]
  const length = selected.length
  return {
    showMindmapConnection: first.type === 'mindmap' && length === 1,
    showBorder: !selected.every(i => i.type === 'group'),
    showGroupOptions: length > 1,
    showAlignPackOptions: length > 1 && !selected.some(i => i.type === 'mindmap' || i.rootId),
    showMetaOptions: length === 1 && first.type === 'metaObject',
    isText: length === 1 && first.type === 'text',
    showBorderType: !selected.every(i => i.type === 'group')
  }
}
