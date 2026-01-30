import { MetaStore, ObjectStore } from '@/api/stores'
import { Content, Icon } from '@/components'
import { ClassName } from 'rendevoz'
import { useMemo } from 'react'
import { MetaObject } from '~/typings'
import { Colors } from '@/consts'
import { useIsIn } from '@/hooks'
import { useTranslation } from 'react-i18next'
import trans from '@/consts/trans'
import classnames from 'classnames'

export default ({ metaId }: { metaId: number }) => {
  const whiteboardMeta = MetaStore.useValue(metaId)
  const obj = ObjectStore('whiteboard').useValue(whiteboardMeta?.objectId)
  const contains = useMemo(() => {
    if (obj?.nodes) {
      const metaMap = MetaStore.getMetaObjectsMap()
      const cards = Array.from(obj.nodes.values()).filter(i => i.type === 'metaObject')
      const objs = cards
        .map(i => ({ ...metaMap.get(i.metaObjectId), whiteboardCardId: i.id }))
        .filter(i => i)
        .sort((a, b) => (b.name || b.placeholderName || '').length - (a.name || a.placeholderName || '').length) as (MetaObject & {
        whiteboardCardId: number
      })[]
      const noRepeatObjs = Array.from(new Map(objs.map(i => [i.id, i])).values())
      return {
        objs: noRepeatObjs,
        num: noRepeatObjs.length,
        whiteboards: noRepeatObjs.filter(i => i.type === 'whiteboard').length
      }
    }
  }, [obj?.nodes])
  const { ref, isIn } = useIsIn()
  const { t } = useTranslation()
  return (
    <Content
      ref={ref}
      style={{
        padding: 24,
        width: 650,
        minWidth: '100%',
        maxWidth: '100%',
        minHeight: '100%',
        maxHeight: '100%'
      }}
    >
      <div
        onClick={() => {
          if (whiteboardMeta) {
            Global.layoutOps?.openObject(whiteboardMeta.id)
          }
        }}
        className={classnames(
          'text-2xl cursor-pointer w-fit font-bold flex items-center gap-3',
          !whiteboardMeta?.name && 'super-transparent-font'
        )}
      >
        <Icon strokeWidth={4} name={Global.utils.getIcon('whiteboard')} />
        <div className={'line-clamp-1'}>{whiteboardMeta?.name || t(trans.Unnamed)}</div>
      </div>
      {contains?.objs && (
        <Content
          flex
          gap={8}
          style={{
            flexWrap: 'wrap',
            marginTop: 12
          }}
        >
          {contains.objs
            .filter(i => i.name)
            .map(i => (
              <div
                key={i.id}
                className={ClassName.ellipsisFont(1)}
                style={{
                  padding: '4px 12px',
                  border: '1px solid var(--border-background)',
                  borderRadius: 8,
                  background: Colors.Background.Global,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  Global.layoutOps?.openObject<'whiteboard'>(metaId).then(ins => {
                    if (ins) {
                      setTimeout(() => {
                        ins.containerOps?.fitToNode(i.whiteboardCardId)
                        ins.selectOps?.selectNode(i.whiteboardCardId)
                      }, 100)
                    }
                  })
                }}
              >
                {i.name}
              </div>
            ))}
        </Content>
      )}
    </Content>
  )
}
