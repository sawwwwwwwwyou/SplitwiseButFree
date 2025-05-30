"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import type { Trip, Expense } from "@/lib/types"

interface PayerSettlementGroup {
  payerId: string
  payerName: string
  totalToPay: number
  transactions: Array<{
    receiverId: string
    receiverName: string
    amount: number
  }>
}

export function useSettlementData(trip: Trip | null, expenses: Expense[], stableTripId: string | null) {
  const [balances, setBalances] = useState<{ [participantId: string]: number }>({})
  const [optimizedSettlements, setOptimizedSettlements] = useState<PayerSettlementGroup[]>([])
  const [detailedSettlements, setDetailedSettlements] = useState<PayerSettlementGroup[]>([])
  const [isLoadingDetailedSettlements, setIsLoadingDetailedSettlements] = useState(false)
  const [settlementViewMode, setSettlementViewMode] = useState<"optimized" | "detailed">("optimized")

  const participantMap = useMemo(() => {
    if (!trip) return {}
    return trip.participants.reduce(
      (acc, p) => {
        acc[p.id] = p.name
        return acc
      },
      {} as { [id: string]: string },
    )
  }, [trip])

  const calculateBalancesAndOptimizedSettlements = useCallback(async () => {
    if (!trip || !stableTripId) {
      setBalances({})
      setOptimizedSettlements([])
      return
    }

    const newBalances: { [participantId: string]: number } = {}
    trip.participants.forEach((participant) => (newBalances[participant.id] = 0))
    expenses.forEach((expense) => {
      Object.entries(expense.payers).forEach(([pId, amount]) => {
        if (newBalances.hasOwnProperty(pId)) newBalances[pId] += amount
      })
      Object.entries(expense.shares).forEach(([pId, share]) => {
        if (newBalances.hasOwnProperty(pId)) newBalances[pId] -= share
      })
    })
    setBalances(newBalances)

    try {
      const response = await fetch(`/api/trips/${stableTripId}/settlements`)
      if (!response.ok) throw new Error(`Failed to fetch settlements: ${response.status}`)
      const data = await response.json()
      setOptimizedSettlements(data as PayerSettlementGroup[])
    } catch (e: any) {
      console.error("Ошибка при загрузке оптимизированных расчетов:", e)
      setOptimizedSettlements([])
    }
  }, [trip, expenses, stableTripId])

  const fetchDetailedSettlementsData = useCallback(async () => {
    if (!stableTripId) return
    setIsLoadingDetailedSettlements(true)
    try {
      const response = await fetch(`/api/trips/${stableTripId}/detailed-settlements`)
      if (!response.ok) throw new Error(`Failed to fetch detailed settlements: ${response.status}`)
      const data = await response.json()
      setDetailedSettlements(data as PayerSettlementGroup[])
    } catch (e: any) {
      console.error("Ошибка при загрузке подробных расчетов:", e)
      setDetailedSettlements([])
    } finally {
      setIsLoadingDetailedSettlements(false)
    }
  }, [stableTripId])

  useEffect(() => {
    calculateBalancesAndOptimizedSettlements()
  }, [trip, expenses, calculateBalancesAndOptimizedSettlements])

  useEffect(() => {
    if (settlementViewMode === "detailed" && stableTripId && detailedSettlements.length === 0) {
      fetchDetailedSettlementsData()
    }
  }, [settlementViewMode, stableTripId, detailedSettlements.length, fetchDetailedSettlementsData])

  return {
    balances,
    optimizedSettlements,
    detailedSettlements,
    isLoadingDetailedSettlements,
    settlementViewMode,
    setSettlementViewMode,
    participantMap, // Expose for use in UI
  }
}
