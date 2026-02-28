import type { Document } from '@whiteboard/core/types'
import type { QueryDocument } from '@engine-types/instance/query'

type Options = {
  readDoc: () => Document
}

export const document = ({ readDoc }: Options): QueryDocument => ({
  get: readDoc
})
