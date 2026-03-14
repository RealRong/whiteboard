export const mergeObjectPatch = <Value extends object>(
  current: Value | undefined,
  patch: Partial<Value>
): Value => Object.assign({}, current, patch)

export const mergeRecordPatch = <Value>(
  current: Record<string, Value> | undefined,
  patch: Record<string, Value>
): Record<string, Value> => mergeObjectPatch(current, patch)
