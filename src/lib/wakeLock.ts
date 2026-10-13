import { useEffect } from 'react'

type Sentinel = { release: () => Promise<void>; released?: boolean }
type WakeLockNav = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } }

export const wakeLockSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** Keeps the screen on while `active` (Screen Wake Lock API). Re-acquires when the tab becomes visible again. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !wakeLockSupported()) return
    let sentinel: Sentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const s = await (navigator as WakeLockNav).wakeLock!.request('screen')
        if (cancelled) void s.release()
        else sentinel = s
      } catch {
        /* denied (e.g. low battery); ignore */
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel) void sentinel.release()
    }
  }, [active])
}
