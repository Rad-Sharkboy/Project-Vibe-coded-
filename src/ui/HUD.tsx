import { AnimatePresence, motion } from 'framer-motion'
import { useGame } from '../game/store'
import { STORY } from '../game/story'
import { BUILDABLE, blockName } from '../engine/blocks'
import Minimap from './Minimap'
import { gameRef } from '../game/game'

const SWATCH: Record<number, string> = {
  1: '#5d9c4a',
  8: '#b08458',
  6: '#b05c4a',
  4: '#dcd8cc',
  13: '#b8e0f0',
  18: '#fff6d6',
  11: '#487e42',
  36: '#ff5ca8',
  37: '#56e0ff',
  28: '#3a4e76',
  19: '#7c5c3e',
  61: '#9e9c96',
  47: '#ba9264',
  33: '#6aa851',
  31: '#408ed2',
  30: '#a2a8b0',
}

const WEATHER: Record<string, { icon: string; label: string }> = {
  clear: { icon: '☀️', label: 'Clear skies' },
  rain: { icon: '🌧️', label: 'Rain' },
}

function timeLabel(h: number) {
  if (h < 5) return 'Late night'
  if (h < 8) return 'Early morning'
  if (h < 12) return 'Morning'
  if (h < 15) return 'Midday'
  if (h < 18) return 'Afternoon'
  if (h < 21) return 'Evening'
  return 'Night'
}

