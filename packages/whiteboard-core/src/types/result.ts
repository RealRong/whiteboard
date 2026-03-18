export type ErrorInfo<C extends string = string> = {
  code: C
  message: string
  details?: unknown
}

export type Result<T = void, C extends string = string> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: ErrorInfo<C>
    }

export function ok(): Result<void, never>
export function ok<T>(data: T): Result<T, never>
export function ok<T>(data?: T): Result<T, never> {
  return {
    ok: true,
    data: data as T
  }
}

export const err = <C extends string>(
  code: C,
  message: string,
  details?: unknown
): Result<never, C> => ({
  ok: false,
  error: {
    code,
    message,
    details
  }
})
