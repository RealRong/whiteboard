export type HintTraceEffect = 'dirty' | 'order' | 'full'

export type HintTraceEntry = {
  operationIndex: number
  operationType: string
  rule: string
  effect: HintTraceEffect
  reason: string
}
