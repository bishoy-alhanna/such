import { useEffect, useState } from 'react'

// Shared listener list so multiple components get notified when the API loads.
const listeners: Array<() => void> = []

function notifyAll() {
  listeners.splice(0).forEach(fn => fn())
}

export function useGoogleMaps(): boolean {
  const [loaded, setLoaded] = useState(!!(window as any).google?.maps)

  useEffect(() => {
    if ((window as any).google?.maps) { setLoaded(true); return }

    listeners.push(() => setLoaded(true))

    const key = (window as any).GOOGLE_MAPS_API_KEY
    if (!key || document.querySelector('script[data-gmaps]')) return

    ;(window as any).__gmapsReady__ = () => {
      delete (window as any).__gmapsReady__
      notifyAll()
    }

    const s = document.createElement('script')
    s.setAttribute('data-gmaps', '1')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=marker&callback=__gmapsReady__`
    document.head.appendChild(s)
  }, [])

  return loaded
}
