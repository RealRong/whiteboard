import { useWhiteboardNodes } from '@/core/components/whiteboard/StateHooks'
import { useEffect, useRef, useState } from 'react'
import { IWhiteboardInstance, IWhiteboardOutline } from '~/typings'
import { useDebounceEffect } from '@/hooks'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { Icon, Menu, WithBorder } from '@/components'
import { useTranslation } from 'react-i18next'
import classNames from 'classnames'
import ContextMenu from '@/components/contextMenu'
import getNodeMenu from '@/core/components/whiteboard/toolbars/contextMenus/getNodeMenu'
import classnames from 'classnames'
import trans from '@/consts/trans'
import NoResult from '@/core/components/common/NoResult'

export default ({ onClose }: { onClose: VoidFunction }) => {
  const nodes = useWhiteboardNodes()
  const instance = useWhiteboardInstance()
  const [outline, setOutline] = useState<Record<string, IWhiteboardOutline[]>>()
  const [s, setS] = useState(0)
  const [selected, setSelected] = useState<number>()
  const { t } = useTranslation()
  useEffect(() => {
    const interval = setInterval(() => {
      setS(g => g + 1)
    }, 500)
    return () => {
      clearInterval(interval)
    }
  }, [])
  useDebounceEffect(
    () => {
      const outline = instance.contentOps?.transformToOutline()
      if (outline) {
        setOutline(outline)
        const s = new Set((instance.selectOps?.getSelectedNodes?.() || []).map(i => i.id))
        setSelected(selected && s.has(selected) ? selected : s.size === 1 ? s.values().next().value : undefined)
      }
    },
    [nodes, s],
    { wait: 300, leading: true }
  )
  const keyToTranslation = (key: IWhiteboardOutline['type']) => {
    if (key === 'whiteboard group') {
      return t('whiteboard.Group')
    }
    if (key === 'whiteboard mindmap') {
      return t('general.Mindmap')
    }
    if (key === 'whiteboard text') {
      return t('whiteboard.Text')
    }
    return Global.utils.getTypeName(key)
  }
  return (
    <WithBorder className={'min-h-64 max-h-96 overflow-y-auto w-96 p-2 flex flex-col'}>
      <div className={'flex items-start justify-between'}>
        <div className={'font-bold pl-1.5 pt-1'}>{t('whiteboard.Contents')}</div>
        <Icon size={12} strokeWidth={4} onClick={onClose} name={'park-close'} className={'rounded-button bg-third'} />
      </div>
      {outline && Object.keys(outline).length ? (
        <>
          {Object.entries(outline)
            .sort((b, a) => {
              if (a[0].startsWith('whiteboard')) {
                if (a[0] === 'whiteboard group') {
                  return 100000
                }
                return 5000
              }
              if (b[0].startsWith('whiteboard')) {
                if (b[0] === 'whiteboard group') {
                  return -100000
                }
                return -5000
              }
              return 1
            })
            .map(i => (
              <div className={'mt-4'}>
                <div className={'menu-sub-title pl-2 mb-1'}>{keyToTranslation(i[0])}</div>
                {i[1].map(i => (
                  <GroupOutline
                    selected={selected}
                    onClick={id => {
                      setSelected(id)
                    }}
                    instance={instance}
                    outline={i}
                    key={i.nodeId}
                  />
                ))}
              </div>
            ))}
        </>
      ) : (
        <NoResult />
      )}
    </WithBorder>
  )
}

const GroupOutline = ({
  outline,
  instance,
  onClick,
  selected
}: {
  outline: IWhiteboardOutline
  instance: IWhiteboardInstance
  onClick?: (id: number) => void
  selected: number | undefined
}) => {
  const [toggled, setToggled] = useState(true)
  let isSelected = false
  const { t } = useTranslation()
  const closeRef = useRef<VoidFunction>()
  useEffect(() => {
    const close = closeRef.current
    if (close) {
      instance.addEventListener('closeToolbar', close)
      return () => {
        instance.removeEventListener('closeToolbar', close)
      }
    }
  })
  if (selected) {
    if (selected === outline.nodeId) {
      isSelected = true
    }
    if (outline.children?.length && toggled === true) {
      const loopChildren = (c: IWhiteboardOutline[]) => {
        c.forEach(i => {
          if (i.nodeId === selected) {
            isSelected = true
          }
          if (i.children?.length) {
            loopChildren(i.children)
          }
        })
      }
      loopChildren(outline.children)
    }
  }
  return (
    <>
      <ContextMenu
        onContextMenu={() => {
          instance.selectOps?.selectNode(outline.nodeId)
          onClick?.(outline.nodeId)
        }}
        content={setV => {
          closeRef.current = () => setV(false)
          return (
            <WithBorder padding={'0.4rem 0'} width={250} borderRadius={'0.25rem'}>
              <Menu.NavigationMenu layout={getNodeMenu(instance, t, outline.nodeId) || []} />
            </WithBorder>
          )
        }}
      >
        <div
          className={classNames('button flex font-size-13 gap-2 items-center', isSelected && 'active-button')}
          key={outline.nodeId}
          onClick={e => {
            e.preventDefault()
            onClick?.(outline.nodeId)
            instance.containerOps?.fitToNode(outline.nodeId)
            instance.selectOps?.deselectAll(outline.nodeId)
            instance.selectOps?.selectNode(outline.nodeId)
          }}
        >
          {outline.children?.length ? (
            <Icon
              strokeWidth={4}
              theme={'filled'}
              name={'park-right'}
              className={classnames('transition-transform', !toggled && 'rotate-90')}
              onClick={e => {
                setToggled(!toggled)
                e.stopPropagation()
              }}
            />
          ) : null}
          <div className={classnames('line-clamp-1', !outline.name && 'super-transparent-font')}>{outline.name || t(trans.Unnamed)}</div>
        </div>
      </ContextMenu>
      {!toggled && (
        <div className={'flex flex-col ml-4 pl-3'}>
          {outline.children?.map(i => (
            <GroupOutline onClick={onClick} selected={selected} outline={i} key={i.nodeId} instance={instance} />
          ))}
        </div>
      )}
    </>
  )
}
