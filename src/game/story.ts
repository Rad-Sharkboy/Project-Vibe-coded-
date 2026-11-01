import { DialogueLine } from './store'

export type StoryStep = {
  id: string
  title: string
  desc: string
  hint: string
  trigger: string
  xp: number
  coins?: number
  gpa?: number
  where: string
}

export const STORY: StoryStep[] = [
  {
    id: 'wake',
    title: 'Roommate Roll Call',
    desc: 'You slept through three alarms. Juno is already dressed and judging you.',
    hint: 'Talk to Juno in your room (Halcyon 214)',
    trigger: 'talk:juno',
    xp: 30,
    where: 'Halcyon Hall',
  },
  {
    id: 'orientation',
    title: 'Orientation',
    desc: 'First-years are packed into Vox Hall. Somebody has to take the lectern.',
    hint: 'Take the lectern in Vox Hall (north of the Quad)',
    trigger: 'use:podium',
    xp: 60,
    coins: 8,
    where: 'Vox Hall',
  },
  {
    id: 'coffee',
    title: 'Caffeine Dependency',
    desc: 'One coffee is a coping mechanism. Two is a personality.',
    hint: 'Buy a coffee at The Grind (south of the Quad)',
    trigger: 'use:coffee',
    xp: 45,
    where: 'The Grind',
  },
  {
    id: 'card',
    title: 'The Archive Card',
    desc: 'You cannot check out books without a card. You cannot get a card without a book.',
    hint: 'Talk to Mira at The Archive checkout desk',
    trigger: 'talk:mira',
    xp: 50,
    coins: 5,
    where: 'The Archive',
  },
  {
    id: 'book',
    title: 'Misfiled',
    desc: 'Mira swears a first edition is glowing somewhere in the stacks. Glowing.',
    hint: 'Find the glowing book in the back of The Archive',
    trigger: 'collect:lostBook',
    xp: 55,
    where: 'The Archive',
  },
  {
    id: 'return',
    title: 'Overdue',
    desc: 'Return the book before the fine gets measured in semesters.',
    hint: 'Return the book to Mira',
    trigger: 'return:mira',
    xp: 80,
    coins: 10,
    where: 'The Archive',
  },
  {
    id: 'gym',
    title: 'Sweat Equity',
    desc: 'Coach Bianchi says the only thing students lift is their phones. Prove him wrong.',
    hint: 'Use the weight bench at Iron Lotus Rec Centre',
    trigger: 'use:gym',
    xp: 65,
    coins: 6,
    where: 'Iron Lotus',
  },
  {
    id: 'clubs',
    title: 'Club Rush',
    desc: 'Forty-seven clubs. Three of them are just people who like soup.',
    hint: 'Read the club notice board inside The Hive',
    trigger: 'use:notice',
    xp: 55,
    coins: 4,
    where: 'The Hive',
  },
  {
    id: 'dean',
    title: "Dean's Assembly",
    desc: 'Freshers Week ends with the Dean. Apparently you did more than most.',
    hint: 'Talk to Dean Okafor in The Hive',
    trigger: 'talk:dean',
    xp: 200,
    coins: 40,
    gpa: 4.0,
    where: 'The Hive',
  },
]

