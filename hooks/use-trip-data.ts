"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import type { Trip, Expense } from "@/lib/types"
import { isTripUnlocked as checkIsTripUnlocked } from "@/lib/pin-utils"

export function useTripData() {
  const params = useParams()
  const tripIdParam = params?.id

  const [stableTripId, setStableTripId] = useState<string | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(true)

  useEffect(() => {
    if (typeof tripIdParam === "string" && tripIdParam) {
      setStableTripId(tripIdParam)
      setError(null)
    } else {
      setStableTripId(null)
      if (tripIdParam !== undefined) {
        console.warn("Invalid trip ID in params:", tripIdParam)
        setError("Неверный ID поездки.")
      }
      setIsLoading(false)
    }
  }, [tripIdParam])

  const fetchExpensesData = useCallback(async (currentTripId: string) => {
    if (!currentTripId) return
    try {
      const response = await fetch(`/api/trips/${currentTripId}/expenses`)
      if (!response.ok) {
        throw new Error(`Failed to fetch expenses: ${response.status}`)
      }
      const data = await response.json()
      setExpenses(data)
    } catch (e: any) {
      console.error("Ошибка при загрузке расходов:", e)
      setExpenses([]) // Clear expenses on error
    }
  }, [])

  const fetchTripCoreData = useCallback(
    async (currentTripId: string) => {
      if (!currentTripId) return
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/trips/${currentTripId}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch trip: ${response.status}`)
        }
        const tripData = await response.json()
        setTrip(tripData)

        if (tripData.pinHash && checkIsTripUnlocked(currentTripId) === false) {
          setIsLocked(true)
          setExpenses([]) // Don't load expenses if locked
        } else {
          setIsLocked(false)
          await fetchExpensesData(currentTripId)
        }
      } catch (e: any) {
        console.error("Ошибка при загрузке поездки:", e)
        setError(e.message || "Не удалось загрузить данные поездки.")
        setTrip(null)
        setExpenses([])
      } finally {
        setIsLoading(false)
      }
    },
    [fetchExpensesData],
  )

  useEffect(() => {
    if (stableTripId) {
      fetchTripCoreData(stableTripId)
    } else {
      setTrip(null)
      setExpenses([])
      if (tripIdParam !== undefined) {
        // Only set loading to false if tripIdParam was processed
        setIsLoading(false)
      }
    }
  }, [stableTripId, fetchTripCoreData, tripIdParam])

  const handleUnlockSuccess = useCallback(() => {
    setIsLocked(false)
    if (stableTripId) {
      fetchExpensesData(stableTripId) // Fetch expenses after unlock
    }
  }, [stableTripId, fetchExpensesData])

  const refreshTripData = useCallback(() => {
    if (stableTripId) {
      fetchTripCoreData(stableTripId)
    }
  }, [stableTripId, fetchTripCoreData])

  const manuallySetExpenses = useCallback((newExpenses: Expense[]) => {
    setExpenses(newExpenses)
  }, [])

  return {
    stableTripId,
    trip,
    expenses,
    isLoading,
    error,
    isLocked,
    setIsLocked, // Allow parent to set lock state (e.g. after manual lock action)
    handleUnlockSuccess,
    refreshTripData,
    manuallySetExpenses, // For optimistic updates or direct manipulation
    setTrip, // Allow parent to update trip (e.g. after edit)
  }
}
