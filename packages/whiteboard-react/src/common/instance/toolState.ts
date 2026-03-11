import { atom } from 'jotai/vanilla'

export type EditorTool = 'select' | 'edge'

export const toolAtom = atom<EditorTool>('select')
