"use client"

import { useEffect, useRef, useState } from "react"

type Message = {
  role: "user" | "assistant"
  content: string
}

type Targets = {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export function CoachGeorgeLiveAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [profile, setProfile] = useState<any>({})
  const [targets, setTargets] = useState<Targets | null>(null)
  const [weight, setWeight] = useState<number | null>(null)
  const [pendingTargets, setPendingTargets] = useState<Targets | null>(null)
  const [pendingWeight, setPendingWeight] = useState<number | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)

  // scroll fix
  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight)
  }, [messages])

  // load memory
  useEffect(() => {
    const savedTargets = localStorage.getItem("george_targets")
    const savedWeight = localStorage.getItem("george_weight")

    if (savedTargets) setTargets(JSON.parse(savedTargets))
    if (savedWeight) setWeight(JSON.parse(savedWeight).currentWeight)
  }, [])

  function sendMessage(text: string) {
    const newMessages = [...messages, { role: "user", content: text }]
    setMessages(newMessages)

    handleLogic(text, newMessages)
  }

  function handleLogic(text: string, currentMessages: Message[]) {
    const lower = text.toLowerCase()

    // weight update
    const weightMatch = text.match(/(\d+)\s?(kg|st|lb)?/)
    if (lower.includes("weight") && weightMatch) {
      const w = parseInt(weightMatch[1])
      setPendingWeight(w)

      setMessages([
        ...currentMessages,
        {
          role: "assistant",
          content: `Got it — you’re now ${w}kg. Save this as your current weight?`,
        },
      ])
      return
    }

    // onboarding (very simplified for now)
    if (!profile.goal) {
      setProfile({ ...profile, goal: text })
      setMessages([
        ...currentMessages,
        { role: "assistant", content: "Got it. Are you male or female?" },
      ])
      return
    }

    if (!profile.sex) {
      setProfile({ ...profile, sex: text })
      setMessages([
        ...currentMessages,
        { role: "assistant", content: "How old are you?" },
      ])
      return
    }

    if (!profile.age) {
      setProfile({ ...profile, age: parseInt(text) })
      setMessages([
        ...currentMessages,
        { role: "assistant", content: "What’s your height (cm)?" },
      ])
      return
    }

    if (!profile.height) {
      setProfile({ ...profile, height: parseInt(text) })
      setMessages([
        ...currentMessages,
        { role: "assistant", content: "What’s your weight (kg)?" },
      ])
      return
    }

    if (!profile.weight) {
      const newProfile = { ...profile, weight: parseInt(text) }
      setProfile(newProfile)

      const calories = 2200
      const protein = 180
      const carbs = 200
      const fats = 70

      const t = { calories, protein, carbs, fats }
      setPendingTargets(t)

      setMessages([
        ...currentMessages,
        {
          role: "assistant",
          content: `Based on that, here are your targets:\nCalories: ${calories}\nProtein: ${protein}\nCarbs: ${carbs}\nFats: ${fats}`,
        },
      ])
      return
    }

    setMessages([
      ...currentMessages,
      { role: "assistant", content: "Tell me what you want help with." },
    ])
  }

  function saveTargets() {
    if (!pendingTargets) return
    localStorage.setItem("george_targets", JSON.stringify(pendingTargets))
    setTargets(pendingTargets)
    setPendingTargets(null)
  }

  function saveWeight() {
    if (!pendingWeight) return
    localStorage.setItem("george_weight", JSON.stringify({ currentWeight: pendingWeight }))
    setWeight(pendingWeight)
    setPendingWeight(null)
  }

  return (
    <div>
      {/* DISPLAY BOXES */}
      <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
        <div>Calories: {targets?.calories ?? "-"}</div>
        <div>Protein: {targets?.protein ?? "-"}</div>
        <div>Carbs: {targets?.carbs ?? "-"}</div>
        <div>Fats: {targets?.fats ?? "-"}</div>
        <div className="col-span-2">Weight: {weight ?? "-"}</div>
      </div>

      {/* CHAT */}
      <div
        ref={chatRef}
        className="h-[400px] overflow-y-auto bg-black/40 p-3 rounded mb-2"
      >
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>

      {/* BUTTONS */}
      {pendingTargets && (
        <button onClick={saveTargets} className="mr-2 bg-green-600 px-3 py-1 rounded">
          Save targets
        </button>
      )}

      {pendingWeight && (
        <button onClick={saveWeight} className="bg-blue-600 px-3 py-1 rounded">
          Save weight
        </button>
      )}

      {/* INPUT */}
      <div className="flex mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 text-black"
        />
        <button
          onClick={() => {
            sendMessage(input)
            setInput("")
          }}
          className="bg-white text-black px-3"
        >
          Send
        </button>
      </div>
    </div>
  )
}
