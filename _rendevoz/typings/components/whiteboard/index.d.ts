import { IBase } from '../../data/base'
import { ICollectionItem } from '../../data/collection'
import { IWhiteboardInstance } from '~/typings'
import { Descendant } from 'slate'

export type IWhiteboardEdge = {
  id: number
  sourceId: number
  targetId: number
  sourcePosition: EdgePosition
  targetPosition: EdgePosition
  metaLinkId?: number
  label?: string
  color?: string
  // tight curve: straight -> curve -> straight
  lineType?: 'straight' | 'polyline' | 'curve' | 'tightCurve'
  lineStyle?: 'straight' | 'regular' | 'thick' | 'dash' | 'animatedDash'
}

export type IWhiteboardProps = {
  id: number
  enableMiniMap?: boolean
  onInstanceInitialized?: (i: IWhiteboardInstance) => void
  readOnly?: boolean
  onRename?: (name: string) => void
  name?: string
  state?: {
    enableClickNodeWhenPanning?: boolean
  }
  layout?: {
    showRename?: boolean
    showControlBar?: boolean
    showPencilToolbar?: boolean
    showLeftToolbar?: boolean
    showObjectSidebar?: boolean
    showSetting?: boolean
    showContents?: boolean
  }
}

export type EdgePosition = 'top' | 'right' | 'left' | 'bottom'
// [x,y,pressure]
export type FreehandPoint = [number, number, number]
export type IWhiteboardNode = {
  id: number
  x: number
  y: number
  name?: string
  background?: string
  width?: number
  height?: number
  resized?: boolean
  widthResized?: boolean
  // collapse by node
  collapse?: number | false
  fixedExpanded?: boolean
  borderType?: 'rect' | 'roundRect' | 'round' | 'underline'
  // border color
  border?: string
  collapseChildren?: boolean
  // mindmap root id
  rootId?: number
  // mindmap side
  side?: 'left' | 'right'
  z: number
  expanded?: boolean
} & (
  | {
      type: 'metaObject'
      metaObjectId: number
    }
  | {
      type: 'image'
      imageUrl: string
    }
  | {
      type: 'mindmap'
      // default node type: 'text'
      nodeType?: IWhiteboardNode['type']
      rightChildren?: IWhiteboardMindmap[]
      leftChildren?: IWhiteboardMindmap[]
      rightCollapse?: boolean
      leftCollapse?: boolean
      edgeColor?: string
      edgeType?: IWhiteboardEdge['lineType']
    }
  | {
      type: 'group'
    }
  | {
      type: 'text'
      fontSize?: 'middle' | 'large' | 'small' | 'super large'
      content: Descendant[]
    }
  | {
      type: 'freehand'
      points: FreehandPoint[] | FreehandPoint[][]
      // default: 16
      strokeWidth?: number
      // default: 1
      opacity?: number
      // default: theme(dark: white, light: black)
      fillColor?: string
      penType: 'pen' | 'ballpen' | 'marker'
      mode: 'pencil' | 'marker' | 'dash'
      style?: IPenStyle
    }
)

export type IPenStyle = {
  width: number
  opacity: number
  color: string
}

type MultiplePenStyles = {
  first: IPenStyle
  second: IPenStyle
  third: IPenStyle
}

export type IWhiteboardMindmap = {
  root: number
  label?: string
  children: IWhiteboardMindmap[]
}
export interface IWhiteboard extends IBase {
  name?: string
  nodes?: Map<number, IWhiteboardNode>
  edges?: Map<number, IWhiteboardEdge>
  color?: string
  icon?: string
  backgroundType?: 'dot' | 'line' | 'none'
  lineType: 'straight' | 'polyline' | 'curve'
  hideObjects?: boolean
  lastViewport?: {
    x: number
    y: number
    scale: number
  }
  penStyles?: {
    ballpen: MultiplePenStyles
    pen: MultiplePenStyles
    marker: MultiplePenStyles
  }
}

export type IWhiteboardOutline = {
  nodeId: number
  name: string
  icon?: string
  children?: IWhiteboardOutline[]
  type: string | 'whiteboard mindmap' | 'whiteboard group' | 'whiteboard text'
}

export type IWhiteboardAlignment = 'left' | 'top' | 'right' | 'bottom' | 'horizontallyCenter' | 'verticallyCenter'
export type IWhiteboardLayout = 'horizontallySpacing' | 'verticallySpacing' | 'auto' | 'byType'

export * from './instance'
