import { memo, useEffect, useRef, useState } from 'react'
import { Content, Icon, Modal, VirtualList } from '@/components'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { assignProperties } from '@/utils'
import { useTranslation } from 'react-i18next'
import { useDebounceEffect, useMemoizedFn } from '@/hooks'
import fuzzysort from 'fuzzysort'
import { ClassName } from 'rendevoz'
import SearchHelper from '@/api/textSearch/SearchHelper'
import { IWhiteboardNode } from '~/typings'
import { MetaStore } from '@/api/stores'
import { Colors } from '@/consts'
import { slateToMarkdown } from '@/core/components/editor/plugins/slateToMarkdown'

type WhiteboardSearchable = {
  nodeId: number
  search: string
  metaId?: number
  type: 'text' | 'group' | 'mindmap' | 'meta'
  subContent?: string
}
export default memo(() => {
  const [visible, setVisible] = useState(false)
  const instance = useWhiteboardInstance()
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [searchable, setSearchable] = useState<WhiteboardSearchable[]>([])
  const [composing, setComposing] = useState(false)
  const [results, setResults] = useState<Fuzzysort.KeyResult<WhiteboardSearchable>[]>()
  const [isLoading, setIsLoading] = useState(false)
  useEffect(() => {
    if (visible) {
      inputRef.current?.focus()
      inputRef.current?.select()
      const allNodes = instance.getAllNode?.()
      if (allNodes) {
        // search meta with search helper, search inside with fuzzysort
        const result: typeof searchable = []
        allNodes.forEach(node => {
          if (node.type === 'text') {
            const str = slateToMarkdown(node.content)
            result.push({
              nodeId: node.id,
              search: str,
              type: 'text'
            })
          }
          if (node.type === 'group') {
            if (node.name) {
              result.push({
                nodeId: node.id,
                search: node.name,
                type: 'group'
              })
            }
          }
          if (node.type === 'mindmap') {
            if (node.nodeType === 'text') {
              const str = slateToMarkdown(node.content)
              result.push({
                nodeId: node.id,
                search: str,
                type: 'text'
              })
            }
          }
        })
        setSearchable(result)
      }
      return () => {
        instance.getOutestContainerNode?.()?.focus()
      }
    }
  }, [visible])
  const getResults = useMemoizedFn(async () => {
    if (input && searchable) {
      if (isLoading) return
      setIsLoading(true)
      const n = Date.now()
      const allMetaNodes =
        instance.getAllNode?.().filter(i => i.type === 'metaObject' || (i.type === 'mindmap' && i.nodeType === 'metaObject')) || []
      const metaIdToNode = new Map(allMetaNodes.map(i => [(i as IWhiteboardNode & { type: 'metaObject' }).metaObjectId, i]))
      const metaSearch = await SearchHelper.searchDocument({ queryText: input })
      const matchedMeta = metaSearch.filter(i => metaIdToNode.has(i.metaId))
      const res = Array.from(fuzzysort.go(input, searchable, { key: 'search' }))
      if (matchedMeta.length) {
        matchedMeta.forEach(m => {
          const node = metaIdToNode.get(m.metaId)
          const meta = MetaStore.getCachedMetaObject(m.metaId)
          if (node && meta) {
            const name = m.matched?.['name'] || m.name
            const description = m.matched?.['description'] || m.description
            const content = m.matched?.['content']
            res.push({
              target: input,
              obj: {
                nodeId: node.id,
                type: 'meta',
                search: name || meta.name || meta?.placeholderName || 'Unnamed object',
                subContent: content || description,
                metaId: meta.id
              },
              score: 1
            })
          }
        })
      }
      setTimeout(
        () => {
          setIsLoading(false)
          setResults(res)
        },
        Math.max(0, 500 - (Date.now() - n))
      )
    } else {
      setResults(undefined)
    }
  })
  useDebounceEffect(
    () => {
      if (!composing) {
        getResults()
      }
    },
    [input, composing],
    { wait: 200 }
  )
  assignProperties(instance, {
    searchOps: {
      toggleSearchPanel: v => {
        if (v !== undefined) {
          setVisible(v)
        } else {
          setVisible(!visible)
        }
      }
    }
  })
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Modal disableAnimation notUnmount visible={visible} onClose={() => setVisible(false)}>
      <Content
        flex
        column
        style={{
          width: '700px',
          maxWidth: 'calc(100vw - 100px)',
          overflow: 'hidden',
          borderRadius: 12,
          height: results?.length ? '70vh' : 'auto'
        }}
      >
        <Content
          flex
          className={'border-bottom'}
          style={{
            padding: '8px 12px',
            fontSize: 16
          }}
        >
          <input
            ref={inputRef}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('general.Type to search') + '...'}
            style={{ flex: 1 }}
          />
        </Content>
        {isLoading ? (
          <Content fullWidth fullHeight flex centered style={{ flex: 1, padding: '40px 0px' }}>
            <Icon name={'park-loading-four'} spin size={24} />
          </Content>
        ) : results?.length ? (
          <VirtualList
            items={results || []}
            style={{
              width: '100%',
              padding: 6,
              height: '100%'
            }}
            overscan={10}
            withKeyboardNavigation={visible}
            onSelect={item => {
              instance.searchOps?.toggleSearchPanel(false)
              instance.containerOps?.fitToNode(item.obj.nodeId)
              instance.selectOps?.deselectAll()
              instance.selectOps?.selectNode(item.obj.nodeId)
            }}
            renderItem={(item, idx, selected) => <ResultItem res={item} selected={selected} />}
            estimateSize={40}
          ></VirtualList>
        ) : null}
        {input && !isLoading && results?.length === 0 ? (
          <Content fullWidth style={{ padding: 12, color: Colors.Font.Transparent, fontWeight: 500 }} flex gap={12}>
            <Icon name={'park-emotion-unhappy'} />
            <div>{t('general.Search no result')}</div>
          </Content>
        ) : null}
        <Content
          flex
          className={'border-top bg-secondary transparent-font font-size-12'}
          style={{
            padding: '6px 14px',
            lineHeight: 1,
            marginTop: 'auto'
          }}
        >
          {t('general.Keyboard navigation')}
        </Content>
      </Content>
    </Modal>
  )
})

