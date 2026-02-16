export const bindWindow = <K extends keyof WindowEventMap>(
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
) => {
  window.addEventListener(type, listener as EventListener, options)
  return () => {
    window.removeEventListener(type, listener as EventListener, options)
  }
}
