import * as React from 'react'

const rowSizeBase = {
  width: '100%',
  height: '10px',
  top: '0px',
  left: '0px',
  cursor: 'row-resize'
} as const

const colSizeBase = {
  width: '10px',
  height: '100%',
  top: '0px',
  left: '0px',
  cursor: 'col-resize'
} as const

const edgeBase = {
  width: '20px',
  height: '20px',
  position: 'absolute'
} as const

const styles: { [key: string]: React.CSSProperties } = {
  top: {
    ...rowSizeBase,
    top: '-5px'
  },
  right: {
    ...colSizeBase,
    left: undefined,
    right: '-5px'
  },
  bottom: {
    ...rowSizeBase,
    top: undefined,
    bottom: '-5px'
  },
  left: {
    ...colSizeBase,
    left: '-5px'
  },
  topRight: {
    ...edgeBase,
    right: '-10px',
    top: '-10px',
    cursor: 'ne-resize'
  },
  bottomRight: {
    ...edgeBase,
    right: '-10px',
    bottom: '-10px',
    cursor: 'se-resize'
  },
  bottomLeft: {
    ...edgeBase,
    left: '-10px',
    bottom: '-10px',
    cursor: 'sw-resize'
  },
  topLeft: {
    ...edgeBase,
    left: '-10px',
    top: '-10px',
    cursor: 'nw-resize'
  }
} as const

export type Direction = 'top' | 'right' | 'bottom' | 'left' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'topLeft'

export type OnStartCallback = (e: PointerEvent, dir: Direction, cursor?: string) => void

export interface Props {
  direction: Direction
  onResizeStart: OnStartCallback
}

export class Resizer extends React.PureComponent<Props> {
  render() {
    return (
      <div
        className={'absolute select-none'}
        style={{
          pointerEvents: 'inherit',
          ...styles[this.props.direction]
        }}
        onPointerDown={e => {
          e.stopPropagation()
          this.props.onResizeStart(e.nativeEvent, this.props.direction, styles[this.props.direction]?.cursor)
        }}
      ></div>
    )
  }
}
