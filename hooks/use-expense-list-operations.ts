"use client"

import { useState, useMemo, useCallback } from "react"
import type { Expense } from "@/lib/types"

export function useExpenseListOperations(
  expenses: Expense[],
  stableTripId: string | null,
  onExpenseDeleted: (expenseId: string) => void,
  onOpenEditExpense: (expense: Expense) => void,
) {
  const [isDeleteExpenseConfirmOpen, setIsDeleteExpenseConfirmOpen] = useState(false)
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null)

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime()
      if (dateComparison !== 0) return dateComparison
      return b.id.localeCompare(a.id) // Fallback sort by ID for stability
    })
  }, [expenses])

  const handleConfirmDeleteExpense = useCallback((id: string) => {
    setExpenseToDeleteId(id)
    setIsDeleteExpenseConfirmOpen(true)
  }, [])

  const handleDeleteExpenseFromList = async () => {
    if (!expenseToDeleteId || !stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}/expenses/${expenseToDeleteId}`, { method: "DELETE" })
      if (response.ok) {
        onExpenseDeleted(expenseToDeleteId)
        setIsDeleteExpenseConfirmOpen(false)
        setExpenseToDeleteId(null)
      } else {
        throw new Error("Failed to delete expense")
      }
    } catch (e) {
      console.error("Ошибка при удалении расхода:", e)
      alert("Ошибка удаления.")
    }
  }

  const handleOpenEditExpenseModal = useCallback(
    (expense: Expense) => {
      onOpenEditExpense(expense)
    },
    [onOpenEditExpense],
  )

  return {
    sortedExpenses,
    isDeleteExpenseConfirmOpen,
    setIsDeleteExpenseConfirmOpen,
    expenseToDeleteId,
    handleConfirmDeleteExpense,
    handleDeleteExpenseFromList,
    handleOpenEditExpenseModal,
  }
}
