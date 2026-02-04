import { useAtomValue } from 'jotai'
import { shortcutContextAtom } from '../state/whiteboardAtoms'

export const useShortcutContextValue = () => useAtomValue(shortcutContextAtom)
