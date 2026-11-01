import { useEffect, useRef } from 'react'
import { gameRef } from '../game/game'

/** Canvas minimap drawn straight from the baked world map — no React re-renders. */
export default function Minimap() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const size = canvas.clientWidth || 180
      if (canvas.width !== Math.floor(size * dpr)) {
        canvas.width = Math.floor(size * dpr)
        canvas.height = Math.floor(size * dpr)
      }
      const game = gameRef.current
      const map = game?.getMap()
      if (!game || !map) return
      const p = game.getPlayerSnapshot()
      const w = canvas.width
      const h = canvas.height
      const zoom = w / 88 // ~88 blocks across
      ctx.save()
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = '#080b14'
      ctx.fillRect(0, 0, w, h)
      // rotate map so player always faces up
      ctx.translate(w / 2, h / 2)
      ctx.rotate(-p.yaw)
      ctx.scale(zoom, zoom)
      ctx.imageSmoothingEnabled = false
      ctx.translate(-p.x, -p.z)
      ctx.drawImage(map, 0, 0)
      ctx.restore()

      // npc dots
      const npcs = game.getNpcSnapshot()
      ctx.save()
      ctx.translate(w / 2, h / 2)
      for (const n of npcs) {
        const dx = (n.x - p.x) * zoom
        const dz = (n.z - p.z) * zoom
        const cos = Math.cos(-p.yaw)
        const sin = Math.sin(-p.yaw)
        const rx = dx * cos - dz * sin
        const rz = dx * sin + dz * cos
        if (Math.hypot(rx, rz) > w / 2 - 8) continue
        ctx.beginPath()
        ctx.arc(rx, rz, 2.2 * dpr, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 201, 107, 0.95)'
        ctx.shadowColor = 'rgba(255,201,107,0.9)'
        ctx.shadowBlur = 6 * dpr
        ctx.fill()
      }
      ctx.restore()

      // objective marker
      const objEl = document.querySelector('[data-objective-x]') as HTMLElement | null
      if (objEl) {
        const ox = parseFloat(objEl.dataset.objectiveX || '0')
        const oz = parseFloat(objEl.dataset.objectiveZ || '0')
        const dx = (ox - p.x) * zoom
        const dz = (oz - p.z) * zoom
        const cos = Math.cos(-p.yaw)
        const sin = Math.sin(-p.yaw)
        const rx = dx * cos - dz * sin
        const rz = dx * sin + dz * cos
        const clampR = w / 2 - 10
        const d = Math.hypot(rx, rz)
        const k = d > clampR ? clampR / d : 1
        ctx.beginPath()
        ctx.arc(rx * k, rz * k, 4.5 * dpr, 0, Math.PI * 2)
        ctx.fillStyle = '#62e6ff'
        ctx.shadowColor = '#62e6ff'
        ctx.shadowBlur = 12 * dpr
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // player arrow
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.beginPath()
      ctx.moveTo(0, -6.5 * dpr)
      ctx.lineTo(4.6 * dpr, 5 * dpr)
      ctx.lineTo(0, 2.6 * dpr)
      ctx.lineTo(-4.6 * dpr, 5 * dpr)
      ctx.closePath()
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = 'rgba(0,0,0,0.9)'
      ctx.shadowBlur = 6 * dpr
      ctx.fill()
      ctx.restore()

      // compass N
      const northX = w / 2 + Math.sin(-p.yaw) * (w / 2 - 14)
      const northZ = h / 2 - Math.cos(p.yaw) * (h / 2 - 14)
      ctx.font = `${9 * dpr}px 'JetBrains Mono', monospace`
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('N', northX, northZ)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="mini-map interactive" title="Campus map">
      <canvas ref={ref} />
      <div className="mini-ring" />
      <div className="mini-label">live map</div>
    </div>
  )
}
