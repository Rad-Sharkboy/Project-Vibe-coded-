import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ACHIEVEMENTS, useGame } from '../game/store'
import { STORY, ITEMS } from '../game/story'
import { audio } from '../engine/audio'
import { gameRef } from '../game/game'

const pop = {
  initial: { opacity: 0, scale: 0.96, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 10 },
  transition: { type: 'spring' as const, stiffness: 220, damping: 26 },
}

export function Journal() {
  const open = useGame((s) => s.showJournal)
  const set = useGame((s) => s.set)
  const questStep = useGame((s) => s.questStep)
  const completed = useGame((s) => s.completed)
  const achievements = useGame((s) => s.achievements)
  const level = useGame((s) => s.level)
  const xp = useGame((s) => s.xp)
  const xpNext = useGame((s) => s.xpNext)
  const coins = useGame((s) => s.coins)
  const gpa = useGame((s) => s.gpa)
  const zones = useGame((s) => s.zonesVisited)
  const talks = useGame((s) => s.talks)
  const settings = useGame((s) => s.settings)
  const day = useGame((s) => s.day)
  const fps = useGame((s) => s.fps)
  const [tab, setTab] = useState<'quests' | 'achievements' | 'stats' | 'settings'>('quests')

  const close = () => {
    set({ showJournal: false })
    gameRef.current?.resumePlay()
    audio.ui('close')
    gameRef.current?.resumePlay()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-scrim" {...pop} onClick={close}>
          <motion.div className="modal" onClick={(e) => e.stopPropagation()} {...pop}>
            <div className="modal-head">
              <div>
                <div className="mono" style={{ marginBottom: 6 }}>
                  Halcyon Hall · Room 214
                </div>
                <h2>Student Journal</h2>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="tabs">
                  {(['quests', 'achievements', 'stats', 'settings'] as const).map((t) => (
                    <button
                      key={t}
                      className={`tab ${tab === t ? 'active' : ''}`}
                      onClick={() => {
                        setTab(t)
                        audio.ui('hover')
                      }}
                    >
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                <button className="icon-btn" onClick={close} title="Close (Tab)">
                  ✕
                </button>
              </div>
            </div>
            <div className="modal-body">
              {tab === 'quests' && (
                <div className="quest-list">
                  {STORY.map((q, i) => {
                    const done = completed.includes(q.id)
                    const current = i === questStep
                    return (
                      <div key={q.id} className={`quest-row ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
                        <div className="qmark">{done ? '✓' : i + 1}</div>
                        <div>
                          <div className="qtitle">{q.title}</div>
                          <div className="qdesc">{q.desc}</div>
                        </div>
                        <div className="qwhere">{done ? 'done' : current ? q.where : 'locked'}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'achievements' && (
                <div className="ach-grid">
                  {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
                    const on = achievements.includes(id)
                    return (
                      <div key={id} className={`ach ${on ? 'on' : ''}`}>
                        <div className="medal">{on ? '🏆' : '🔒'}</div>
                        <div>
                          <b>{a.title}</b>
                          <span>{a.body}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {tab === 'stats' && (
                <div className="stat-grid">
                  {[
                    { k: 'Level', v: level, s: `${xp} / ${xpNext} xp` },
                    { k: 'GPA', v: gpa.toFixed(1), s: 'out of 4.0' },
                    { k: 'Credits', v: `¤${coins}`, s: 'campus currency' },
                    { k: 'Day', v: day, s: 'on campus' },
                    { k: 'Conversations', v: talks, s: 'people met' },
                    { k: 'Zones found', v: zones.length, s: 'named locations' },
                    { k: 'Performance', v: fps, s: 'frames per second' },
                    { k: 'Objectives', v: `${completed.length}/${STORY.length}`, s: 'freshers week' },
                  ].map((s) => (
                    <div className="stat" key={s.k}>
                      <div className="k">{s.k}</div>
                      <div className="v">{s.v}</div>
                      <div className="k" style={{ marginTop: 6, textTransform: 'none', letterSpacing: 0 }}>
                        {s.s}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === 'settings' && <Settings />}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Settings() {
  const settings = useGame((s) => s.settings)
  const set = useGame((s) => s.set)
  const rows = [
    { key: 'sensitivity', label: 'Mouse sensitivity', hint: 'How fast the camera turns', min: 0.2, max: 2, step: 0.05 },
    { key: 'music', label: 'Music volume', hint: 'Generative lo-fi, synthesised live', min: 0, max: 1, step: 0.02 },
    { key: 'sfx', label: 'Sound effects', hint: 'Footsteps, UI, ambience', min: 0, max: 1, step: 0.02 },
  ] as const
  return (
    <div>
      {rows.map((r) => (
        <div className="setting" key={r.key}>
          <label>
            {r.label}
            <span>{r.hint}</span>
          </label>
          <input
            type="range"
            min={r.min}
            max={r.max}
            step={r.step}
            value={settings[r.key]}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              set({ settings: { ...settings, [r.key]: v } })
              audio.setMusicVolume(r.key === 'music' ? v : settings.music)
              audio.setSfxVolume(r.key === 'sfx' ? v : settings.sfx)
            }}
          />
          <div className="val">{Math.round((settings[r.key] as number) * 100)}</div>
        </div>
      ))}
      <div className="setting">
        <label>
          Photo mode
          <span>Hide the HUD and frame a shot</span>
        </label>
        <div />
        <button
          className="btn ghost small"
          onClick={() => {
            gameRef.current?.togglePhoto()
            useGame.getState().set({ showJournal: false })
          }}
        >
          Open
        </button>
      </div>
      <div className="setting">
        <label>
          Return to the quad
          <span>Teleport back to Founders Fountain</span>
        </label>
        <div />
        <button
          className="btn ghost small"
          onClick={() => {
            gameRef.current?.teleport(132.5, 17.2, 128.5)
            useGame.getState().set({ showJournal: false })
            gameRef.current?.resumePlay()
          }}
        >
          Go
        </button>
      </div>
    </div>
  )
}

export function Bag() {
  const open = useGame((s) => s.showBag)
  const set = useGame((s) => s.set)
  const inventory = useGame((s) => s.inventory)
  const entries = Object.entries(inventory).filter(([, n]) => n > 0)
  const close = () => {
    set({ showBag: false })
    gameRef.current?.resumePlay()
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-scrim" {...pop} onClick={close}>
          <motion.div className="modal" style={{ width: 'min(720px, 94vw)' }} onClick={(e) => e.stopPropagation()} {...pop}>
            <div className="modal-head">
              <div>
                <div className="mono" style={{ marginBottom: 6 }}>
                  Messenger bag
                </div>
                <h2>What you are carrying</h2>
              </div>
              <button className="icon-btn" onClick={close}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {entries.length === 0 ? (
                <div className="empty">Nothing but vibes and a dead phone. Go buy a coffee.</div>
              ) : (
                <div className="bag-grid">
                  {entries.map(([id, count]) => {
                    const item = ITEMS[id] ?? { name: id, icon: '✦', desc: '' }
                    return (
                      <div className="item-card" key={id}>
                        <div className="ic">{item.icon}</div>
                        <div>
                          <b>{item.name}</b>
                          <span>{item.desc}</span>
                        </div>
                        <div className="qty">×{count}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PauseMenu() {
  const screen = useGame((s) => s.screen)
  const set = useGame((s) => s.set)
  const [help, setHelp] = useState(false)
  const open = screen === 'paused'
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-scrim" {...pop}>
          <motion.div className="pause-card interactive" {...pop}>
            <div className="mono">Halcyon Hall · Freshers Week</div>
            <h2>Paused</h2>
            <div className="sub">The campus keeps breathing, you do not have to.</div>
            <div className="pause-row">
              <button className="btn primary" onClick={() => gameRef.current?.resumePlay()}>
                Resume
              </button>
              <button className="btn ghost" onClick={() => gameRef.current?.openOverlay('journal')}>
                Journal
              </button>
              <button className="btn ghost" onClick={() => gameRef.current?.openOverlay('bag')}>
                Bag
              </button>
              <button className="btn ghost" onClick={() => setHelp(!help)}>
                {help ? 'Hide controls' : 'Controls'}
              </button>
            </div>
            <AnimatePresence>
              {help && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div className="help-list">
                    {[
                      ['W A S D', 'Walk'],
                      ['Shift', 'Sprint'],
                      ['Space', 'Jump (double jump at level 4)'],
                      ['Ctrl / C', 'Crouch'],
                      ['E', 'Interact / talk'],
                      ['LMB / RMB', 'Mine / place block'],
                      ['B', 'Build mode'],
                      ['1–9', 'Select block'],
                      ['Tab', 'Journal'],
                      ['I', 'Bag'],
                      ['F', 'Photo mode'],
                      ['Esc', 'Pause'],
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
            <div style={{ marginTop: 8 }}>
              <Settings />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
