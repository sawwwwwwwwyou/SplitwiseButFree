import { kv } from "@vercel/kv"

// Типы данных
export interface Trip {
  id: string
  name: string
  participants: string[]
  createdAt: string
}

export interface Expense {
  id: string
  description: string
  date: string
  totalAmount: number
  payers: { [participant: string]: number }
  shares: { [participant: string]: number }
}

// Ключи для хранения в KV
const TRIPS_KEY = "trips"
const EXPENSES_PREFIX = "expenses:"
const COUNTERS_KEY = "counters"

// Получить все поездки
export async function getTrips(): Promise<Trip[]> {
  try {
    const trips = await kv.get<Trip[]>(TRIPS_KEY)
    return trips || []
  } catch (error) {
    console.error("Error getting trips:", error)
    return []
  }
}

// Получить поездку по ID
export async function getTrip(id: string): Promise<Trip | null> {
  try {
    const trips = await getTrips()
    return trips.find((trip) => trip.id === id) || null
  } catch (error) {
    console.error("Error getting trip:", error)
    return null
  }
}

// Создать новую поездку
export async function createTrip(name: string, participants: string[]): Promise<Trip> {
  try {
    const trips = await getTrips()
    const counters = (await kv.get<{ tripId: number }>("counters")) || { tripId: 1 }

    const newTrip: Trip = {
      id: counters.tripId.toString(),
      name,
      participants,
      createdAt: new Date().toISOString(),
    }

    trips.push(newTrip)

    // Сохраняем поездки и обновляем счетчик
    await Promise.all([kv.set(TRIPS_KEY, trips), kv.set("counters", { ...counters, tripId: counters.tripId + 1 })])

    return newTrip
  } catch (error) {
    console.error("Error creating trip:", error)
    throw error
  }
}

// Обновить поездку
export async function updateTrip(id: string, name: string, participants: string[]): Promise<Trip | null> {
  try {
    const trips = await getTrips()
    const tripIndex = trips.findIndex((trip) => trip.id === id)

    if (tripIndex === -1) return null

    trips[tripIndex] = {
      ...trips[tripIndex],
      name,
      participants,
    }

    await kv.set(TRIPS_KEY, trips)
    return trips[tripIndex]
  } catch (error) {
    console.error("Error updating trip:", error)
    throw error
  }
}

// Удалить поездку
export async function deleteTrip(id: string): Promise<boolean> {
  try {
    const trips = await getTrips()
    const filteredTrips = trips.filter((trip) => trip.id !== id)

    // Удаляем поездку и все её расходы
    await Promise.all([kv.set(TRIPS_KEY, filteredTrips), kv.del(`${EXPENSES_PREFIX}${id}`)])

    return true
  } catch (error) {
    console.error("Error deleting trip:", error)
    return false
  }
}

// Получить расходы поездки
export async function getExpenses(tripId: string): Promise<Expense[]> {
  try {
    const expenses = await kv.get<Expense[]>(`${EXPENSES_PREFIX}${tripId}`)
    return expenses || []
  } catch (error) {
    console.error("Error getting expenses:", error)
    return []
  }
}

// Создать новый расход
export async function createExpense(
  tripId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participant: string]: number },
  shares: { [participant: string]: number },
): Promise<Expense> {
  try {
    const expenses = await getExpenses(tripId)
    const counters = (await kv.get<{ expenseId: number }>("counters")) || { expenseId: 1 }

    const newExpense: Expense = {
      id: counters.expenseId.toString(),
      description,
      date,
      totalAmount,
      payers,
      shares,
    }

    expenses.push(newExpense)

    // Сохраняем расходы и обновляем счетчик
    await Promise.all([
      kv.set(`${EXPENSES_PREFIX}${tripId}`, expenses),
      kv.set("counters", { ...counters, expenseId: counters.expenseId + 1 }),
    ])

    return newExpense
  } catch (error) {
    console.error("Error creating expense:", error)
    throw error
  }
}

// Обновить расход
export async function updateExpense(
  tripId: string,
  expenseId: string,
  description: string,
  date: string,
  totalAmount: number,
  payers: { [participant: string]: number },
  shares: { [participant: string]: number },
): Promise<Expense | null> {
  try {
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

    await kv.set(`${EXPENSES_PREFIX}${tripId}`, expenses)
    return expenses[expenseIndex]
  } catch (error) {
    console.error("Error updating expense:", error)
    throw error
  }
}

// Удалить расход
export async function deleteExpense(tripId: string, expenseId: string): Promise<boolean> {
  try {
    const expenses = await getExpenses(tripId)
    const filteredExpenses = expenses.filter((expense) => expense.id !== expenseId)

    await kv.set(`${EXPENSES_PREFIX}${tripId}`, filteredExpenses)
    return true
  } catch (error) {
    console.error("Error deleting expense:", error)
    return false
  }
}

// Добавить участника к поездке
export async function addParticipant(tripId: string, name: string): Promise<boolean> {
  try {
    const trip = await getTrip(tripId)
    if (!trip) return false

    if (trip.participants.includes(name)) return false

    trip.participants.push(name)
    await updateTrip(tripId, trip.name, trip.participants)
    return true
  } catch (error) {
    console.error("Error adding participant:", error)
    return false
  }
}

// Инициализация тестовых данных (только если база пустая)
export async function initializeTestData(): Promise<void> {
  try {
    const existingTrips = await getTrips()
    if (existingTrips.length > 0) return // Данные уже есть

    // Создаем тестовую поездку
    const testTrip = await createTrip("Отпуск в Сочи", ["Анна", "Борис", "Вера"])

    // Добавляем тестовые расходы
    await createExpense(
      testTrip.id,
      "Ужин в ресторане",
      "2024-01-15",
      150.0,
      { Анна: 150.0 },
      { Анна: 50.0, Борис: 50.0, Вера: 50.0 },
    )

    await createExpense(
      testTrip.id,
      "Такси до отеля",
      "2024-01-15",
      30.0,
      { Борис: 30.0 },
      { Анна: 10.0, Борис: 10.0, Вера: 10.0 },
    )

    await createExpense(
      testTrip.id,
      "Продукты в магазине",
      "2024-01-16",
      75.0,
      { Вера: 75.0 },
      { Анна: 25.0, Борис: 25.0, Вера: 25.0 },
    )

    console.log("Test data initialized")
  } catch (error) {
    console.error("Error initializing test data:", error)
  }
}
