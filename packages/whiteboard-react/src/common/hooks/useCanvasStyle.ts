import { useMemo } from 'react'
import type { CSSProperties } from 'react'

export const useCanvasStyle = (style?: CSSProperties) => {
  return useMemo<CSSProperties>(
    () => ({
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #f7f7f8 0%, #ffffff 60%)',
      touchAction: 'none',
      userSelect: 'none',
      ...style
    }),
    [style]
  )
}
