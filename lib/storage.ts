// Универсальное хранилище - работает локально и на продакшене
import type { Trip, Expense } from "./types"

// Проверяем доступность KV
const isKVAvailable = () => {
  return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
}

// Локальное хранилище (fallback)
let localTrips: Trip[] = [
  {
    id: "1",
    name: "Отпуск в Сочи",
    participants: ["Анна", "Борис", "Вера"],
    createdAt: new Date().toISOString(),
  },
]

const localExpenses: { [tripId: string]: Expense[] } = {
  "1": [
    {
      id: "1",
      description: "Ужин в ресторане",
      date: "2024-01-15",
      totalAmount: 150.0,
      payers: { Анна: 150.0 },
      shares: { Анна: 50.0, Борис: 50.0, Вера: 50.0 },
    },
    {
      id: "2",
      description: "Такси до отеля",
      date: "2024-01-15",
      totalAmount: 30.0,
      payers: { Борис: 30.0 },
      shares: { Анна: 10.0, Борис: 10.0, Вера: 10.0 },
    },
    {
      id: "3",
      description: "Продукты в магазине",
      date: "2024-01-16",
      totalAmount: 75.0,
      payers: { Вера: 75.0 },
      shares: { Анна: 25.0, Борис: 25.0, Вера: 25.0 },
    },
  ],
}

let nextTripId = 2
let nextExpenseId = 4

// KV функции (только если доступен)
async function getKV() {
  if (!isKVAvailable()) return null
  try {
    const { kv } = await import("@vercel/kv")
    return kv
  } catch {
    return null
  }
}

// Универсальные функции

export async function getTrips(): Promise<Trip[]> {
  const kv = await getKV()
  if (kv) {
    try {
      const trips = await kv.get<Trip[]>("trips")
      return trips || []
    } catch (error) {
      console.error("KV error, falling back to local storage:", error)
    }
  }
  return localTrips
}

export async function getTrip(id: string): Promise<Trip | null> {
  const trips = await getTrips()
  return trips.find((trip) => trip.id === id) || null
}

export async function createTrip(name: string, participants: string[]): Promise<Trip> {
  const kv = await getKV()
  const trips = await getTrips()

  let newId: string
  if (kv) {
    try {
      const counters = (await kv.get<{ tripId: number }>("counters")) || { tripId: 1 }
      newId = counters.tripId.toString()
      await kv.set("counters", { ...counters, tripId: counters.tripId + 1 })
    } catch {
      newId = nextTripId.toString()
      nextTripId++
    }
  } else {
    newId = nextTripId.toString()
    nextTripId++
  }

  const newTrip: Trip = {
    id: newId,
    name,
    participants,
    createdAt: new Date().toISOString(),
  }

  trips.push(newTrip)

  if (kv) {
    try {
      await kv.set("trips", trips)
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localTrips = trips
    }
  } else {
    localTrips = trips
  }

  return newTrip
}

export async function updateTrip(id: string, name: string, participants: string[]): Promise<Trip | null> {
  const kv = await getKV()
  const trips = await getTrips()
  const tripIndex = trips.findIndex((trip) => trip.id === id)

  if (tripIndex === -1) return null

  trips[tripIndex] = {
    ...trips[tripIndex],
    name,
    participants,
  }

  if (kv) {
    try {
      await kv.set("trips", trips)
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localTrips = trips
    }
  } else {
    localTrips = trips
  }

  return trips[tripIndex]
}

export async function deleteTrip(id: string): Promise<boolean> {
  const kv = await getKV()
  const trips = await getTrips()
  const filteredTrips = trips.filter((trip) => trip.id !== id)

  if (kv) {
    try {
      await Promise.all([kv.set("trips", filteredTrips), kv.del(`expenses:${id}`)])
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localTrips = filteredTrips
      delete localExpenses[id]
    }
  } else {
    localTrips = filteredTrips
    delete localExpenses[id]
  }

  return true
}

export async function getExpenses(tripId: string): Promise<Expense[]> {
  const kv = await getKV()
  if (kv) {
    try {
      const expenses = await kv.get<Expense[]>(`expenses:${tripId}`)
      return expenses || []
    } catch (error) {
      console.error("KV error, falling back to local storage:", error)
    }
  }
  return localExpenses[tripId] || []
}

export async function createExpense(
  tripId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participant: string]: number },
  shares: { [participant: string]: number },
): Promise<Expense> {
  const kv = await getKV()
  const expenses = await getExpenses(tripId)

  let newId: string
  if (kv) {
    try {
      const counters = (await kv.get<{ expenseId: number }>("counters")) || { expenseId: 1 }
      newId = counters.expenseId.toString()
      await kv.set("counters", { ...counters, expenseId: counters.expenseId + 1 })
    } catch {
      newId = nextExpenseId.toString()
      nextExpenseId++
    }
  } else {
    newId = nextExpenseId.toString()
    nextExpenseId++
  }

  const newExpense: Expense = {
    id: newId,
    description,
    date,
    totalAmount,
    payers,
    shares,
  }

  expenses.push(newExpense)

  if (kv) {
    try {
      await kv.set(`expenses:${tripId}`, expenses)
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localExpenses[tripId] = expenses
    }
  } else {
    localExpenses[tripId] = expenses
  }

  return newExpense
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participant: string]: number },
  shares: { [participant: string]: number },
): Promise<Expense | null> {
  const kv = await getKV()
  const expenses = await getExpenses(tripId)
  const expenseIndex = expenses.findIndex((expense) => expense.id === expenseId)

  if (expenseIndex === -1) return null

  expenses[expenseIndex] = {
    ...expenses[expenseIndex],
    description,
    date,
    totalAmount,
    payers,
    shares,
  }

  if (kv) {
    try {
      await kv.set(`expenses:${tripId}`, expenses)
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localExpenses[tripId] = expenses
    }
  } else {
    localExpenses[tripId] = expenses
  }

  return expenses[expenseIndex]
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<boolean> {
  console.log("Storage deleteExpense called with:", { tripId, expenseId })

  const kv = await getKV()
  const expenses = await getExpenses(tripId)

  console.log(
    "Current expenses before delete:",
    expenses.map((e) => ({ id: e.id, description: e.description })),
  )

  // ВАЖНО: Убедимся, что мы фильтруем правильно
  const filteredExpenses = expenses.filter((expense) => {
    const shouldKeep = expense.id !== expenseId
    console.log(`Expense ${expense.id} (${expense.description}): ${shouldKeep ? "KEEP" : "DELETE"}`)
    return shouldKeep
  })

  console.log(
    "Filtered expenses after delete:",
    filteredExpenses.map((e) => ({ id: e.id, description: e.description })),
  )

  if (kv) {
    try {
      await kv.set(`expenses:${tripId}`, filteredExpenses)
      console.log("Successfully saved to KV")
    } catch (error) {
      console.error("KV error, using local storage:", error)
      localExpenses[tripId] = filteredExpenses
    }
  } else {
    localExpenses[tripId] = filteredExpenses
    console.log("Saved to local storage")
  }

  return true
}

export async function addParticipant(tripId: string, name: string): Promise<boolean> {
  const trip = await getTrip(tripId)
  if (!trip) return false

  if (trip.participants.includes(name)) return false

  trip.participants.push(name)
  const updatedTrip = await updateTrip(tripId, trip.name, trip.participants)
  return !!updatedTrip
}
