export type EventOrigin = 'user' | 'system' | 'remote'

export type Revision = {
  from: number
  to: number
}

export type DomainEventEnvelope<
  TType extends string = string,
  TPayload = unknown
> = {
  id: string
  type: TType
  payload: Readonly<TPayload>
  revision: Revision
  commandId: string
  origin: EventOrigin
  timestamp: number
  docId?: string
}

export type EventJournal = {
  append: (events: readonly DomainEventEnvelope<string, unknown>[]) => void
  subscribe: (
    listener: (events: readonly DomainEventEnvelope<string, unknown>[]) => void
  ) => () => void
}
