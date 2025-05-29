// Универсальное хранилище - работает локально и на продакшене
import type { Trip, Expense, Participant } from "./types"

// Проверяем доступность KV
const isKVAvailable = () => {
  return process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
}

// Локальное хранилище (fallback)
// Initial participant data for local fallback
const localParticipantAnna: Participant = { id: crypto.randomUUID(), name: "Анна" }
const localParticipantBoris: Participant = { id: crypto.randomUUID(), name: "Борис" }
const localParticipantVera: Participant = { id: crypto.randomUUID(), name: "Вера" }

let localTrips: Trip[] = [
  {
    id: "1", // Keep initial trip ID for consistency if any tests rely on it
    name: "Отпуск в Сочи",
    participants: [localParticipantAnna, localParticipantBoris, localParticipantVera],
    createdAt: new Date().toISOString(),
  },
]

const localExpenses: { [tripId: string]: Expense[] } = {
  "1": [
    {
      id: "expense-1", // Keep initial expense IDs
      description: "Ужин в ресторане",
      date: "2024-01-15",
      totalAmount: 150.0,
      payers: { [localParticipantAnna.id]: 150.0 },
      shares: {
        [localParticipantAnna.id]: 50.0,
        [localParticipantBoris.id]: 50.0,
        [localParticipantVera.id]: 50.0,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "expense-2",
      description: "Такси до отеля",
      date: "2024-01-15",
      totalAmount: 30.0,
      payers: { [localParticipantBoris.id]: 30.0 },
      shares: {
        [localParticipantAnna.id]: 10.0,
        [localParticipantBoris.id]: 10.0,
        [localParticipantVera.id]: 10.0,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: "expense-3",
      description: "Продукты в магазине",
      date: "2024-01-16",
      totalAmount: 75.0,
      payers: { [localParticipantVera.id]: 75.0 },
      shares: {
        [localParticipantAnna.id]: 25.0,
        [localParticipantBoris.id]: 25.0,
        [localParticipantVera.id]: 25.0,
      },
      createdAt: new Date().toISOString(),
    },
  ],
}

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
      const trips = await kv.get<Trip[]>("trips_v2") // Use new key for new structure
      return trips || []
    } catch (error) {
      console.error("KV error getting trips, falling back to local storage:", error)
    }
  }
  return localTrips
}

export async function getTrip(id: string): Promise<Trip | null> {
  const trips = await getTrips()
  return trips.find((trip) => trip.id === id) || null
}

// Обновляем функцию createTrip, чтобы она принимала PIN-код
export async function createTrip(tripName: string, participantObjects: Participant[], pin?: string): Promise<Trip> {
  const kv = await getKV()
  const trips = await getTrips()

  const tripId = crypto.randomUUID()

  // Участники уже приходят с ID из фронтенда (если это новые участники, ID генерируются там)
  // или существующие ID, если это редактирование (хотя createTrip для новых поездок)
  // Убедимся, что все участники имеют ID
  const newParticipants: Participant[] = participantObjects.map((p) => ({
    id: p.id || crypto.randomUUID(), // Генерируем ID, если отсутствует (не должно быть для новых)
    name: p.name.trim(),
  }))

  const newTrip: Trip = {
    id: tripId,
    name: tripName,
    participants: newParticipants, // Используем напрямую participantObjects
    createdAt: new Date().toISOString(),
  }

  if (pin && pin.length > 0) {
    // Валидация PIN-кода (0 или 4 цифры) должна быть на клиенте или в API route
    // Здесь предполагаем, что PIN уже валиден или пуст
    const { hashPin } = await import("./pin-utils")
    newTrip.pinHash = await hashPin(pin, tripId)
  }

  const updatedTrips = [...trips, newTrip]

  if (kv) {
    try {
      await kv.set("trips_v2", updatedTrips)
    } catch (error) {
      console.error("KV error creating trip, using local storage:", error)
      localTrips = updatedTrips
    }
  } else {
    localTrips = updatedTrips
  }
  return newTrip
}

// Takes full Participant objects for update
export async function updateTrip(
  id: string,
  tripName: string,
  updatedParticipants: Participant[], // Уже Participant[]
): Promise<Trip | null> {
  const kv = await getKV()
  const trips = await getTrips()
  const tripIndex = trips.findIndex((trip) => trip.id === id)

  if (tripIndex === -1) return null

  // Ensure all updatedParticipants have IDs. If not, assign new ones (e.g. for newly added ones during edit)
  const processedParticipants = updatedParticipants.map((p) => ({
    id: p.id || crypto.randomUUID(), // Assign ID if missing (shouldn't happen if client sends full objects)
    name: p.name.trim(),
  }))

  trips[tripIndex] = {
    ...trips[tripIndex],
    name: tripName,
    participants: processedParticipants,
  }

  if (kv) {
    try {
      await kv.set("trips_v2", trips)
    } catch (error) {
      console.error("KV error updating trip, using local storage:", error)
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
      await Promise.all([kv.set("trips_v2", filteredTrips), kv.del(`expenses_v2:${id}`)])
    } catch (error) {
      console.error("KV error deleting trip, using local storage:", error)
      localTrips = filteredTrips
      delete localExpenses[id] // Assuming localExpenses keys might still be old trip IDs if not migrated
    }
  } else {
    localTrips = filteredTrips
    delete localExpenses[id] // Or use `expenses_v2:${id}` if localExpenses keys are also versioned
  }
  return true
}

