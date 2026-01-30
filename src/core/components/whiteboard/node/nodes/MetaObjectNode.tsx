import { IWhiteboardNode } from '~/typings/data'
import { Content } from '@/components/base'
import { FC, memo, useEffect, useRef } from 'react'
import { InnerNodeProps } from '../WrapperNode'
import PdfNode from './PdfNode'
import NoteNode from './NoteNode'
import WebpageNode from '@/core/components/whiteboard/node/nodes/WebpageNode'
import SyncedBlockNode from '@/core/components/whiteboard/node/nodes/SyncedBlockNode'
import Video from '@/core/components/media/wrappers/Video'
import Audio from '@/core/components/media/wrappers/Audio'
import { MetaGroupPage } from '@/scenes'
import { DockTabPaneContext } from '@/components/base/dock/DockTabPane'
import Code from '@/core/components/code'
import LabelDetailsRenderer from '@/core/object/renderer/LabelDetailsRenderer'
import WhiteboardNode from '@/core/components/whiteboard/node/nodes/WhiteboardNode'
import { Icon } from '@/components'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import QuestionCard from '@/core/ai/components/question/QuestionCard'
import Tweet from '@/core/components/tweet'
import ChatDialog from '@/core/ai/chat/ChatDialog'
import MessagePage from '@/scenes/MessagePage'
import { MetaStore } from '@/api/stores'
import trans from '@/consts/trans'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import ExamNode from '@/core/components/whiteboard/node/nodes/ExamNode'
import ExamQuestionNode from '@/core/components/whiteboard/node/nodes/ExamQuestionNode'

const MetaObjectNode: FC<InnerNodeProps> = ({ node: n, nodeState, setNodeState }) => {
  const node = n as IWhiteboardNode & { type: 'metaObject' }
  const { expanded } = node
  const { metaObjectId } = node

  const metaObject = MetaStore.useValue(metaObjectId)
  const { t } = useTranslation()
  const imageRef = useRef<HTMLImageElement>(null)
  const hasImage = !!metaObject?.coverImgSrc
  let renderFloatName = false
  if (expanded) {
    switch (metaObject?.type) {
      case 'image':
      case 'chat':
      case 'message':
        renderFloatName = true
        break
    }
  } else if (hasImage) {
    renderFloatName = true
  }
  useEffect(() => {
    setNodeState?.(s => ({ ...s, name: renderFloatName ? metaObject?.name : undefined }))
  }, [renderFloatName, metaObject?.name])
  const hasImageRenderer = () => (
    <img
      draggable={'false'}
      ref={imageRef}
      src={metaObject?.coverImgSrc}
      style={{
        position: 'relative',
        width: '100%',
        objectFit: 'cover',
        flex: 1,
        overflow: 'hidden',
        borderRadius: 'inherit'
      }}
    />
  )

  const renderExpanded = () => {
    if (metaObject?.objectId) {
      switch (metaObject?.type) {
        case 'pdf':
          return <PdfNode id={metaObject.objectId} />
        case 'group': {
          return <MetaGroupPage groupId={metaObject.objectId} />
        }
        case 'audio': {
          return (
            <div className={'px-6 pb-3 pt-8'}>
              <Audio onlyCore={true} audioId={metaObject.objectId} />
            </div>
          )
        }
        case 'webpage':
          return <WebpageNode node={node} webpageId={metaObject.objectId} />
        case 'video':
          return <Video onlyCore={true} videoId={metaObject.objectId} />
        case 'note': {
          return (
            <NoteNode
              nodeState={nodeState}
              node={{
                ...node,
                noteId: metaObject.objectId
              }}
              metaId={metaObject.id}
            />
          )
        }
        case 'code':
          return <Code id={metaObject.objectId} />
        case 'chat':
          return <ChatDialog paddingStart={7} containerClassName={'!h-auto min-h-full max-h-[inherit]'} id={metaObject.objectId} />
        case 'message':
          return <MessagePage title={false} titleRenderer={false} id={metaObject.objectId} />
        case 'tweet':
          return <Tweet id={metaObject.objectId} layout={{ showBorder: false }} />
        case 'question':
          return (
            <QuestionCard
              containerStyle={{
                maxWidth: '100%',
                minWidth: '100%',
                minHeight: '100%',
                maxHeight: '100%',
                padding: 24
              }}
              id={metaObject.objectId}
              display={{
                from: true,
                pointers: true
              }}
            />
          )
        case 'exam':
          return <ExamNode id={metaObject.objectId} />
        case 'examQuestion':
          return <ExamQuestionNode id={metaObject.objectId} />
        case 'whiteboard':
          return <WhiteboardNode metaId={metaObjectId} />
        case 'syncedBlock':
          return <SyncedBlockNode node={node} />
        default: {
          return hasImage ? hasImageRenderer() : titleRenderer()
        }
      }
    }
  }
  const instance = useWhiteboardInstance()
  if (metaObject?.type.includes('Label')) {
    return <LabelDetailsRenderer disableSidebar showAudio showVideo metaId={metaObjectId} />
  }

  const titleRenderer = () => {
    if (!metaObject) return null
    const name = Global.metaOps.getMetaName(metaObject)
    return (
      <Content alignItems={'center'} flex gap={12} style={{ width: '100%', padding: '14px' }}>
        {instance.nodeOps?.canExpand(node) && (
          <Icon
            size={18}
            name={'park-right'}
            className={'square-button'}
            onClick={() => {
              instance.nodeOps?.expand(node.id)
            }}
            style={{
              opacity: nodeState?.focused ? 1 : 0
            }}
          />
        )}
        <Content alignItems={'center'} flex gap={16} justifyContent={'center'} style={{ width: '100%', fontSize: 17 }}>
          <Icon name={Global.utils.getIcon(metaObject.type)} />
          <div className={classnames('line-clamp-1 font-bold', !name && 'super-transparent-font')}>{name || t(trans.Unnamed)}</div>
        </Content>
        {metaObject.type === 'localFile' ? (
          <Icon
            onClick={() => {
              instance.nodeOps?.open(node.id, 'newTab')
            }}
            size={18}
            name={'park-arrow-right-up'}
            className={'square-button'}
          />
        ) : (
          <Icon
            onClick={() => {
              instance.nodeOps?.open(node.id, 'sidePeek')
            }}
            size={18}
            name={'custom-right-bar'}
            className={'square-button'}
            style={{
              opacity: nodeState?.focused ? 1 : 0
            }}
          />
        )}
      </Content>
    )
  }
  if (!metaObject || metaObject.deleted) {
    return (
      <div
        className={'transparent-font'}
        style={{
          width: node.width,
          height: node.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        Deleted object
      </div>
    )
  }
  return expanded ? (
    <DockTabPaneContext.Provider value={{ currentTabId: '' }}>{renderExpanded()}</DockTabPaneContext.Provider>
  ) : hasImage ? (
    hasImageRenderer()
  ) : (
    titleRenderer()
  )
}

export default memo(MetaObjectNode)
