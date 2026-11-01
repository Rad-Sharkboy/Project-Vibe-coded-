import { create } from 'zustand'

export type Screen = 'title' | 'loading' | 'cinematic' | 'playing' | 'paused' | 'photo'

export type Toast = {
  id: number
  kind: 'xp' | 'quest' | 'achievement' | 'info' | 'item' | 'level'
  title: string
  body?: string
  icon?: string
}

export type DialogueLine = { who?: string; text: string; emote?: string }
export type DialogueChoice = { label: string; action: string }
export type Dialogue = {
  npcId: string
  name: string
  role: string
  color: string
  lines: DialogueLine[]
  index: number
  choices?: DialogueChoice[]
  typing: boolean
}

export type Prompt = {
  id: string
  label: string
  verb: string
  type: string
} | null

export type Vitals = { energy: number; caffeine: number; study: number; social: number }

export type Settings = { sensitivity: number; music: number; sfx: number; speedLines: boolean }

type State = {
  screen: Screen
  progress: number
  progressLabel: string
  progressSub: string
  vitals: Vitals
  level: number
  xp: number
  xpNext: number
  coins: number
  gpa: number
  questStep: number
  completed: string[]
  inventory: Record<string, number>
  toasts: Toast[]
  dialogue: Dialogue | null
  prompt: Prompt
  zone: string
  zoneVisible: boolean
  hours: number
  day: number
  weather: string
  buildMode: boolean
  hotbar: number
  buildUnlocked: boolean
  achievements: string[]
  settings: Settings
  talks: number
  zonesVisited: string[]
  showHelp: boolean
  showJournal: boolean
  showBag: boolean
  fps: number
  photoHud: boolean
  fading: boolean
  fadeLabel: string
  pointerLocked: boolean
  objective: { label: string; x: number; z: number; bearing: number; dist: number } | null
  set: (partial: Partial<State>) => void
  setVitals: (v: Partial<Vitals>) => void
  addXp: (amount: number) => void
  addCoins: (n: number) => void
  addItem: (id: string, n?: number) => void
  removeItem: (id: string, n?: number) => void
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  startDialogue: (d: Omit<Dialogue, 'index' | 'typing'>) => void
  advanceDialogue: () => void
  endDialogue: () => void
  setPrompt: (p: Prompt) => void
  unlockAchievement: (id: string, title: string, body?: string) => void
  reset: () => void
}

let toastId = 1

const initial = {
  screen: 'title' as Screen,
  progress: 0,
  progressLabel: '',
  progressSub: '',
  vitals: { energy: 82, caffeine: 12, study: 8, social: 20 } as Vitals,
  level: 1,
  xp: 0,
  xpNext: 100,
  coins: 12,
  gpa: 2.8,
  questStep: 0,
  completed: [] as string[],
  inventory: {} as Record<string, number>,
  toasts: [] as Toast[],
  dialogue: null as Dialogue | null,
  prompt: null as Prompt,
  zone: 'Halcyon Hall',
  zoneVisible: false,
  hours: 8.4,
  day: 1,
  weather: 'clear',
  buildMode: false,
  hotbar: 0,
  buildUnlocked: false,
  achievements: [] as string[],
  settings: { sensitivity: 1, music: 0.5, sfx: 0.75, speedLines: true } as Settings,
  talks: 0,
  zonesVisited: [] as string[],
  showHelp: false,
  showJournal: false,
  showBag: false,
  fps: 60,
  photoHud: true,
  fading: false,
  fadeLabel: '',
  pointerLocked: false,
  objective: null as { label: string; x: number; z: number; bearing: number; dist: number } | null,
}

export const useGame = create<State>((set, get) => ({
  ...initial,
  set: (partial) => set(partial),
  setVitals: (v) => set((s) => ({ vitals: { ...s.vitals, ...v } })),
  addXp: (amount) => {
    const s = get()
    let xp = s.xp + amount
    let level = s.level
    let xpNext = s.xpNext
    let leveled = false
    while (xp >= xpNext) {
      xp -= xpNext
      level++
      xpNext = Math.round(xpNext * 1.35)
      leveled = true
    }
    set({ xp, level, xpNext })
    get().pushToast({ kind: 'xp', title: `+${amount} XP`, body: 'Experience earned', icon: '✦' })
    if (leveled) {
      set((st) => ({
        gpa: Math.min(4, Math.round((st.gpa + 0.1) * 10) / 10),
        coins: st.coins + 10,
        vitals: { ...st.vitals, energy: Math.min(100, st.vitals.energy + 25) },
      }))
      get().pushToast({ kind: 'level', title: `Level ${level}`, body: 'Your student legend grows. +¤10', icon: '★' })
    }
  },
  addCoins: (n) => set((s) => ({ coins: Math.max(0, s.coins + n) })),
  addItem: (id, n = 1) =>
    set((s) => ({ inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + n } })),
  removeItem: (id, n = 1) =>
    set((s) => {
      const inv = { ...s.inventory }
      inv[id] = (inv[id] ?? 0) - n
      if (inv[id] <= 0) delete inv[id]
      return { inventory: inv }
    }),
  pushToast: (t) => {
    const id = toastId++
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }))
    }, 4600)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  startDialogue: (d) => set({ dialogue: { ...d, index: 0, typing: true } }),
  advanceDialogue: () => {
    const d = get().dialogue
    if (!d) return
    if (d.index >= d.lines.length - 1) {
      set({ dialogue: null })
    } else {
      set({ dialogue: { ...d, index: d.index + 1, typing: true } })
    }
  },
  endDialogue: () => set({ dialogue: null }),
  setPrompt: (p) => {
    const cur = get().prompt
    if (cur?.id === p?.id) return
    set({ prompt: p })
  },
  unlockAchievement: (id, title, body) => {
    const s = get()
    if (s.achievements.includes(id)) return
    set({ achievements: [...s.achievements, id] })
    get().pushToast({ kind: 'achievement', title, body, icon: '🏆' })
  },
  reset: () => set({ ...initial, screen: 'title' }),
}))

export const ACHIEVEMENTS: Record<string, { title: string; body: string }> = {
  firstSteps: { title: 'First Steps', body: 'Stepped onto campus.' },
  social: { title: 'Social Butterfly', body: 'Talked to five people.' },
  caffeine: { title: 'Caffeine Dependent', body: 'Three coffees in one day.' },
  nightOwl: { title: 'Night Owl', body: 'Still awake at 2 AM.' },
  builder: { title: 'Campus Architect', body: 'Placed 20 blocks.' },
  explorer: { title: 'Cartographer', body: 'Visited every named zone.' },
  dean: { title: "Dean's List", body: 'Completed Freshers Week.' },
  reader: { title: 'Bookworm', body: 'Studied at every study spot.' },
  athlete: { title: 'Student Athlete', body: 'Scored on the pitch.' },
}
