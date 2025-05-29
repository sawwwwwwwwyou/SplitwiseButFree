// Утилиты для работы с PIN-кодами

/**
 * Создает хеш PIN-кода с использованием Web Crypto API
 */
export async function hashPin(pin: string, tripId: string): Promise<string> {
  // Используем tripId как "соль" для дополнительной безопасности
  const data = new TextEncoder().encode(`${pin}-${tripId}`)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}

/**
 * Проверяет PIN-код, сравнивая его хеш с сохраненным
 */
export async function verifyPin(pin: string, tripId: string, storedHash: string): Promise<boolean> {
  const calculatedHash = await hashPin(pin, tripId)
  return calculatedHash === storedHash
}

/**
 * Сохраняет информацию о разблокированной поездке в localStorage
 */
export function saveUnlockedTrip(tripId: string): void {
  if (typeof window === "undefined") return

  try {
    const unlockedTrips = getUnlockedTrips()
    if (!unlockedTrips.includes(tripId)) {
      unlockedTrips.push(tripId)
      localStorage.setItem("unlockedTrips", JSON.stringify(unlockedTrips))
    }
  } catch (error) {
    console.error("Error saving unlocked trip to localStorage:", error)
  }
}

/**
 * Получает список разблокированных поездок из localStorage
 */
export function getUnlockedTrips(): string[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem("unlockedTrips")
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Error getting unlocked trips from localStorage:", error)
    return []
  }
}

/**
 * Проверяет, разблокирована ли поездка
 */
export function isTripUnlocked(tripId: string): boolean {
  return getUnlockedTrips().includes(tripId)
}

/**
 * Блокирует поездку (удаляет из списка разблокированных)
 */
export function lockTrip(tripId: string): void {
  if (typeof window === "undefined") return

  try {
    const unlockedTrips = getUnlockedTrips().filter((id) => id !== tripId)
    localStorage.setItem("unlockedTrips", JSON.stringify(unlockedTrips))
  } catch (error) {
    console.error("Error locking trip in localStorage:", error)
  }
}
