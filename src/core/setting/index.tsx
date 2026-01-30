import { Button, Content } from '@/components/base'
import { globalStore } from '@/api/stores'
import { useAtom } from 'jotai/react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ComponentSetting from './Component'
import GeneralSetting from './General'
import ShortCutSetting from './ShortCut'
import AISetting from './AI'
import { IShortCutSetting, IGeneralSetting, IObjectsAndLinkSetting, ISyncSetting, IComponentSetting, IAISettings } from './types'
import WorkspaceSetting from '@/core/setting/Workspace'
import { Colors } from '@/consts'
import { atom } from 'jotai'
import { useGlobalAtomValue } from '@/hooks'
import SyncSetting from './Sync'
import { selectAtom } from 'jotai/utils'
import { Atom } from 'jotai/vanilla'
import Modal from '../../components/base/Modal'
import Account from '@/core/setting/Account'
import UserService from '@/api/services/user.service'
import Subscription from '@/core/setting/Subscription'
import { isEqual } from 'lodash'

enum Settings {
  'account',
  'subscription',
  'general',
  'AI',
  'workspace',
  'components',
  'shortcuts',
  'sync'
  // 'about'
}

const icons: Record<keyof typeof Settings, string> = {
  shortcuts: 'park-command',
  sync: 'custom-cloud',
  workspace: 'park-app-switch',
  general: 'park-all-application',
  components: 'park-components',
  AI: 'custom-stars'
}
export type Setting = IShortCutSetting & IGeneralSetting & IObjectsAndLinkSetting & IAISettings & IComponentSetting & ISyncSetting

const defaultSetting: Setting = {
  sync: {},
  graph: {
    previewContent: false,
    simpleMode: false,
    showHidden: false,
    showHighlight: false,
    nodeDistance: 60,
    nodeColor: '#F0EBE3',
    nodeSize: 10,
    openIn: 'side peek'
  },
  AI: {
    language: navigator.language === 'zh-CN' ? '简体中文' : 'English',
    aiTranslator: true
  },
  code: {
    defaultLanguage: 'typescript'
  },
  shortcut: {},
  general: {
    translateTargetLanguage: navigator.language === 'zh-CN' ? 'zh-Hans' : 'en',
    autoSaveLayout: false,
    defaultLanguage: navigator.language === 'zh-CN' ? 'zh-CN' : 'en-US',
    darkMode: false,
    copyFileWhenImport: true,
    autoBackup: 'never',
    dataBackup: 'never',
    minimizeToTray: false,
    followSystemTheme: false
  },
  media: {
    openPopoverWhenHighlight: true,
    subtitleInSidebar: false
  },
  whiteboard: {
    enableAddLinkBetweenObjectsWhenConnect: false,
    snapToObject: true,
    defaultLineType: 'curve',
    defaultBackgroundType: 'none'
  },
  sidebar: {
    previewTitleMode: false,
    previewCollectionContent: false,
    hoveredSidebar: true
  },
  editor: {
    autoOpenHighlightEditor: true,
    objectAutoBecomeInline: false,
    fontSize: 16,
    lineSpacing: 1.625,
    pageWidth: 'Medium'
  },
  object: {
    showPropertiesInComponentPage: false
  },
  translate: {
    autoGotoHoverText: true,
    showOrigWhenHoverText: true
  },
  background: {},
  pdf: {
    renderMode: 'followTheme',
    autoOpenHighlightEditor: true,
    autoExtractText: false
  },
  label: {
    showOriginalText: true,
    collapseOriginalText: false
  },
  video: {
    autoPlay: false,
    loop: true
  },
  webpage: {
    defaultCleanMode: true,
    saveImageLocally: false
  }
}

export const SettingAtom = atom<Setting>(defaultSetting)
const SettingAtoms = {
  codeLang: selectAtom(SettingAtom, s => s.code.defaultLanguage),
  collapseLabelText: selectAtom(SettingAtom, s => s.label.collapseOriginalText),
  AI: selectAtom(SettingAtom, s => s.AI),
  openAIKey: selectAtom(SettingAtom, s => s.general.openaiApiKey),
  openAIBaseUrl: selectAtom(SettingAtom, s => s.general.openaiBaseUrl),
  openAIModel: selectAtom(SettingAtom, s => s.general.openaiModel),
  darkMode: selectAtom(SettingAtom, s => s.general.darkMode),
  sync: selectAtom(SettingAtom, s => s.sync),
  language: selectAtom(SettingAtom, s => s.general.language),
  subtitleInSidebar: selectAtom(SettingAtom, s => s.media.subtitleInSidebar),
  editorSettings: selectAtom(
    SettingAtom,
    s => ({
      fontSize: s.editor.fontSize,
      pageWidth: s.editor.pageWidth,
      lineSpacing: s.editor.lineSpacing
    }),
    isEqual
  ),
  previewSidebarTitleAtom: selectAtom(SettingAtom, s => s.sidebar.previewTitleMode),
  previewCollectionContentAtom: selectAtom(SettingAtom, s => s.sidebar.previewCollectionContent),
  showPropertiesInComponentPage: selectAtom(SettingAtom, s => s.object.showPropertiesInComponentPage)
} as const
type extractGeneric<Type> = Type extends Atom<infer X> ? X : never
type Keys = keyof typeof SettingAtoms
type Values<K extends Keys> = extractGeneric<(typeof SettingAtoms)[K]>
type FocusableKeys = 'youtubeApiKey' | 'openaiApiKey'
function useSelectSettingAtom<K extends Keys>(key: K): Values<K> {
  const a = SettingAtoms[key]
  return useGlobalAtomValue(a) as Values<K>
}
const useSetting = () => useAtom(SettingAtom, { store: globalStore })
const setSetting = (updater: ((curr: Setting) => Setting) | Setting) => {
  const curr = globalStore.get(SettingAtom)
  globalStore.set(SettingAtom, typeof updater === 'object' ? updater : updater(curr))
}

