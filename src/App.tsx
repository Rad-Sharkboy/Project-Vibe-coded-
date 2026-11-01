import { useEffect, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Game, gameRef } from './game/game'
import { useGame } from './game/store'
import TitleScreen from './ui/TitleScreen'
import HUD from './ui/HUD'
import Dialogue from './ui/Dialogue'
import { Bag, Journal, PauseMenu } from './ui/Modals'
import { Cinematic, FadeOverlay, PhotoOverlay, Vignette } from './ui/Overlays'
import { audio } from './engine/audio'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const screen = useGame((s) => s.screen)
  const dialogue = useGame((s) => s.dialogue)
  const settings = useGame((s) => s.settings)

  useEffect(() => {
    if (!canvasRef.current || gameRef.current) return
    const game = new Game(canvasRef.current)
    gameRef.current = game
    void game.load()
    return () => {
      game.dispose()
      gameRef.current = null
    }
  }, [])

  useEffect(() => {
    audio.setMusicVolume(settings.music)
    audio.setSfxVolume(settings.sfx)
  }, [settings.music, settings.sfx])

  const inGame = screen === 'playing' || screen === 'photo' || screen === 'paused'

  return (
    <div className="app">
      <div className="viewport">
        <canvas ref={canvasRef} />
      </div>

      <div className="ui">
        <AnimatePresence>{screen === 'title' && <TitleScreen key="title" />}</AnimatePresence>
        <Cinematic />
        <Vignette />
        {inGame && screen !== 'photo' && <HUD />}
        {screen === 'photo' && <PhotoOverlay />}
        <AnimatePresence>{dialogue && <Dialogue key="dialogue" />}</AnimatePresence>
        <Journal />
        <Bag />
        <PauseMenu />
        <FadeOverlay />
      </div>
    </div>
  )
}
