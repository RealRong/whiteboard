import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'

type OrderCommands<
  TId extends string,
  TResult
> = {
  set: (ids: TId[]) => TResult
  bringToFront: (ids: TId[]) => TResult
  sendToBack: (ids: TId[]) => TResult
  bringForward: (ids: TId[]) => TResult
  sendBackward: (ids: TId[]) => TResult
}

export const createOrderCommands = <
  TId extends string,
  TResult
>({
  set,
  readCurrent
}: {
  set: (ids: TId[]) => TResult
  readCurrent: () => readonly TId[]
}): OrderCommands<TId, TResult> => {
  const bringToFront = (ids: TId[]) => {
    const current = [...readCurrent()]
    const target = sanitizeOrderIds(ids) as TId[]
    return set(bringOrderToFront(current, target) as TId[])
  }

  const sendToBack = (ids: TId[]) => {
    const current = [...readCurrent()]
    const target = sanitizeOrderIds(ids) as TId[]
    return set(sendOrderToBack(current, target) as TId[])
  }

  const bringForward = (ids: TId[]) => {
    const current = [...readCurrent()]
    const target = sanitizeOrderIds(ids) as TId[]
    return set(bringOrderForward(current, target) as TId[])
  }

  const sendBackward = (ids: TId[]) => {
    const current = [...readCurrent()]
    const target = sanitizeOrderIds(ids) as TId[]
    return set(sendOrderBackward(current, target) as TId[])
  }

  return {
    set,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward
  }
}
