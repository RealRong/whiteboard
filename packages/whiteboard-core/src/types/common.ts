export type Box = {
  x: number
  y: number
  width: number
  height: number
}

export type XYPosition = {
  x: number
  y: number
}

export type PartialWithId<T extends { id: number }> = Partial<T> & { id: number }

export interface IBase {
  id: number
}

export type RichTextNode = unknown

export type CSSProperties = Record<string, string | number>

export type Dispatch<T> = (value: T) => void

export type SetStateAction<T> = T | ((prev: T) => T)

export type ResizeDirection = string

export type Patch = {
  op: string
  path: Array<string | number>
  value?: unknown
}

export type PanZoom = {
  setTransform?: (t: { x: number; y: number; scale: number }, duration?: number, skip?: boolean) => void
} & Record<string, unknown>

export type JotaiStore = unknown
