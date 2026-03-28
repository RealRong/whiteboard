import type { Editor } from '../../runtime/instance'
import { useStoreValue } from '../../runtime/hooks'

export type MarqueeSession = Editor['host']['selection']['marquee']

export const Marquee = ({
  marquee
}: {
  marquee: MarqueeSession
}) => {
  const rect = useStoreValue(marquee.rect)
  const match = useStoreValue(marquee.match)

  if (!rect || !match) return null

  return (
    <div
      className="wb-marquee-layer"
      data-match={match}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
