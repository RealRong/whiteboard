import { EDGE_ARROW_END_ID, EDGE_ARROW_START_ID, EDGE_DASH_ANIMATION } from '../constants'

export const EdgeMarkerDefs = () => {
  return (
    <>
      <style>
        {`
          @keyframes ${EDGE_DASH_ANIMATION} {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: -100; }
          }
        `}
      </style>
      <defs>
        <marker
          id={EDGE_ARROW_END_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
        <marker
          id={EDGE_ARROW_START_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
      </defs>
    </>
  )
}
