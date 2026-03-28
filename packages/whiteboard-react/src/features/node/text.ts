export { TEXT_DEFAULT_FONT_SIZE } from '@whiteboard/core/node'
export type { TextVariant } from '@whiteboard/core/node'
export {
  STICKY_DEFAULT_FILL,
  STICKY_DEFAULT_STROKE,
  STICKY_DEFAULT_STROKE_WIDTH,
  STICKY_DEFAULT_TEXT_COLOR,
  STICKY_PLACEHOLDER,
  STICKY_START_SIZE,
  TEXT_AUTO_MAX_WIDTH,
  TEXT_MIN_WIDTH,
  TEXT_PLACEHOLDER,
  TEXT_START_SIZE,
  createStickyNodeInput,
  createTextNodeInput,
  isTextContentEmpty,
  isTextNode,
  measureTextNodeSize,
  readTextWidthMode,
  setTextWidthMode
} from '@whiteboard/editor/node'
export type {
  TextMeasureSize,
  TextWidthMode
} from '@whiteboard/editor/node'
export {
  focusEditableEnd,
  readEditableText
} from './textContent'
export type { TextAutoFontTask } from './textAutoFont'
export {
  createTextAutoFontTask,
  estimateTextAutoFont,
  scheduleTextAutoFont
} from './textAutoFont'
