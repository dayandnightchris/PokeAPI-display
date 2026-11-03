import { useEffect, useRef, useState } from 'react'

const AD_CLIENT = 'ca-pub-3943102684396180'

// Ad unit IDs (data-ad-slot) from AdSense → Ads → By ad unit
export const AD_UNITS = {
  horizontal: '8465955906',
}

// The app's mobile layout breakpoint (moves switch to tabs, etc.)
export const MOBILE_QUERY = '(max-width: 768px)'

// The same script serves our own units and Auto ads (the desktop side rails);
// which Auto ads formats show is set in the AdSense dashboard.
export function loadAdSenseScript() {
  if (document.querySelector('script[src*="adsbygoogle"]')) return
  const script = document.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`
  script.crossOrigin = 'anonymous'
  document.head.appendChild(script)
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/**
 * One responsive AdSense unit, placed by us. In-page Auto ads are off in the
 * AdSense dashboard, so Google adds no banners of its own inside the page.
 * Loads the AdSense script on first mount. Give it a new `key` to request a
 * fresh ad for a new page. Only mount it where it will be visible: AdSense
 * can't fill an <ins> that has no width.
 */
function AdSlot({ slot, className = '' }) {
  const pushedRef = useRef(false)

  useEffect(() => {
    loadAdSenseScript()
    // StrictMode re-runs effects on the same <ins>; a second push would error
    if (pushedRef.current) return
    pushedRef.current = true
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch { /* blocked by an ad blocker */ }
  }, [])

  return (
    <aside className={`ad-slot ${className}`.trim()} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}

export default AdSlot
