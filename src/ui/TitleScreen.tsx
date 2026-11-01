import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../game/store'
import { audio } from '../engine/audio'
import { gameRef } from '../game/game'

const FEATURES = [
  { icon: '🗺️', text: '256 × 256 voxel campus' },
  { icon: '🎓', text: 'Freshers Week storyline' },
  { icon: '🧱', text: 'Mine & build mode' },
  { icon: '🌗', text: 'Full day / night cycle' },
  { icon: '🎧', text: 'Procedural lo-fi score' },
  { icon: '⚡', text: '60 fps greedy-meshed voxels' },
]

export default function TitleScreen() {
  const progress = useGame((s) => s.progress)
  const label = useGame((s) => s.progressLabel)
  const sub = useGame((s) => s.progressSub)
  const [help, setHelp] = useState(false)
  const [starting, setStarting] = useState(false)
  const loaded = progress >= 1

  const start = () => {
    if (!loaded || starting) return
    setStarting(true)
    audio.init()
    audio.resume()
    audio.ui('click')
    gameRef.current?.startCinematic()
  }

  return (
    <motion.div
      className="title-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="title-inner">
        <motion.div initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15, duration: 0.7 }}>
          <div className="kicker">Northlight University · Freshers Week</div>
        </motion.div>

        <motion.h1 className="logo" initial={{ y: 34, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.22, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
          Campus
          <br />
          Craft
          <span className="thin">a voxel university life</span>
        </motion.h1>

        <motion.p className="tagline" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4, duration: 0.7 }}>
          You slept through three alarms. Orientation starts in twenty minutes. The whole campus is
          walkable, every building has an inside, and somewhere in the library a book is{' '}
          <b>glowing</b>. Wander, talk, caffeinate, build.
        </motion.p>

        <motion.div className="title-actions" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.7 }}>
          <button className="btn primary" onClick={start} disabled={!loaded}>
            {loaded ? 'Enter Campus' : 'Building campus…'}
            <span style={{ fontSize: 16 }}>→</span>
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              setHelp((h) => !h)
              audio.init()
              audio.ui('click')
            }}
          >
            {help ? 'Hide controls' : 'How to play'}
          </button>
        </motion.div>

        <motion.div className="feature-row" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.62, duration: 0.7 }}>
          {FEATURES.map((f) => (
            <div className="feature" key={f.text}>
              <span className="ico">{f.icon}</span>
              {f.text}
            </div>
          ))}
        </motion.div>

        <AnimatePresence>
          {help && (
            <motion.div
              className="glass"
              style={{ padding: '16px 18px', maxWidth: 520, width: '100%' }}
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
            >
              <div className="panel-title" style={{ marginBottom: 8 }}>
                <span>Controls</span>
                <span style={{ color: 'var(--cyan)' }}>keyboard + mouse</span>
              </div>
              <div className="help-list">
                {[
                  ['W A S D', 'Walk the campus'],
                  ['Shift', 'Sprint (FOV kicks out)'],
                  ['Space', 'Jump · double jump from level 4'],
                  ['E', 'Interact with people & things'],
                  ['Mouse', 'Look around (click to capture)'],
                  ['LMB / RMB', 'Mine / place blocks'],
                  ['B', 'Build mode (unlocks after orientation)'],
                  ['Tab / I / F', 'Journal · Bag · Photo mode'],
                ].map(([k, v]) => (
                  <div className="help-row" key={k}>
                    <b>{k}</b>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="title-footer">
        <div>
          <div className="load-meta">
            <span>
              <b>{label || 'Preparing…'}</b>
              {sub ? <span style={{ marginLeft: 10, opacity: 0.7 }}>{sub}</span> : null}
            </span>
            <span className="mono" style={{ letterSpacing: '0.1em' }}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className="load-bar">
            <i style={{ width: `${Math.max(3, progress * 100)}%` }} />
          </div>
        </div>
        <div className="title-corner">
          <div className="chip">
            <span className="dot" />
            {loaded ? 'campus ready' : 'streaming chunks'}
          </div>
          <div className="mono" style={{ textAlign: 'right' }}>
            handcrafted voxel engine · three.js
            <br />
            built for 60 fps · no external assets
          </div>
        </div>
      </div>
    </motion.div>
  )
}
