import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../game/store'

export default function Dialogue() {
  const d = useGame((s) => s.dialogue)
  const advance = useGame((s) => s.advanceDialogue)
  const [shown, setShown] = useState('')
  const [typing, setTyping] = useState(true)
  const timer = useRef<number | null>(null)

  const text = d?.lines[d.index]?.text ?? ''
  const emote = d?.lines[d.index]?.emote

  useEffect(() => {
    if (!d) return
    setShown('')
    setTyping(true)
    let i = 0
    if (timer.current) window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) {
        setTyping(false)
        if (timer.current) window.clearInterval(timer.current)
        timer.current = null
      }
    }, 18)
    return () => {
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [d?.index, d?.npcId, text, d])

  if (!d) return null

  const initials = d.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')

  const click = () => {
    if (typing) {
      setShown(text)
      setTyping(false)
      if (timer.current) window.clearInterval(timer.current)
      timer.current = null
    } else {
      advance()
    }
  }

  return (
    <motion.div
      className="dialogue-wrap"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: 'spring', stiffness: 190, damping: 24 }}
    >
      <div className="dialogue" onClick={click} role="button" tabIndex={0}>
        <div
          className="avatar"
          style={{
            background: `linear-gradient(145deg, ${d.color}, ${d.color}66)`,
            boxShadow: `0 0 50px -16px ${d.color}, inset 0 -4px 0 rgba(0,0,0,0.2)`,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="dialogue-head">
            <span className="dialogue-name">{d.name}</span>
            <span className="dialogue-role">{d.role}</span>
          </div>
          <div className="dialogue-body">
            {shown}
            {emote && !typing ? <span className="emote">{emote}</span> : null}
            {typing ? <span className="caret" /> : null}
          </div>
          <div className="dialogue-foot">
            <div className="dialogue-dots">
              {d.lines.map((_, i) => (
                <i key={i} className={i <= d.index ? 'on' : ''} />
              ))}
            </div>
            <div className="dialogue-continue">
              {typing ? 'typing…' : d.index >= d.lines.length - 1 ? 'click to close' : 'click to continue'} <span>›</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
