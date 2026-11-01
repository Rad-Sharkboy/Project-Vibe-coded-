import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../game/store'

export function FadeOverlay() {
  const fading = useGame((s) => s.fading)
  const label = useGame((s) => s.fadeLabel)
  return (
    <AnimatePresence>
      {fading && (
        <motion.div
          className="fade"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="flabel"
            initial={{ opacity: 0, letterSpacing: '0.8em' }}
            animate={{ opacity: 1, letterSpacing: '0.4em' }}
            transition={{ delay: 0.35, duration: 0.9 }}
          >
            {label}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Cinematic() {
  const screen = useGame((s) => s.screen)
  const open = screen === 'cinematic'
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="cinematic-bars" />
          <motion.div
            className="cine-caption"
            initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ delay: 0.5, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="k">monday · 08:35 · freshers week</div>
            <div className="t">Northlight University</div>
            <div className="s">Four buildings, one pond, three thousand students, one deadline.</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PhotoOverlay() {
  const screen = useGame((s) => s.screen)
  const hours = useGame((s) => s.hours)
  if (screen !== 'photo') return null
  const hh = Math.floor(hours)
  const mm = Math.floor((hours - hh) * 60)
  return (
    <>
      <div className="photo-frame" />
      <div className="photo-meta">
        <span>◉ rec · f/1.8 · 24mm</span>
        <span>
          {String(hh).padStart(2, '0')}:{String(mm).padStart(2, '0')}
        </span>
        <span>press F to exit</span>
      </div>
    </>
  )
}

export function Vignette() {
  return <div className="vignette" />
}

export function SpeedLines() {
  const screen = useGame((s) => s.screen)
  void screen
  return null
}
