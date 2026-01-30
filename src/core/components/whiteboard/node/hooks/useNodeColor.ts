import { useMemo } from 'react'
import { GlobalSetting } from '@/core'
import { Colors } from '@/consts'

const useNodeColor = (color: string | undefined, isGroup?: boolean) => {
  const isDark = GlobalSetting.useSelectSettingAtom('darkMode')
  return useMemo(() => {
    return {
      opacityBackground: color
        ? `rgb(from ${Colors.getAdaptColor(color)} r g b / ${isGroup ? 0.16 : 0.75})`
        : isGroup
          ? isDark
            ? 'rgba(255, 255, 255, 0.02)'
            : 'rgba(213, 213, 213, 0.1)'
          : 'rgb(from var(--background-secondary) r g b / 0.75)'
    }
  }, [color, isDark])
}

export default useNodeColor