const SettingDialog = () => {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [currentSettingPanel, setCurrentSettingPanel] = useState<keyof typeof Settings>('general')
  const [focusedKey, setFocusedKey] = useState<string>()
  GlobalSetting.openSetting = () => {
    setVisible(true)
  }
  GlobalSetting.closeSetting = () => {
    setVisible(false)
  }
  GlobalSetting.focusSetting = (panel, key) => {
    setVisible(true)
    setCurrentSettingPanel(panel)
    setFocusedKey(key)
  }
  const containerRef = useRef<HTMLDivElement>()
  const renderContent = () => {
    switch (currentSettingPanel) {
      case 'general':
        return <GeneralSetting />
      case 'AI':
        return <AISetting />
      case 'shortcuts':
        return <ShortCutSetting />
      case 'components':
        return <ComponentSetting />
      case 'sync':
        return <SyncSetting />
      case 'workspace':
        return <WorkspaceSetting />
      case 'subscription':
        return <Subscription />
      case 'account':
        return <Account />
    }
  }
  const [settings] = useSetting()
  const [user] = UserService.useUser()
  useEffect(() => {
    if (focusedKey) {
      setFocusedKey(undefined)
      const ele = containerRef.current?.querySelector(`#${focusedKey}`) as HTMLElement | undefined
      if (ele) {
        ele.scrollIntoView()
        const input = ele.querySelector('input,textarea')
        if (input) {
          input.focus()
          return
        }
        ele.classList.add('focus-shadow', 'rounded-md')
        setTimeout(() => {
          ele.classList.remove('focus-shadow', 'rounded-md')
        }, 2000)
      }
    }
  }, [focusedKey])
  useLayoutEffect(() => {
    if (currentSettingPanel === 'account' && !user) {
      setCurrentSettingPanel('general')
    }
  }, [user, currentSettingPanel])
  const renderSidebarItem = (key: string, text: string, icon: string) => {
    return (
      <Button.IconButton
        icon={icon}
        text={text}
        key={key}
        onClick={() => setCurrentSettingPanel(key)}
        style={{
          background: currentSettingPanel === key ? Colors.Background.ButtonHover : undefined,
          textTransform: 'capitalize'
        }}
      />
    )
  }
  return (
    <Modal noStyle zIndex={1000} visible={visible} onClose={() => setVisible(false)}>
      <Content
        ref={containerRef}
        flex
        style={{
          width: 1150,
          maxWidth: 'calc(100vw - 100px)',
          height: 'calc(100vh - 100px)',
          maxHeight: '715px',
          overflow: 'hidden',
          borderRadius: 12
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '220px',
            padding: '12px 8px',
            overflowY: 'auto',
            flexShrink: 0,
            background: settings.general.darkMode ? 'rgba(255,255,255,0.03)' : 'rgb(251, 251, 250)'
          }}
        >
          {user && (
            <>
              <div className={'menu-sub-title pl-2 mb-1 mt-3'}>{t('settings.Account')}</div>
              {renderSidebarItem('account', t('settings.My account'), 'park-user')}
              {renderSidebarItem('subscription', t('settings.Subscription'), 'park-crown')}
            </>
          )}
          <div className={'menu-sub-title pl-2 mb-1 mt-3'}>{t('general.Settings')}</div>
        </div>
        <div className={'w-full h-full flex flex-col overflow-y-auto gap-10'} style={{ padding: '32px 60px' }}>
          {renderContent()}
        </div>
      </Content>
    </Modal>
  )
}

const GlobalSetting = {
  SettingDialog,
  atoms: SettingAtoms,
  useSetting,
  useSelectSettingAtom,
  setSetting,
  getSetting: () => {
    return globalStore.get(SettingAtom)
  },
  closeSetting: () => {},
  openSetting: () => {},
  settingAtom: SettingAtom,
  defaultSetting,
  focusSetting: (p: keyof typeof Settings, key?: FocusableKeys) => {}
}
export default GlobalSetting
