import { useMemo, useRef, type CSSProperties } from 'react'
import { useBoardRuntime, useResolvedConfig, useTool } from '../../board'
import { useStoreValue } from '../../shared/hooks/useStoreValue'
import { Background } from '../../canvas/Background'
import { Chrome } from '../../canvas/Chrome'
import { DrawLayer } from '../../features/draw/DrawLayer'
import { EdgeLayer } from '../../features/edge/components/EdgeLayer'
import { EdgeOverlayLayer } from '../../features/edge/components/EdgeOverlayLayer'
import { MindmapSceneLayer } from '../../features/mindmap/components/MindmapSceneLayer'
import {
  ContainerChromeLayer,
  FrameLayer
} from '../../features/node/components/FrameLayer'
import { NodeOverlayLayer } from '../../features/node/components/NodeOverlayLayer'
import { NodeSceneLayer } from '../../features/node/components/NodeSceneLayer'
import { SurfaceBindings } from './Bindings'

export const Surface = () => {
  const editor = useBoardRuntime()
  const resolvedConfig = useResolvedConfig()
  const viewport = useStoreValue(editor.state.viewport)
  const tool = useTool()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const transformStyle = useMemo(
    () => ({
      transform: `translate(50%, 50%) scale(${viewport.zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      transformOrigin: '0 0',
      '--wb-zoom': `${viewport.zoom}`
    } as CSSProperties),
    [viewport]
  )

  return (
    <div
      ref={containerRef}
      className={resolvedConfig.className ? `wb-root-container ${resolvedConfig.className}` : 'wb-root-container'}
      data-tool={tool.type}
      data-tool-value={
        tool.type === 'edge' || tool.type === 'insert'
          ? tool.preset
          : tool.type === 'draw'
            ? tool.kind
            : undefined
      }
      style={resolvedConfig.style}
      tabIndex={0}
    >
      <SurfaceBindings containerRef={containerRef} />
      <Background />
      <div className="wb-root-viewport" style={transformStyle}>
        <FrameLayer />
        <EdgeLayer />
        <NodeSceneLayer />
        <MindmapSceneLayer />
        <ContainerChromeLayer />
        <NodeOverlayLayer />
        <EdgeOverlayLayer />
        <DrawLayer />
      </div>
      <Chrome containerRef={containerRef} />
    </div>
  )
}
