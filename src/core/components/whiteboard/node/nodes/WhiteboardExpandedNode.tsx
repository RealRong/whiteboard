// id: meta object id
import { MetaStore } from '@/api/stores'
import { useTranslation } from 'react-i18next'

export default ({ id }: { id: number }) => {
  const meta = MetaStore.useValue(id)
  const { t } = useTranslation()
  if (!meta || meta.deleted) {
    return <div className={'small-transparent'}>{t('general.Deleted file')}</div>
  }
  switch (meta.type) {
    case 'chat': {
      return
    }
    case 'whiteboard': {
      return
    }
    case 'note': {
      return
    }
    case 'group': {
      return
    }
    case 'audio': {
      return
    }
    case 'examQuestion': {
      return
    }
    case 'code': {
      return
    }
    case 'exam': {
      return
    }
    case 'webpage': {
      return
    }
    case 'message': {
      return
    }
    case 'video': {
      return
    }
    case 'tweet': {
      return
    }
    case 'syncedBlock': {
      return
    }
  }
}
