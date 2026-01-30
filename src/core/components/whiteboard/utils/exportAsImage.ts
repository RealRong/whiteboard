import { Box, IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'
import { toSvg } from 'html-to-image'
import tinycolor from 'tinycolor2'
import { Options } from 'html-to-image/src/types'
import { checkCanvasDimensions, createImage, getImageSize, getPixelRatio } from 'html-to-image/es/util'

const getTransformForBounds = (bounds: Box, width: number, height: number, minZoom: number, maxZoom: number, padding = 20) => {
  const xZoom = width / (bounds.width + padding)
  const yZoom = height / (bounds.height + padding)
  const zoom = Math.min(xZoom, yZoom)
  const clampedZoom = clamp(zoom, minZoom, maxZoom)
  const boundsCenterX = bounds.left + bounds.width / 2
  const boundsCenterY = bounds.top + bounds.height / 2
  const x = width / 2 - boundsCenterX * clampedZoom
  const y = height / 2 - boundsCenterY * clampedZoom

  return [x, y, clampedZoom]
}
const clamp = (val: number, min = 0, max = 1): number => Math.min(Math.max(val, min), max)

const MAX_WIDTH = 10000
const MAX_HEIGHT = 10000
export const exportWhiteboardAsImage = async (allNodes: IWhiteboardNode[], node: HTMLElement, instance: IWhiteboardInstance) => {
  const box = instance.nodeOps?.getDOMBoxOfNodes(allNodes.map(i => i.id))
  if (!box) return
  const outer = getBoxOfBoxes(Array.from(Object.values(box)))
  if (!outer) return
  const scale = Math.min(MAX_WIDTH / outer.width, MAX_HEIGHT / outer.height, 1)
  const scaledSize = [outer.width * scale, outer.height * scale]
  const transform = getTransformForBounds(outer, scaledSize[0], scaledSize[1], 0, 2000, 20)
  const background = window.getComputedStyle(document.body).getPropertyValue('--global-background')
  const rgb = tinycolor(background).toRgbString()
  const config = {
    width: scaledSize[0],
    height: scaledSize[1],
    backgroundColor: rgb,
    pixelRatio: 1,
    skipAutoScale: true,
    style: {
      width: scaledSize[0],
      height: scaledSize[1],
      transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`
    }
  }
  const canvas = await toCanvas(node, config)
  return canvas.toDataURL()
}

async function toCanvas<T extends HTMLElement>(node: T, options: Options = {}): Promise<HTMLCanvasElement> {
  const { width, height } = getImageSize(node, options)
  const svg = await toSvg(node, options)
  const img = await createImage(svg)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const ratio = options.pixelRatio || getPixelRatio()
  const canvasWidth = options.canvasWidth || width
  const canvasHeight = options.canvasHeight || height

  canvas.width = canvasWidth * ratio
  canvas.height = canvasHeight * ratio

  if (!options.skipAutoScale) {
    checkCanvasDimensions(canvas)
  }
  canvas.style.width = `${canvasWidth}`
  canvas.style.height = `${canvasHeight}`
  console.log(canvasWidth, canvasHeight, ratio)
  if (options.backgroundColor) {
    context.fillStyle = options.backgroundColor
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}