export async function getExpenses(tripId: string): Promise<Expense[]> {
  const kv = await getKV()
  if (kv) {
    try {
      const expenses = await kv.get<Expense[]>(`expenses_v2:${tripId}`)
      return expenses || []
    } catch (error) {
      console.error("KV error getting expenses, falling back to local storage:", error)
    }
  }
  // Fallback to local, ensuring keys match (e.g. if localExpenses uses tripId '1')
  return localExpenses[tripId] || []
}

export async function createExpense(
  tripId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participantId: string]: number }, // Expecting IDs
  shares: { [participantId: string]: number }, // Expecting IDs
): Promise<Expense> {
  const kv = await getKV()
  const expenses = await getExpenses(tripId)

  const newExpense: Expense = {
    id: crypto.randomUUID(),
    description,
    date,
    totalAmount,
    payers,
    shares,
    createdAt: new Date().toISOString(),
  }

  const updatedExpenses = [...expenses, newExpense]

  if (kv) {
    try {
      await kv.set(`expenses_v2:${tripId}`, updatedExpenses)
    } catch (error) {
      console.error("KV error creating expense, using local storage:", error)
      localExpenses[tripId] = updatedExpenses
    }
  } else {
    localExpenses[tripId] = updatedExpenses
  }
  return newExpense
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participantId: string]: number }, // Expecting IDs
  shares: { [participantId: string]: number }, // Expecting IDs
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
      await kv.set(`expenses_v2:${tripId}`, expenses)
    } catch (error) {
      console.error("KV error updating expense, using local storage:", error)
      localExpenses[tripId] = expenses
    }
  } else {
    localExpenses[tripId] = expenses
  }
  return expenses[expenseIndex]
}

export async function deleteExpense(tripId: string, expenseId: string): Promise<boolean> {
  const kv = await getKV()
  const expenses = await getExpenses(tripId)
  const filteredExpenses = expenses.filter((expense) => expense.id !== expenseId)

  if (kv) {
    try {
      await kv.set(`expenses_v2:${tripId}`, filteredExpenses)
    } catch (error) {
      console.error("KV error deleting expense, using local storage:", error)
      localExpenses[tripId] = filteredExpenses
    }
  } else {
    localExpenses[tripId] = filteredExpenses
  }
  return true
}

// Adds a new participant (name) to a trip, generating an ID for them.
export async function addParticipant(tripId: string, participantName: string): Promise<boolean> {
  const trip = await getTrip(tripId)
  if (!trip) return false

  // Check if participant with this name already exists to avoid simple name duplicates
  // This is a soft check; ID is the true unique identifier.
  // The UI should ideally handle duplicate name warnings more robustly.
  if (trip.participants.some((p) => p.name === participantName.trim())) {
    return false
  }

  const newParticipant: Participant = {
    id: crypto.randomUUID(),
    name: participantName.trim(),
  }

  const updatedParticipants = [...trip.participants, newParticipant]
  const updatedTrip = await updateTrip(tripId, trip.name, updatedParticipants)

  return !!updatedTrip
}

// Function to update a participant's name
export async function updateParticipantNameInTrip(
  tripId: string,
  participantId: string,
  newName: string,
): Promise<boolean> {
  const trip = await getTrip(tripId)
  if (!trip) return false

  const participantIndex = trip.participants.findIndex((p) => p.id === participantId)
  if (participantIndex === -1) return false

  const updatedParticipants = [...trip.participants]
  updatedParticipants[participantIndex] = { ...updatedParticipants[participantIndex], name: newName.trim() }

  const success = await updateTrip(tripId, trip.name, updatedParticipants)
  return !!success
}

// Инициализация тестовых данных (только если база пустая)
export async function initializeTestData(): Promise<void> {
  try {
    const existingTrips = await getTrips()
    if (existingTrips.length > 0) return // Данные уже есть

    const kv = await getKV()

    // Создаем тестовую поездку
    const testTrip = await createTrip("Отпуск в Сочи", [
      localParticipantAnna,
      localParticipantBoris,
      localParticipantVera,
    ])

    // Добавляем тестовые расходы
    await createExpense(
      testTrip.id,
      "Ужин в ресторане",
      "2024-01-15",
      150.0,
      { [testTrip.participants[0].id]: 150.0 },
      { [testTrip.participants[0].id]: 50.0, [testTrip.participants[1].id]: 50.0, [testTrip.participants[2].id]: 50.0 },
    )

    await createExpense(
      testTrip.id,
      "Такси до отеля",
      "2024-01-15",
      30.0,
      { [testTrip.participants[1].id]: 30.0 },
      { [testTrip.participants[0].id]: 10.0, [testTrip.participants[1].id]: 10.0, [testTrip.participants[2].id]: 10.0 },
    )

    await createExpense(
      testTrip.id,
      "Продукты в магазине",
      "2024-01-16",
      75.0,
      { [testTrip.participants[2].id]: 75.0 },
      { [testTrip.participants[0].id]: 25.0, [testTrip.participants[1].id]: 25.0, [testTrip.participants[2].id]: 25.0 },
    )

    console.log("Test data initialized")
  } catch (error) {
    console.error("Error initializing test data:", error)
  }
}