const ResultItem = memo(({ res, selected }: { res: Fuzzysort.KeyResult<WhiteboardSearchable>; selected?: boolean }) => {
  const instance = useWhiteboardInstance()
  const [name, setName] = useState<string>('')
  const metaIcon = res.obj.metaId ? Global.utils.getIcon(MetaStore.getCachedMetaObject(res.obj.metaId)?.type) : undefined
  const typeToIcon: Record<WhiteboardSearchable['type'], string> = {
    group: 'custom-group',
    text: 'park-text',
    mindmap: 'park-mindmap-map'
  }
  useEffect(() => {
    if (res.obj.type === 'meta') {
      setName(res.obj.search)
    } else {
      setName(fuzzysort.highlight(res, '<mark>', '</mark>') || '')
    }
  }, [res])

  return (
    <Content
      onClick={() => {
        instance.searchOps?.toggleSearchPanel(false)
        instance.containerOps?.fitToNode(res.obj.nodeId)
        instance.selectOps?.deselectAll()
        instance.selectOps?.selectNode(res.obj.nodeId)
      }}
      className={ClassName.flatButton()}
      style={{
        background: selected ? Colors.Background.ButtonHover : 'transparent'
      }}
    >
      <Content flex alignItems={'center'} gap={8}>
        <Icon name={res.obj.type === 'meta' ? metaIcon : typeToIcon[res.obj.type]} />
        <div className={'ellipsis-font-1 bold-font'} dangerouslySetInnerHTML={{ __html: name }}></div>
      </Content>
      {res.obj.subContent && (
        <div className={'ellipsis-font-2 transparent-font font-size-13'} dangerouslySetInnerHTML={{ __html: res.obj.subContent }}></div>
      )}
    </Content>
  )
})
