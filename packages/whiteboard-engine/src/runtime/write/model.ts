import type {
  EdgeWriteCommand,
  MindmapWriteCommand,
  NodeWriteCommand,
  ViewportWriteCommand,
  WriteCommandMap as CommandMap,
  WriteDomain as Domain,
  WriteInput as Input
} from '@engine-types/command/api'
import type { CommandSource } from '@engine-types/command/source'
import type {
  DispatchResult,
  Operation
} from '@whiteboard/core/types'

export type NodeCommand = NodeWriteCommand
export type EdgeCommand = EdgeWriteCommand
export type ViewportCommand = ViewportWriteCommand
export type MindmapCommand = MindmapWriteCommand

export type WriteDomain = Domain
export type WriteCommandMap = CommandMap
export type WriteInput<D extends WriteDomain = WriteDomain> = Input<D>

export type DispatchInput<D extends WriteDomain = WriteDomain> =
  D extends WriteDomain
    ? {
        domain: D
        command: WriteCommandMap[D]
      }
    : never

export const toDispatchInput = <D extends WriteDomain>(
  payload: WriteInput<D>
): DispatchInput<D> => ({
  domain: payload.domain,
  command: payload.command
}) as DispatchInput<D>

export type Dispatch = <D extends WriteDomain>(
  payload: DispatchInput<D>,
  source: CommandSource
) => Promise<DispatchResult>

export type Apply = <D extends WriteDomain>(
  payload: WriteInput<D>
) => Promise<DispatchResult>

type Failure = Extract<DispatchResult, { ok: false }>

export type Draft<T = unknown> =
  | {
      ok: true
      operations: Operation[]
      value?: T
    }
  | Failure

export const success = <T,>(operations: Operation[], value?: T): Draft<T> => ({
  ok: true,
  operations,
  value
})

export const invalid = (message: string): Draft => ({
  ok: false,
  reason: 'invalid',
  message
})

export const cancelled = (message?: string): Draft => ({
  ok: false,
  reason: 'cancelled',
  message
})

type FailLike = {
  ok: false
  message?: string
}

type OpLike = {
  ok: true
  operation: Operation
}

type OpsLike = {
  ok: true
  operations: Operation[] | readonly Operation[]
}

const failMessage = (result: FailLike) =>
  result.message ?? 'Invalid result.'

export const op = (result: OpLike | FailLike): Draft =>
  result.ok
    ? success([result.operation])
    : invalid(failMessage(result))

export const ops = (result: OpsLike | FailLike): Draft =>
  result.ok
    ? success(Array.isArray(result.operations) ? result.operations : [...result.operations])
    : invalid(failMessage(result))
