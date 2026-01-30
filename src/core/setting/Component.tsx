import produce from 'immer'
import { useTranslation } from 'react-i18next'
import { ButtonChooser, Switch } from '../../components/base'
import { ISettingItem } from './SettingItem'
import GlobalSetting from '.'
import Select from '@/components/base/select'
import { NumberInput } from '@/components'
import { IComponentSetting } from '@/core/setting/types'
import SettingGroup from '@/core/setting/SettingGroup'
import _ from 'lodash'

const fontSizes = _.range(12, 31, 1).map(i => `${i.toString()}px`)
const lineSpacings = _.range(1.2, 2.5, 0.025).map(i => i.toFixed(3))
const editorPageWidth = ['X-Small', 'Small', 'Medium', 'Large', 'X-Large']

const ComponentSetting = () => {
  const { t } = useTranslation()
  const [setting, setSetting] = GlobalSetting.useSetting()
  function toggleSetting<K extends keyof IComponentSetting>(key: K, v: keyof IComponentSetting[K]) {
    setSetting(s =>
      produce(s, draft => {
        draft[key][v] = !draft[key][v]
      })
    )
  }
  const highlightSettingItems: ISettingItem[] = [
    {
      title: t('settings.Collapse long original text'),
      type: 'switch',
      value: setting.label.collapseOriginalText,
      onChange: v => {
        setSetting(s => ({ ...s, label: { ...s.label, collapseOriginalText: !s.label.collapseOriginalText } }))
      }
    }
  ]
  const webpageSettingItems: ISettingItem[] = [
    {
      title: t('settings.Default clean mode'),
      description: t('settings.Clean mode desc'),
      type: 'switch',
      value: setting.webpage.defaultCleanMode,
      onChange: v => {
        setSetting(s => ({ ...s, webpage: { ...s.webpage, defaultCleanMode: !s.webpage.defaultCleanMode } }))
      }
    }
  ]
  const whiteboardSettingItems: ISettingItem[] = [
    {
      title: t('settings.enable add link between objects when connect'),
      children: (
        <Switch
          value={setting.whiteboard.enableAddLinkBetweenObjectsWhenConnect}
          onChange={() => toggleSetting('whiteboard', 'enableAddLinkBetweenObjectsWhenConnect')}
        />
      )
    }
  ]

  const editorSettingItems: (ISettingItem | undefined)[] = [
    {
      title: t('settings.Font size'),
      children: (
        <ButtonChooser
          onChange={v => {
            setSetting(s => ({ ...s, editor: { ...s.editor, fontSize: parseInt(v) } }))
          }}
          value={`${setting.editor.fontSize || 16}px`}
          options={fontSizes}
        />
      )
    },
    {
      title: t('settings.Line spacing'),
      children: (
        <ButtonChooser
          onChange={v => {
            setSetting(s => ({ ...s, editor: { ...s.editor, lineSpacing: Number(parseFloat(v).toFixed(3)) } }))
          }}
          value={`${(setting.editor.lineSpacing || 1.625).toFixed(3)}`}
          options={lineSpacings}
        />
      )
    },
    {
      title: t('settings.Page width'),
      children: (
        <ButtonChooser
          onChange={v => {
            setSetting(s => ({ ...s, editor: { ...s.editor, pageWidth: v } }))
          }}
          value={setting.editor.pageWidth}
          options={editorPageWidth}
        />
      )
    },
    {
      title: t('settings.Show custom properties in pages'),
      children: (
        <Switch
          value={setting.object.showPropertiesInComponentPage}
          onChange={() =>
            setSetting(s =>
              produce(s, draft => {
                draft.object.showPropertiesInComponentPage = !draft.object.showPropertiesInComponentPage
              })
            )
          }
        />
      )
    },
    {
      type: 'switch',
      title: t('settings.Auto open highlight editor'),
      value: !!setting.editor.autoOpenHighlightEditor,
      onChange: v => setSetting(s => ({ ...s, editor: { ...s.editor, autoOpenHighlightEditor: v } }))
    },
    {
      title: t('settings.Inline object in editor'),
      children: (
        <Switch value={!!setting.editor.objectAutoBecomeInline} onChange={() => toggleSetting('editor', 'objectAutoBecomeInline')} />
      )
    }
  ].filter(i => i)
  const sidebarItems: ISettingItem[] = [
    {
      type: 'switch',
      value: !!setting.sidebar.hoveredSidebar,
      title: t('settings.Enable floating sidebar'),
      onChange: v => setSetting(s => ({ ...s, sidebar: { ...s.sidebar, hoveredSidebar: !s.sidebar.hoveredSidebar } }))
    },
    {
      type: 'switch',
      value: !!setting.sidebar.previewTitleMode,
      title: t('settings.Preview library content'),
      onChange: v => setSetting(s => ({ ...s, sidebar: { ...s.sidebar, previewTitleMode: !s.sidebar.previewTitleMode } }))
    },
    {
      type: 'switch',
      value: !!setting.sidebar.previewCollectionContent,
      title: t('settings.Preview collection content'),
      onChange: v => setSetting(s => ({ ...s, sidebar: { ...s.sidebar, previewCollectionContent: !s.sidebar.previewCollectionContent } }))
    }
  ]
  const pdfSettingItems: (ISettingItem | undefined)[] = [
    {
      type: 'switch',
      title: t('settings.Auto extract text after clipping'),
      value: !!setting.pdf.autoExtractText,
      isPro: true,
      onChange: v => setSetting(s => ({ ...s, pdf: { ...s.pdf, autoExtractText: v } }))
    },
    {
      type: 'switch',
      title: t('settings.Auto open highlight editor'),
      value: !!setting.pdf.autoOpenHighlightEditor,
      onChange: v => setSetting(s => ({ ...s, pdf: { ...s.pdf, autoOpenHighlightEditor: v } }))
    },
    {
      title: t('settings.pdf render mode'),
      children: (
        <Select
          closeOnSelect
          value={setting.pdf.renderMode}
          options={[
            { value: 'default', children: t('settings.default') },
            { value: 'followTheme', children: t('settings.follow theme') }
          ]}
          onSelect={v => {
            if (typeof v[0] === 'string') {
              setSetting(s =>
                produce(s, s => {
                  s.pdf.renderMode = v[0]
                })
              )
            }
          }}
        />
      )
    }
  ].filter(i => i)

  const videoSettingItems: ISettingItem[] = [
    {
      title: t('settings.Auto open highlight editor'),
      children: (
        <Switch
          value={setting.media.openPopoverWhenHighlight}
          onChange={v => {
            setSetting(
              produce(setting, draft => {
                draft.media.openPopoverWhenHighlight = v
              })
            )
          }}
        />
      )
    },
    {
      title: t('settings.jump back when making label'),
      children: (
        <NumberInput
          min={0}
          max={20}
          defaultValue={setting.video.goBackWhenMakingLabel || 0}
          onChange={v => {
            setSetting(
              produce(setting, draft => {
                draft.video.goBackWhenMakingLabel = v as number
              })
            )
          }}
        />
      )
    }
  ]
  return (
    <>
      <SettingGroup title={t('settings.Sidebar settings')} layout={sidebarItems} />
      <SettingGroup title={t('settings.webpage settings')} layout={webpageSettingItems} />
      <SettingGroup title={t('settings.Highlight settings')} layout={highlightSettingItems} />
      <SettingGroup title={t('settings.whiteboard settings')} layout={whiteboardSettingItems} />
      <SettingGroup title={t('settings.editor settings')} layout={editorSettingItems} />
      <SettingGroup title={t('settings.pdf settings')} layout={pdfSettingItems} />
      <SettingGroup title={t('settings.video settings')} layout={videoSettingItems} />
    </>
  )
}

export default ComponentSetting
