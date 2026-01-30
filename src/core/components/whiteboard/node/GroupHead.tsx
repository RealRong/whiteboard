import { IWhiteboardNode } from '~/typings'
import { AutosizeTextarea, Icon } from '@/components'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useTranslation } from 'react-i18next'

export default ({ node }: { node: IWhiteboardNode & { type: 'group' } }) => {
  const instance = useWhiteboardInstance()
  const { t } = useTranslation()
  return (
    <div
      className={'flex items-center gap-3 cursor-grab transparent-font group-head'}
      style={{
        fontSize: 'calc(22px * var(--zoom-level))',
        position: 'absolute',
        top: -10,
        left: 4,
        transform: 'translateY(-100%)'
      }}
    >
      <AutosizeTextarea
        value={node.name}
        onChange={e => instance.updateNode?.({ id: node.id, name: e })}
        placeholder={t('general.Untitled')}
        className={'cursor-text leading-tight'}
      />
    </div>
  )
}
