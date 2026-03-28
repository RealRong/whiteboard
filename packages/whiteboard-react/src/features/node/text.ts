export { TEXT_DEFAULT_FONT_SIZE } from '@whiteboard/core/node'
export type { TextVariant } from '@whiteboard/core/node'
export {
  STICKY_DEFAULT_FILL,
  STICKY_DEFAULT_STROKE,
  STICKY_DEFAULT_STROKE_WIDTH,
  STICKY_DEFAULT_TEXT_COLOR,
  STICKY_PLACEHOLDER,
  STICKY_START_SIZE,
  TEXT_PLACEHOLDER,
  TEXT_START_SIZE,
  createStickyNodeInput,
  createTextNodeInput
} from '@whiteboard/editor/node'
export type { TextWidthMode } from './textContent'
export {
  focusEditableEnd,
  isTextContentEmpty,
  isTextNode,
  readEditableText,
  readTextWidthMode,
  setTextWidthMode
} from './textContent'
export type { TextMeasureSize } from './textMeasure'
export {
  TEXT_AUTO_MAX_WIDTH,
  TEXT_MIN_WIDTH,
  measureTextNodeSize
} from './textMeasure'
export type { TextAutoFontTask } from './textAutoFont'
export {
  createTextAutoFontTask,
  estimateTextAutoFont,
  scheduleTextAutoFont
} from './textAutoFont'
