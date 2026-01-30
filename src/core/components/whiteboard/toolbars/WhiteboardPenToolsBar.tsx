import { WithBorder, Toolbar, AnimatePopover, Content, Slider, ColorPicker } from '@/components'
import { useWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import produce from 'immer'
import { atom, useAtom } from 'jotai'
import { Colors } from '@/consts'
import placeholder from '@/assets/images/placeholder.svg'
import { css } from '@emotion/css'
import { useEffect, useState } from 'react'
import { defaultBgColor } from '@/components/picker/colorPicker'
import UseDebounceEffect from '@/hooks/utils/useDebounceEffect'
import { useTranslation } from 'react-i18next'
import { useDebounceFn, useSelectAtomValue, useUpdateEffect } from '@/hooks'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'

const PenStyleAtom = atom({
  ballpen: {
    first: {
      opacity: 1,
      width: 8,
      color: 'default'
    },
    second: {
      opacity: 1,
      width: 12,
      color: 'default'
    },
    third: {
      opacity: 1,
      width: 12,
      color: '#f44336'
    }
  },
  marker: {
    first: {
      opacity: 1,
      width: 16,
      color: '#ffd54f'
    },
    second: {
      opacity: 1,
      width: 12,
      color: '#bf360c'
    },
    third: {
      opacity: 1,
      width: 20,
      color: 'default'
    }
  },
  pen: {
    first: {
      opacity: 1,
      width: 8,
      color: 'default'
    },
    second: {
      opacity: 1,
      width: 12,
      color: '#ffd54f'
    },
    third: {
      opacity: 1,
      width: 12,
      color: '#bf360c'
    }
  }
})
const WhiteboardPenToolsBar = () => {
  const [whiteboardState, setWhiteboardState] = useWhiteboardState()
  const whiteboardPenStyles = useSelectAtomValue(WhiteboardAtom, s => s?.penStyles)
  const penType = whiteboardState.freeHandConfig.type || 'ballpen'
  const [penStyles, setPenStyles] = useAtom(PenStyleAtom)
  const [selectedPenStyle, setSelectedPenStyle] = useState('first')
  const instance = useWhiteboardInstance()
  const changePenType = (type: (typeof whiteboardState)['freeHandConfig']['type']) => {
    setWhiteboardState(s =>
      produce(s, draft => {
        draft.freeHandConfig.type = type
      })
    )
  }
  useEffect(() => {
    if (whiteboardPenStyles) {
      setPenStyles(whiteboardPenStyles)
    }
  }, [])
  const debounceUpdate = useDebounceFn(instance.updateWhiteboard)
  useUpdateEffect(() => {
    debounceUpdate.run(d => {
      d.penStyles = penStyles
    }, false)
  }, [penStyles])
  UseDebounceEffect(
    () => {
      const selected = penStyles[penType][selectedPenStyle]
      setWhiteboardState(s => ({
        ...s,
        freeHandConfig: {
          type: s.freeHandConfig.type,
          style: selected
        }
      }))
    },
    [penStyles, selectedPenStyle, penType],
    { wait: 300 }
  )
  useEffect(() => {
    setSelectedPenStyle('first')
  }, [penType])
  if (whiteboardState.currentTool === 'freehand' && penStyles[penType]) {
    return (
      <div
        className={'p-1.5 border-box-shadow bg-popover left-1/2 -translate-x-1/2 absolute z-10 rounded-md'}
        style={{
          bottom: 20
        }}
      >
        <Toolbar itemSize={'icon-16'}>
          <Toolbar.Item iconName={'custom-ballpen'} onClick={() => changePenType('ballpen')} isActive={penType === 'ballpen'} />
          <Toolbar.Item iconName={'custom-markerpen'} onClick={() => changePenType('marker')} isActive={penType === 'marker'} />
          <Toolbar.Item iconName={'custom-pen'} onClick={() => changePenType('pen')} isActive={penType === 'pen'} />
          <Toolbar.Separator direction={'horizontal'} />
          <PenStyle
            style={penStyles[penType].first}
            selected={selectedPenStyle === 'first'}
            onClick={() => setSelectedPenStyle('first')}
            onChange={s => {
              setPenStyles(f =>
                produce(f, draft => {
                  draft[penType].first = s
                })
              )
            }}
          />
          <PenStyle
            style={penStyles[penType].second}
            onClick={() => setSelectedPenStyle('second')}
            selected={selectedPenStyle === 'second'}
            onChange={s => {
              setPenStyles(f =>
                produce(f, draft => {
                  draft[penType].second = s
                })
              )
            }}
          />
          <PenStyle
            style={penStyles[penType].third}
            onClick={() => setSelectedPenStyle('third')}
            selected={selectedPenStyle === 'third'}
            onChange={s => {
              setPenStyles(f =>
                produce(f, draft => {
                  draft[penType].third = s
                })
              )
            }}
          />
        </Toolbar>
      </div>
    )
  }
  return null
}

const MAX_PEN_WIDTH = 30
export type IPenStyle = {
  width: number
  opacity: number
  color: string
}
const PenStyle = ({
  style,
  onChange,
  selected,
  onClick
}: {
  selected: boolean
  style: IPenStyle
  onChange: (s: IPenStyle) => void
  onClick: VoidFunction
}) => {
  const { width = 4, opacity = 1, color = 'default' } = style
  const c = color === 'default' ? Colors.Font.Primary : color
  const [visible, setVisible] = useState(false)
  return (
    <AnimatePopover
      withClickCover={true}
      visible={visible}
      onClickOutside={() => setVisible(false)}
      positions={['top']}
      padding={16}
      content={
        <WithBorder>
          <PenStyleMenu style={style} onChange={onChange} />
        </WithBorder>
      }
    >
      <div
        onClick={() => {
          onClick()
          if (selected) {
            setVisible(true)
          }
        }}
        style={{
          border: `1px solid ${selected ? Colors.Font.Primary : Colors.Background.Border}`,
          borderRadius: '50%',
          cursor: 'pointer',
          width: 24,
          height: 24,
          position: 'relative'
        }}
      >
        <div
          style={{
            width: ~~(24 * (Math.min(width, 24) / 20) * 0.75),
            height: ~~(24 * (Math.min(width, 24) / 20) * 0.75),
            background: c,
            borderRadius: '50%',
            opacity: opacity,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        ></div>
      </div>
    </AnimatePopover>
  )
}
const PenStyleMenu = ({ style, onChange }: { onChange: (newStyle: IPenStyle) => void; style: IPenStyle }) => {
  const c = style.color === 'default' ? Colors.Font.Primary : style.color
  const { t } = useTranslation()
  return (
    <div className={'p-3 overflow-y-auto w-64 max-h-64 flex flex-col gap-2'}>
      <div className={'menu-sub-title'}>
        {t('whiteboard.Brush thickness')}: {style.width}
      </div>
      <Slider
        value={style.width}
        min={1}
        max={MAX_PEN_WIDTH}
        step={1}
        style={{
          width: 'calc(100% - 4px)'
        }}
        onChange={v => onChange({ ...style, width: v })}
        className={css({
          '.rc-slider-handle': {
            border: `1px solid ${Colors.Background.Border}`,
            cursor: 'grabbing',
            backgroundColor: 'white !important',
            opacity: 1,
            ':hover': {
              borderColor: Colors.Background.Border
            },
            boxShadow: 'rgb(255,255,255) 0px 0px 0px 0px, rgba(0,0,0, 0.2) 0px 0px 0px 1px !important',
            ':active': {
              borderColor: `${Colors.Background.Border} !important`,
              boxShadow: 'rgb(255,255,255) 0px 0px 0px 0px, rgba(0,0,0, 0.2) 0px 0px 0px 1px !important'
            }
          }
        })}
      />
      <div className={'menu-sub-title mt-2'}>{t('whiteboard.Brush opacity')}</div>
      <Slider
        value={style.opacity}
        max={1}
        min={0}
        step={0.01}
        onChange={v => onChange({ ...style, opacity: v })}
        disableOriginalClass={true}
        className={css({
          '.rc-slider-handle': {
            border: `1px solid ${Colors.Background.Border}`,
            cursor: 'grabbing',
            marginTop: 0,
            backgroundColor: 'white !important',
            opacity: 1,
            ':hover': {
              borderColor: Colors.Background.Border
            },
            boxShadow: 'rgb(255,255,255) 0px 0px 0px 0px, rgba(0,0,0, 0.2) 0px 0px 0px 1px !important',
            ':active': {
              borderColor: `${Colors.Background.Border} !important`,
              boxShadow: 'rgb(255,255,255) 0px 0px 0px 0px, rgba(0,0,0, 0.2) 0px 0px 0px 1px !important'
            }
          },
          '.rc-slider-track': {
            backgroundColor: 'transparent !important'
          },
          '.rc-slider-rail': {
            backgroundColor: 'transparent !important'
          }
        })}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: 'calc(100% - 4px)',
          padding: '4px 0px',
          background: `linear-gradient(270deg,${c} 10%, rgba(255,255,255,0) 100%), url(${placeholder}) white`
        }}
      ></Slider>
      <div className={'menu-sub-title mt-2'}>{t('whiteboard.Brush color')}</div>
      <ColorPicker
        onPick={c => {
          onChange({ ...style, color: c === defaultBgColor ? 'default' : c })
        }}
        isFont={false}
        enableDefault={true}
        showLess={false}
      />
    </div>
  )
}
export default WhiteboardPenToolsBar
