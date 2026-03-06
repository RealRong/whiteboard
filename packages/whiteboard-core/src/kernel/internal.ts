import type { DispatchFailure, Document } from '../types'
import { createKernelExecutor, type KernelExecutor } from './executor'
import type { KernelContext } from './types'

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (clone) {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

export const cloneDocument = (document: Document): Document => cloneValue(document)

export const createKernelRuntime = (
  document: Document,
  context: KernelContext = {}
): KernelExecutor =>
  createKernelExecutor({
    document: cloneDocument(document),
    now: context.now
  })

let reusableKernelRuntime: KernelExecutor | undefined

export const getReusableKernelRuntime = (
  document: Document,
  context: KernelContext = {}
): KernelExecutor => {
  const nextDocument = cloneDocument(document)
  if (!reusableKernelRuntime) {
    reusableKernelRuntime = createKernelExecutor({
      document: nextDocument,
      now: context.now
    })
    return reusableKernelRuntime
  }

  reusableKernelRuntime.load(nextDocument)
  return reusableKernelRuntime
}

export const createKernelFailure = (
  reason: DispatchFailure['reason'],
  message?: string
): DispatchFailure => ({
  ok: false,
  reason,
  message
})
