import { IWhiteboardNode } from '~/typings/data'
import { memo, useMemo } from 'react'
import UncontrolledWebpage from '@/core/components/webpage/UncontrolledWebpage'

const WebpageNode = memo(({ node, webpageId }: { node: IWhiteboardNode; webpageId: number }) => {
  return (
    <UncontrolledWebpage
      initialHeight={useMemo(() => node.height, [])}
      switcherHeader
      id={webpageId}
      editorOptions={{
        layout: {
          virtualizer: true,
          showHeader: false,
          disableOverscanInReadOnly: false,
          overscan: 3,
          showBottomPadding: true,
          showBlockHandleAdd: false,
          showProps: false
        },
        title: {
          titleStyle: {
            fontSize: '2rem'
          },
          titleContainerStyle: {
            padding: '1.6em 0px 0.6em',
            maxWidth: '100%',
            width: '100%'
          }
        },
        styles: {
          bottomPadding: 100,
          pageMinPadding: '0px 30px 0px',
          containerHeight: 'auto',
          containerMaxHeight: 'inherit',
          containerStyle: {
            maxWidth: '100%',
            minWidth: '100%'
          }
        },
        state: {
          fontSize: 17,
          pageWidth: 'Max'
        }
      }}
    />
  )
})

export default WebpageNode
