import { Icon, WithBorder } from '@/components'
import material from 'material-colors'
import { Colors } from '@/consts'
import tinycolor from 'tinycolor2'
import { useTranslation } from 'react-i18next'
import { CSSProperties, memo, useState } from 'react'

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

export default memo(
  ({
    showBorder,
    onBackgroundChange,
    onBorderTypeChange,
    onBorderChange,
    background,
    borderUnderline,
    border,
    borderType
  }: {
    showBorder?: boolean
    borderUnderline?: boolean
    onBorderChange?: (border: string | undefined) => void
    onBackgroundChange: (bg: string | undefined) => void
    onBorderTypeChange?: (type: string) => void
    background?: string
    border?: string
    borderType?: stringc
  }) => {
    const [selected, setSelected] = useState({
      background,
      border,
      borderType
    })
    const defaultStyle: CSSProperties = {
      background: 'var(--font-primary)',
      transform: 'translateY(-50%) rotate(45deg)',
      position: 'absolute',
      opacity: 0.15,
      transformOrigin: 'center',
      width: 2,
      height: '70%',
      top: '50%',
      marginLeft: -1,
      left: '50%'
    }
    const { t } = useTranslation()
    return (
      <WithBorder className={'p-3 w-max'}>
        {showBorder && (
          <>
            <div className={'menu-sub-title mb-1'}>{t('whiteboard.Border type')}</div>
            <div className={'flex gap-1 -ml-1.5 mb-2'}>
              {[
                {
                  icon: 'custom-rect',
                  text: t('whiteboard.Rect border'),
                  key: 'rect'
                },
                {
                  icon: 'custom-round-rect',
                  text: t('whiteboard.Round rect border'),
                  key: 'roundRect'
                },
                {
                  icon: 'custom-round',
                  text: t('whiteboard.Round border'),
                  key: 'round'
                },
                borderUnderline
                  ? {
                      icon: 'custom-border-bottom',
                      text: t('whiteboard.Underline border'),
                      key: 'underline'
                    }
                  : undefined
              ].map(
                i =>
                  i && (
                    <Icon
                      size={22}
                      className={'square-button'}
                      name={i.icon}
                      key={i.text}
                      onClick={() => {
                        onBorderTypeChange?.(i.key)
                      }}
                    />
                  )
              )}
            </div>
            <div className={'menu-sub-title mb-2'}>{t('whiteboard.Border color')}</div>
            <div className={'grid grid-cols-6 gap-2.5 mb-4'}>
              <div
                style={{
                  boxShadow: `0 0 0 ${undefined === selected.border ? '3px' : '2px'} inset var(--border-background)`,
                  width: 26,
                  height: 26,
                  borderRadius: 6
                }}
                className={'cursor-pointer relative'}
                onClick={() => {
                  onBorderChange?.(undefined)
                  setSelected({ ...selected, border: undefined })
                }}
              >
                <div style={defaultStyle}></div>
              </div>
              {bgColors.map(i => (
                <div
                  style={{
                    boxShadow: `0 0 0 ${i === selected.border ? '3px' : '2px'} inset ${Colors.getAdaptColor(i)}`,
                    width: 26,
                    height: 26,
                    borderRadius: 6
                  }}
                  className={'cursor-pointer'}
                  key={i}
                  onClick={() => {
                    onBorderChange?.(i)
                    setSelected({ ...selected, border: i })
                  }}
                ></div>
              ))}
            </div>
          </>
        )}
        <div className={'menu-sub-title mb-2'}>{t('general.Background color')}</div>
        <div className={'grid grid-cols-6 gap-2.5'}>
          <div
            style={{
              boxShadow:
                undefined === selected.background ? `0 0 0 2px var(--border-background) inset` : '0 0 0 1px var(--border-background) inset',
              fontSize: 16,
              width: 26,
              height: 26,
              borderRadius: 6
            }}
            className={'cursor-pointer relative'}
            onClick={() => {
              onBackgroundChange(undefined)
              setSelected({ ...selected, background: undefined })
            }}
          >
            <div style={defaultStyle}></div>
          </div>
          {bgColors.map(i => (
            <div
              style={{
                background: `rgb(from ${Colors.getAdaptColor(i)} r g b / var(--editor-bg-opacity))`,
                boxShadow:
                  i === selected.background
                    ? `rgb(from ${tinycolor(Colors.getAdaptColor(i)).toRgbString()} r g b) 0 0 0 2px inset`
                    : `rgb(from ${Colors.getAdaptColor(i)} r g b / 0.8) 0 0 0 1px inset`,
                fontSize: 16,
                width: 26,
                height: 26,
                borderRadius: 6
              }}
              className={'cursor-pointer'}
              key={i}
              onClick={() => {
                onBackgroundChange(i)
                setSelected({ ...selected, background: i })
              }}
            ></div>
          ))}
        </div>
      </WithBorder>
    )
  }
)
