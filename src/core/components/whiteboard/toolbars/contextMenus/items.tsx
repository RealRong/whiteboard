import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { t } from 'i18next'
import { Button, ColorPicker, Content, Icon, WithBorder } from '@/components'
import { ClassName } from 'rendevoz'
import { Colors } from '@/consts'
import material from 'material-colors'
import tinycolor from 'tinycolor2'
import { useState } from 'react'

const bgColors = [
  material.grey[50],
  material.brown[200],
  material.orange[200],
  material.amber[200],
  material.lightGreen[300],
  material.teal[200],
  material.blue[200],
  material.indigo[200],
  material.purple[200],
  material.pink[200],
  material.red[300]
]
export const WhiteboardNodeMenuItems = (instance: IWhiteboardInstance, selected: IWhiteboardNode[]) => {
  const edgeColor = selected.find(i => i.type === 'mindmap')?.edgeColor
  return {
    MindmapLineOptions: {
      type: 'item',
      icon: 'park-mind-mapping',
      key: 'mindmap-line-options',
      text: t('whiteboard.Mindmap line style'),
      popOver: {
        key: 'mindmap-line-options-popover',
        node: <MindmapFormatter selected={selected} instance={instance} color={edgeColor} />
      }
    }
  }
}

const MindmapFormatter = ({
  color,
  selected,
  instance
}: {
  color: string | undefined
  instance: IWhiteboardInstance
  selected: IWhiteboardNode[]
}) => {
  const [edgeColor, setEdgeColor] = useState(color)
  return (
    <WithBorder className={'p-3'}>
      <div className={'menu-sub-title mb-1.5'}>{t('whiteboard.Mindmap connection type')}</div>
      <div className={'flex gap-2 -ml-1.5 mb-3'}>
        {[
          {
            icon: 'park-right-branch-two',
            text: t('whiteboard.Curve'),
            key: 'curve'
          },
          {
            icon: 'park-right-branch-one',
            text: t('whiteboard.Tight curve'),
            key: 'tightCurve'
          },
          {
            icon: 'custom-mindmap-connection-branch',
            text: t('whiteboard.Polyline'),
            key: 'polyline'
          }
        ].map(i => (
          <Icon
            onClick={() => {
              instance.updateWhiteboard?.(w => {
                selected.forEach(n => {
                  if (n.type === 'mindmap') {
                    const o = w.nodes?.get(n.id)
                    if (o) {
                      w.nodes?.set(o.id, {
                        ...o,
                        edgeType: i.key
                      })
                    }
                  }
                })
              }, true)
            }}
            size={22}
            className={'square-button'}
            name={i.icon}
            key={i.text}
          />
        ))}
      </div>
      <div className={'menu-sub-title mb-2'}>{t('whiteboard.Mindmap connection color')}</div>
      <div className={'grid grid-cols-6 gap-2.5'}>
        <div
          style={{
            boxShadow: undefined === edgeColor ? `0 0 0 2px var(--border-background) inset` : '0 0 0 1px var(--border-background) inset',
            width: 26,
            height: 26,
            borderRadius: 6
          }}
          className={'cursor-pointer'}
          onClick={() => {
            setEdgeColor(undefined)
            instance.updateWhiteboard?.(w => {
              selected.forEach(n => {
                if (n.type === 'mindmap') {
                  const o = w.nodes?.get(n.id)
                  if (o) {
                    w.nodes?.set(o.id, {
                      ...o,
                      edgeColor: undefined
                    })
                  }
                }
              })
            }, true)
          }}
        ></div>
        {bgColors.map(i => (
          <div
            style={{
              background: `rgb(from ${Colors.getAdaptColor(i)} r g b / var(--editor-bg-opacity))`,
              boxShadow:
                i === edgeColor
                  ? `rgb(from ${tinycolor(Colors.getAdaptColor(i)).toRgbString()} r g b) 0 0 0 2px inset`
                  : `rgb(from ${Colors.getAdaptColor(i)} r g b / 0.8) 0 0 0 1px inset`,
              width: 26,
              height: 26,
              borderRadius: 6
            }}
            className={'cursor-pointer'}
            key={i}
            onClick={() => {
              setEdgeColor(i)
              instance.updateWhiteboard?.(w => {
                selected.forEach(n => {
                  if (n.type === 'mindmap') {
                    const o = w.nodes?.get(n.id)
                    if (o) {
                      w.nodes?.set(o.id, {
                        ...o,
                        edgeColor: i
                      })
                    }
                  }
                })
              }, true)
            }}
          ></div>
        ))}
      </div>
    </WithBorder>
  )
}
