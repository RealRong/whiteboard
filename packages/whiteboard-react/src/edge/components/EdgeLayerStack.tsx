import { EdgeControlPointHandles } from './EdgeControlPointHandles'
import { EdgeEndpointHandles } from './EdgeEndpointHandles'
import { EdgeLayer } from './EdgeLayer'
import { EdgePreviewLayer } from './EdgePreviewLayer'

export const EdgeLayerStack = () => {
  return (
    <>
      <EdgeLayer />
      <EdgeEndpointHandles />
      <EdgeControlPointHandles />
      <EdgePreviewLayer />
    </>
  )
}