export const CHATTER: Record<string, string[][]> = {
  student1: [
    ['I have a 9am and a personality built entirely around avoiding it.'],
    ['Did you see the fountain? Somebody put a rubber duck in it. Legend.'],
  ],
  student2: [
    ['I joined the chess club for the biscuits. Stayed for the trauma.'],
    ['Have you tried the library fourth floor? It smells like ambition and dust.'],
  ],
  student3: [
    ['My timetable has a gap from 11 to 4. I call it "research".'],
    ['If you find my student card, it is probably in a vending machine.'],
  ],
  student4: [
    ['Group projects: where friendships go to be tested by PowerPoint.'],
    ['I have read the same paragraph nine times. It is winning.'],
  ],
  student5: [
    ['The coffee here could strip paint. I have three a day.'],
    ['Someone told me the pond has turtles. I choose to believe.'],
  ],
  student6: [
    ['I am not procrastinating. I am letting ideas marinate.'],
    ['The arcade machine in The Hive has my name on the high score. Twice.'],
  ],
  student7: [
    ['I came here to study astrophysics and I have mostly studied queues.'],
    ['Do you ever just sit on the bleachers and watch the clouds do nothing?'],
  ],
  student8: [
    ['I lost a bet and now I have to run the pitch in a dinosaur costume.'],
    ['Kick the ball. It is the only cardio I trust.'],
  ],
  student9: [
    ['The pond at night is genuinely the most peaceful place on campus.'],
    ['My flatmate labelled the milk. With a legal document.'],
  ],
  student10: [
    ['First week and I have already used the phrase "networking opportunity" twice.'],
    ['Bus should be here in ten minutes. It has said that for an hour.'],
  ],
  student11: [
    ['Every building is uphill. Every single one.'],
    ['I heard the Dean gives out free pizza on Fridays. Unverified.'],
  ],
  studentCafe: [
    ['The soup of the day is always "yesterday".'],
    ['Do not tell Ravi, but I would pay double for the cinnamon thing.'],
  ],
  studentGym: [
    ['Leg day is a lifestyle. Mine is mostly a rumour.'],
    ['Coach says pain is weakness leaving the body. Mine is on holiday.'],
  ],
  studentField: [
    ['I play midfield. Mostly I am a decorative feature.'],
    ['One day I will score from there. Today is not that day.'],
  ],
}

type Ctx = { step: number; hasBook: boolean; hasCard: boolean; talks: number }

const md = (name: string, role: string, color: string, lines: DialogueLine[]) => ({
  name,
  role,
  color,
  lines,
})

