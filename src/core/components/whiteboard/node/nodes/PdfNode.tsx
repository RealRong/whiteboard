import { useDebounceFn } from '@/hooks'
import { memo, useEffect } from 'react'
import UncontrolledPDF from '@/core/components/pdf/UncontrolledPDF'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useUpdate } from 'react-use'

const PdfNode = memo(({ id }: { id: number }) => {
  const instance = useWhiteboardInstance()
  const update = useUpdate()
  const { run: debouncedForceRender } = useDebounceFn(update, {
    wait: 300
  })
  useEffect(() => {
    instance.addEventListener('zoomChange', debouncedForceRender)
    update()
    return () => {
      instance.removeEventListener('zoomChange', debouncedForceRender)
    }
  }, [])
  return (
    <UncontrolledPDF
      autoWidth={true}
      state={{ doublePage: false, enableSearch: true }}
      id={id}
      styles={{
        paddingEnd: 15,
        pdfMaxWidth: 999999
      }}
      layout={{
        showHeader: false
      }}
      transformScale={instance.getTransform?.().scale}
    />
  )
})

export default PdfNode
