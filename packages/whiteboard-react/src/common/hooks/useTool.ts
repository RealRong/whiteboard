import { useWhiteboardSelector } from './useWhiteboardSelector'

export const useActiveTool = () => {
  return (useWhiteboardSelector('tool') as 'select' | 'edge') ?? 'select'
}