export function npcDialogue(npcId: string, name: string, role: string, ctx: Ctx) {
  const { step } = ctx
  switch (npcId) {
    case 'juno':
      if (step === 0)
        return md(name, role, '#f25f8c', [
          { text: '*Juno looks up from lacing her boots*' },
          { text: 'Oh good, you are alive. I was about to start charging rent to the corpse.' },
          { text: 'Orientation is in twenty minutes. Vox Hall, north side of the Quad. The big glass thing.' , emote: '🎓' },
          { text: 'Take the lectern. Everyone is too scared, so people will remember you. Trust me.' },
          { text: 'Also: drink some water. You are a person, not a houseplant.', emote: '💧' },
        ])
      if (step === 1)
        return md(name, role, '#f25f8c', [
          { text: 'You are still in here? Vox Hall! North! Follow the crowd with the lanyards!' },
        ])
      return md(name, role, '#f25f8c', [
        { text: 'Look at you, doing Freshers Week properly.' },
        { text: 'I have been researching the vending machine. The second one sells warm sandwiches and chaos.' },
        { text: 'Ping me if you end up at the pond. I am always up for pond.' },
      ])
    case 'vox':
      if (step <= 1)
        return md(name, role, '#7fb8ff', [
          { text: 'Ada Vox. I teach the module everybody fails once, then loves forever.' },
          { text: 'The lectern is yours, fresher. Say something. Anything. A fact about ducks works.' },
        ])
      return md(name, role, '#7fb8ff', [
        { text: 'Ah, my favourite fresher. You have that look — the look of someone who has discovered the coffee machine.' },
        { text: 'Assignment one is due at the end of the week. It is already too late, but attend the lectures anyway.' },
        { text: 'The library has a book on it. Probably. It may be glowing. Things get strange back there.' },
      ])
    case 'mira':
      if (step < 3)
        return md(name, role, '#63d3b0', [
          { text: 'Welcome to The Archive. Whisper, or do not — the acoustics are terrible anyway.' },
          { text: 'I am Mira. Come back when you need a library card... or a mystery solved.' },
        ])
      if (step === 3)
        return md(name, role, '#63d3b0', [
          { text: 'Mira. Reading Room RA, third year, keeper of the laminator.' },
          { text: 'Library card. Here. It is slightly warm and smells of laminate, which is the least glamorous superpower.' , emote: '🪪' },
          { text: 'Actually — while you are here. A first edition is missing. It is glowing, which is not normal.' },
          { text: 'Back stacks, east corner. Go be heroic. Quietly.', emote: '📚' },
        ])
      if (step === 4)
        return md(name, role, '#63d3b0', [
          { text: 'Still glowing somewhere in the back stacks. Look for the light. Follow the light. Politely.' },
        ])
      if (step === 5)
        return md(name, role, '#63d3b0', [
          { text: 'You found it! The "Campus Ghosts: A Field Guide". Of course it was glowing.' },
          { text: 'Fine waived. Card upgraded. You are now officially a Person The Library Trusts.' , emote: '✨' },
        ])
      return md(name, role, '#63d3b0', [
        { text: 'If you need a quiet table, the second floor is a cathedral of concentration.' },
        { text: 'People keep asking if we have a book on anything. We do. We have a book on everything.' },
      ])
    case 'nadia':
      return md(name, role, '#d9b04a', [
        { text: 'Nadia. Study group runs Tuesdays. We mostly complain, then somehow learn.' },
        { text: 'Join us at the long table. Bring snacks. No — bring better snacks.' },
      ])
    case 'ravi':
      if (step === 2)
        return md(name, role, '#c58a52', [
          { text: 'Ravi. I make the coffee and I keep the campus conscious.' },
          { text: 'First one is the hardest. After that it is a lifestyle, and I am your enabler.', emote: '☕' },
        ])
      return md(name, role, '#c58a52', [
        { text: 'Flat white? The machine is having a day. So am I.' },
        { text: 'Pro tip: coffee at 2am plus an essay equals either genius or a very expensive nap.' },
      ])
    case 'kai':
      return md(name, role, '#38c9a8', [
        { text: 'Kai. I hold every high score in The Hive. It is my entire personality and I am at peace with it.' },
        { text: 'Voxel Kart is on the left. I will not go easy. I will go annoyingly easy, then win anyway.' },
      ])
    case 'coach':
      if (step === 6)
        return md(name, role, '#e05a4a', [
          { text: 'Bianchi. Coach. I have seen you eye the weight bench like it owes you money.' },
          { text: 'Get on it. Three sets. Do not count out loud, that is a rookie tell.', emote: '🏋️' },
        ])
      return md(name, role, '#e05a4a', [
        { text: 'Hydrate. Stretch. Sleep. In that order, and not in a lecture hall.' },
        { text: 'The pitch is yours if the ball is still there. Marco keeps launching it into the hedge.' },
      ])
    case 'dean':
      if (step >= 8)
        return md(name, role, '#9c8ae0', [
          { text: 'Dean Okafor. You have done orientation, coffee, a library mystery, and the gym.' },
          { text: 'In one day. I have faculty who have not left their offices since Tuesday.' },
          { text: 'Freshers Week is officially survived. Your name is on the Dean\'s List, which is mostly symbolic,' },
          { text: 'and partly free pizza. Congratulations. Try to sleep occasionally.', emote: '🍕' },
        ])
      if (step >= 6)
        return md(name, role, '#9c8ae0', [
          { text: 'Nearly there. Finish the Freshers checklist and come find me.' },
          { text: 'The notice board in this very building counts. I am told the soup club is thriving.' },
        ])
      return md(name, role, '#9c8ae0', [
        { text: 'Dean Okafor. I mostly resolve disputes about laundry and ambition.' },
        { text: 'Complete your Freshers Week checklist and come back. I will pretend to be impressed.' },
      ])
  }
  const pool = CHATTER[npcId]
  if (pool) {
    const pick = pool[Math.floor(Math.random() * pool.length)]
    return md(name, role, '#8fb4ff', pick.map((t) => ({ text: t })))
  }
  return md(name, role, '#8fb4ff', [
    { text: 'Hey! Nice to meet you. Freshers Week is chaos, right?' },
    { text: 'I am supposed to be in a lecture. I am instead on a bench. Balance.' },
  ])
}

export const ITEMS: Record<string, { name: string; icon: string; desc: string }> = {
  coffee: { name: 'Flat White', icon: '☕', desc: 'Warm, bitter, structurally necessary.' },
  snack: { name: 'Vending Pastry', icon: '🥐', desc: 'Technically food. Emotionally, a decision.' },
  card: { name: 'Library Card', icon: '🪪', desc: 'Slightly warm. Smells of laminate.' },
  book: { name: 'Campus Ghosts: A Field Guide', icon: '📕', desc: 'A glowing first edition. Comfortably haunted.' },
  notes: { name: 'Lecture Notes', icon: '📝', desc: 'Legible for the first two pages only.' },
  pizza: { name: 'Dean\'s Pizza Slice', icon: '🍕', desc: 'Symbolic. Delicious. Free.' },
}
