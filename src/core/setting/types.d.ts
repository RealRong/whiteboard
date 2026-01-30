import { IQuestion } from '~/typings'
import { IAvailableModels } from '@/api/services/ai/universalAIProvider'

export type IGeneralSetting = {
  general: {
    openaiApiKey?: string
    openaiBaseUrl?: string
    openaiModel?: string
    openaiReasoningModel?: string
    language?: AvaliableLanguages
    darkMode: boolean
    fontFamily?: 'Satoshi' | 'Inter' | 'Roboto' | 'Montserrat' | 'Poppins' | 'Noto' | 'Nunito' | 'Playfair Display'
    importedFonts?: {
      path: string
      name: string
      id: number
      selected: boolean
    }[]
    copyFileWhenImport: boolean
    customSearchEngineUrl?: string
    minimizeToTray?: boolean
    translateTargetLanguage: string
    followSystemTheme?: boolean
    autoRecoverFromBackup?: boolean
    userFilePath?: string
    autoBackup: 'never' | 'every day' | '3 days' | 'one week' | 'one month' | 'whenClose'
    backUpPath?: string
    defaultFilePath?: string
    defaultLanguage: string
    autoSaveLayout: boolean
    youtubeApiKey?: string
    globalCSS?: string
    youtubeMaxItems?: number
    dataBackup: 'whenClose' | 'every day' | 'every week' | 'every month' | 'never'
  }
}

export type IAISettings = {
  AI: {
    customProvider?: boolean
    provider?: IAvailableModels
    baseUrl?: string
    apiKey?: string
    aiTranslator?: boolean
    aiChatHistoryCount?: number
    language: string
    customExplainPrompt?: string
    customTranslatePrompt?: string
    chatHistoryLength?: number
    searchEngine?: 'model' | 'exa' | 'linkup' | 'firecrawl'
    exaApiKey?: string
    linkupApiKey?: string
    firecrawlApiKey?: string
  }
}
export type IQuickAddSettings = {
  quickAdd: {
    addIntoGroupHideObject: boolean
  }
}

type ShortCut = {
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  key?: string
  metaKey: boolean
  displayKey?: string
}

export type ISyncSetting = {
  sync: {
    enableSync?: boolean
    syncMode?: 's3' | 'webdav'
    S3Config?: {
      bucket?: string
      endpoint?: string
      region?: string
      ak?: string
      sk?: string
      defaultFolder?: string
    }
    webdavConfig?: {
      username?: string
      url?: string
      password?: string
      defaultFolder?: string
    }
    maxSyncSize?: number
    displaySyncState?: boolean
    enableAutoSync?: boolean
    conflictResolved?: boolean
    syncInterval?: '10s' | '30s' | '1m' | '5m' | '30m' | '1h'
    syncDirection?: 'from local to remote' | 'from remote to local'
    localProtection?: boolean
  }
}
export type IShortCutSetting = {
  shortcut: Partial<{
    openSidebar: ShortCut | null
    openMediaSidebar: ShortCut | null
    switchToPrevTab: ShortCut | null
    switchToNextTab: ShortCut | null
    closeCurrentTab: ShortCut | null
    closeOtherTabs: ShortCut | null
    closeRightTabs: ShortCut | null
    closeLeftTabs: ShortCut | null
    openObjectPanel: ShortCut | null
    quickCreateObject: ShortCut | null
    openSearchPanel: ShortCut | null
    openGlobalSearch: ShortCut | null
    makeVideoLabel: ShortCut | null
  }>
}
export type IObjectsAndLinkSetting = {
  object: {
    showPropertiesInComponentPage: boolean
  }
}

export type IComponentSetting = {
  sidebar: {
    previewTitleMode?: boolean
    previewCollectionContent?: boolean
    hoveredSidebar?: boolean
  }
  label: {
    showOriginalText: boolean
    collapseOriginalText: boolean
  }
  whiteboard: {
    enableAddLinkBetweenObjectsWhenConnect: boolean
    snapToObject: boolean
    dropFileAutoObject: boolean
    defaultLineType: 'straight' | 'polyline' | 'curve'
    defaultBackgroundType: 'none' | 'dot' | 'line'
  }
  graph: {
    previewContent: boolean
    simpleMode: boolean
    showHidden: boolean
    showHighlight: boolean
    nodeDistance: number
    nodeSize: number
    nodeColor: string
    openIn: 'new tab' | 'side peek'
  }
  editor: {
    objectAutoBecomeInline: boolean
    addSpacingInReaderMode?: boolean
    autoOpenHighlightEditor?: boolean
    pageWidth: string
    fontSize: number
    lineSpacing: number
  }
  translate: {
    autoGotoHoverText: boolean
    showOrigWhenHoverText: boolean
  }
  webpage: {
    saveImageLocally: boolean
    autoAddHeadImage?: boolean
    defaultCleanMode: boolean
  }
  pdf: {
    renderMode: 'followTheme' | 'default'
    autoOpenHighlightEditor?: boolean
    autoExtractText?: boolean
  }
  code: {
    defaultLanguage?: string
  }
  video: {
    loop: boolean
    autoPlay: boolean
    goBackWhenMakingLabel?: number
  }
  media: {
    openPopoverWhenHighlight?: boolean
    clipWhenHighlight?: boolean
    subtitleInSidebar?: boolean
  }
}