function clock(h: number) {
  const hh = Math.floor(h)
  const mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export default function HUD() {
  const vitals = useGame((s) => s.vitals)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const xpNext = useGame((s) => s.xpNext)
  const coins = useGame((s) => s.coins)
  const gpa = useGame((s) => s.gpa)
  const questStep = useGame((s) => s.questStep)
  const prompt = useGame((s) => s.prompt)
  const hours = useGame((s) => s.hours)
  const day = useGame((s) => s.day)
  const weather = useGame((s) => s.weather)
  const objective = useGame((s) => s.objective)
  const buildMode = useGame((s) => s.buildMode)
  const hotbar = useGame((s) => s.hotbar)
  const zone = useGame((s) => s.zone)
  const zoneVisible = useGame((s) => s.zoneVisible)
  const fps = useGame((s) => s.fps)
  const toasts = useGame((s) => s.toasts)
  const photo = useGame((s) => s.screen === 'photo')
  const locked = useGame((s) => s.pointerLocked)
  const screen = useGame((s) => s.screen)
  const w = WEATHER[weather] ?? WEATHER.clear

  const step = STORY[Math.min(questStep, STORY.length - 1)]
  const stepNum = Math.min(questStep + 1, STORY.length)
  const allDone = questStep >= STORY.length

  return (
    <>
      <div className="hud">
        <div className="hud-left">
          <motion.div
            className="profile glass"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.1 }}
          >
            <div className="level-ring" style={{ ['--p' as string]: `${Math.min(100, (xp / xpNext) * 100)}%` }}>
              <b>{level}</b>
            </div>
            <div className="profile-info">
              <div className="profile-name">
                Fresher <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· 214</span>
              </div>
              <div className="profile-sub">
                <span>
                  GPA <b>{gpa.toFixed(1)}</b>
                </span>
                <span>
                  ¤<b>{coins}</b>
                </span>
              </div>
              <div className="xp-track">
                <i style={{ width: `${Math.min(100, (xp / xpNext) * 100)}%` }} />
              </div>
            </div>
          </motion.div>

          <motion.div
            className="vitals glass"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 110, damping: 18, delay: 0.18 }}
          >
            <div className="panel-title">
              <span>Student vitals</span>
              <span style={{ color: vitals.energy < 22 ? 'var(--danger)' : 'var(--green)' }}>
                {vitals.energy < 22 ? 'exhausted' : 'stable'}
              </span>
            </div>
            {[
              { k: 'energy', icon: '⚡', label: 'Energy', v: vitals.energy },
              { k: 'caffeine', icon: '☕', label: 'Caffeine', v: vitals.caffeine },
              { k: 'study', icon: '📘', label: 'Study', v: vitals.study },
              { k: 'social', icon: '🫂', label: 'Social', v: vitals.social },
            ].map((row) => (
              <div className={`vital v-${row.k}`} key={row.k}>
                <span className="ico">{row.icon}</span>
                <div className="track" title={row.label}>
                  <i style={{ width: `${row.v}%` }} />
                </div>
                <span className="num">{Math.round(row.v)}</span>
              </div>
            ))}
          </motion.div>

          <motion.div
            className="quest-card glass"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.26 }}
          >
            <div className="panel-title">
              <span>Freshers week</span>
              <span style={{ color: 'var(--cyan)' }}>
                {allDone ? 'complete' : `${stepNum}/${STORY.length}`}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id + (allDone ? 'done' : '')}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.28 }}
              >
                <div className="quest-step">{allDone ? 'GRADUATED FROM WEEK ONE' : 'CURRENT OBJECTIVE'}</div>
                <div className="quest-title">{allDone ? 'You survived Freshers Week' : step.title}</div>
                <div className="quest-desc">{allDone ? 'The campus is yours. Explore, build, and nap aggressively.' : step.desc}</div>
                {!allDone && (
                  <div className="quest-hint">
                    <span className="arrow">▸</span>
                    <span>{step.hint}</span>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        <div className="hud-center-top">
          <motion.div
            className="clock-card glass"
            initial={{ y: -26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.1 }}
          >
            <span style={{ fontSize: 18 }}>{w.icon}</span>
            <div className="clock-time">{clock(hours)}</div>
            <div className="clock-meta">
              <b>{timeLabel(hours)}</b>
              <span>
                Day {day} · {zone}
              </span>
            </div>
          </motion.div>
        </div>

        <div className="hud-right">
          <motion.div
            className="top-right"
            initial={{ y: -26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.14 }}
          >
            <div className="chip" title="Frames per second">
              <span className="dot" style={{ background: fps > 50 ? 'var(--green)' : fps > 32 ? 'var(--gold)' : 'var(--danger)' }} />
              {fps} fps
            </div>
            <button
              className="icon-btn interactive"
              title="Journal & settings (Tab)"
              onClick={() => gameRef.current?.openOverlay('journal')}
            >
              ☰
            </button>
            <button
              className="icon-btn interactive"
              title="Photo mode (F)"
              onClick={() => gameRef.current?.togglePhoto()}
            >
              📷
            </button>
          </motion.div>

          <Minimap />

          <AnimatePresence>
            {objective && !photo && (
              <motion.div
                className="objective-pill glass"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                data-objective-x={objective.x}
                data-objective-z={objective.z}
              >
                <span className="arrow-badge" style={{ transform: `rotate(${(objective.bearing * 180) / Math.PI}deg)` }}>
                  ↑
                </span>
                <span>{objective.label}</span>
                <b>{Math.round(objective.dist)}m</b>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="toasts">
            <AnimatePresence>
              {toasts.slice(-4).map((t) => (
                <motion.div
                  key={t.id}
                  className={`toast ${t.kind}`}
                  initial={{ opacity: 0, x: 40, scale: 0.94 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 30, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                >
                  <div className="ticon">{t.icon ?? '✦'}</div>
                  <div className="tbody">
                    <b>{t.title}</b>
                    {t.body ? <span>{t.body}</span> : null}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="hud-bottom">
          <AnimatePresence mode="wait">
            {buildMode && (
              <motion.div
                key="hotbar"
                className="hotbar glass"
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
              >
                {BUILDABLE.map((b, i) => (
                  <button
                    key={b}
                    className={`slot interactive ${i === hotbar ? 'active' : ''}`}
                    onClick={() => {
                      gameRef.current?.selectSlot(i)
                    }}
                    title={blockName(b)}
                  >
                    <span className="idx">{i + 1}</span>
                    <span className="swatch" style={{ background: SWATCH[b] ?? '#888' }} />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          {buildMode && (
            <div className="hotbar-hint">LMB mine · RMB place · 1–9 select · B exit</div>
          )}
          <AnimatePresence mode="wait">
            {prompt && !buildMode && (
              <motion.div
                key={prompt.id}
                className="prompt glass"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <span className="key">E</span>
                <div className="prompt-text">
                  <b>{prompt.label}</b>
                  <span>{prompt.verb}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {!locked && screen === 'playing' && (
          <motion.div className="lock-hint interactive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => gameRef.current?.requestLock()}>
            <span className="key">click</span> to look around · WASD to walk · E to interact
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`crosshair ${prompt ? 'has-target' : ''}`} style={{ opacity: photo ? 0 : 1 }}>
        <i />
        <i />
        <s />
        <s />
        <span className="dot" />
      </div>

      <AnimatePresence>
        {zoneVisible && (
          <motion.div
            className="zone-banner"
            initial={{ opacity: 0, y: -18, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.5 }}
          >
            <div className="zk">now entering</div>
            <div className="zn">{zone}</div>
            <div className="rule" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
