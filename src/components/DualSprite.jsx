import { useRef, useEffect } from 'react'

// Side-by-side view of the normal sprite and a variant (shiny or female).
// For animated (Gen 5 BW) GIFs the two share identical frame timing, so
// restarting both from frame 0 in the same tick keeps them playing in
// lockstep instead of drifting out of phase.
export default function DualSprite({ normalSrc, secondSrc, secondLabel, alt, onClick, clickable, title }) {
  const normalRef = useRef(null)
  const secondRef = useRef(null)

  useEffect(() => {
    const imgs = [normalRef.current, secondRef.current].filter(Boolean)
    if (imgs.length < 2) return

    let remaining = imgs.length
    const syncRestart = () => {
      // Only once BOTH are decoded, reassign src on each in the same tick —
      // this rewinds each GIF to frame 0 so their loops line up.
      if (--remaining > 0) return
      for (const img of imgs) {
        const src = img.src
        img.src = ''
        img.src = src
      }
    }

    for (const img of imgs) {
      if (img.complete) syncRestart()
      else img.addEventListener('load', syncRestart, { once: true })
    }

    return () => {
      for (const img of imgs) img.removeEventListener('load', syncRestart)
    }
  }, [normalSrc, secondSrc])

  return (
    <div
      className="sprite-dual"
      onClick={onClick}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      title={title}
    >
      <img ref={normalRef} src={normalSrc} alt={alt} className="pokemon-main-image" />
      <img ref={secondRef} src={secondSrc} alt={`${alt} (${secondLabel})`} className="pokemon-main-image" />
    </div>
  )
}
