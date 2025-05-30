"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import type { Trip, Expense } from "@/lib/types"

type SplitMethod = "equally" | "exact" | "percentages"
type PayerSelectionStepMode = "checkbox" | "exact"

export function useExpenseDialog(
  trip: Trip | null,
  stableTripId: string | null,
  expenseToEdit: Expense | null, // Current expense being edited
  isOpen: boolean,
  onClose: () => void,
  onSaveSuccess: (savedExpense: Expense, isEdit: boolean) => void,
) {
  const [currentStep, setCurrentStep] = useState<"main" | "payerSelection" | "split-options">("main")
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")

  const [selectedPayers, setSelectedPayers] = useState<{ [participantId: string]: number }>({})
  const [selectedShares, setSelectedShares] = useState<{ [participantId: string]: number }>({})

  const [payerSelectionMode, setPayerSelectionMode] = useState<PayerSelectionStepMode>("checkbox")
  const [tempCheckboxPayers, setTempCheckboxPayers] = useState<{ [participantId: string]: boolean }>({})
  const [tempExactPayerAmounts, setTempExactPayerAmounts] = useState<{ [participantId: string]: string }>({})

  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equally")
  const [splitParticipants, setSplitParticipants] = useState<{ [participantId: string]: boolean }>({})
  const [exactAmounts, setExactAmounts] = useState<{ [participantId: string]: string }>({})
  const [percentages, setPercentages] = useState<{ [participantId: string]: string }>({})

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

  const resetForm = useCallback(() => {
    setExpenseDescription("")
    setExpenseAmount("")
    setSelectedPayers({})
    setSelectedShares({})
    setCurrentStep("main")
    setPayerSelectionMode("checkbox")
    setSplitMethod("equally")

    const initialCheckboxPayers: { [key: string]: boolean } = {}
    const initialSplitParticipants: { [key: string]: boolean } = {}
    ;(trip?.participants || []).forEach((p) => {
      initialCheckboxPayers[p.id] = false
      initialSplitParticipants[p.id] = true // Default to all selected for split
    })
    setTempCheckboxPayers(initialCheckboxPayers)
    setTempExactPayerAmounts({})
    setSplitParticipants(initialSplitParticipants)
    setExactAmounts({})
    setPercentages({})
  }, [trip])

  useEffect(() => {
    if (isOpen) {
      if (expenseToEdit) {
        // Initialize form for editing
        setExpenseDescription(expenseToEdit.description)
        setExpenseAmount(expenseToEdit.totalAmount.toFixed(2))
        setSelectedPayers(expenseToEdit.payers)
        setSelectedShares(expenseToEdit.shares)
        setCurrentStep("main")

        // Initialize payer selection step based on existing payers
        const totalExpenseAmountNum = expenseToEdit.totalAmount
        if (Object.keys(expenseToEdit.payers).length > 0 && totalExpenseAmountNum > 0 && trip) {
          const payerEntries = Object.entries(expenseToEdit.payers)
          const firstPayerAmount = payerEntries.length > 0 ? payerEntries[0][1] : 0
          const allPayersPaidEqually = payerEntries.every(([_, amount]) => Math.abs(amount - firstPayerAmount) < 0.01)
          const expectedEqualAmount = payerEntries.length > 0 ? totalExpenseAmountNum / payerEntries.length : 0

          if (
            allPayersPaidEqually &&
            Math.abs(firstPayerAmount - expectedEqualAmount) < 0.01 &&
            payerEntries.length > 0
          ) {
            setPayerSelectionMode("checkbox")
            const iCP: { [key: string]: boolean } = {}
            trip.participants.forEach((p) => (iCP[p.id] = !!expenseToEdit.payers[p.id]))
            setTempCheckboxPayers(iCP)
            setTempExactPayerAmounts({})
          } else {
            setPayerSelectionMode("exact")
            const iEA: { [key: string]: string } = {}
            trip.participants.forEach((p) => (iEA[p.id] = expenseToEdit.payers[p.id]?.toFixed(2) || ""))
            setTempExactPayerAmounts(iEA)
            setTempCheckboxPayers({})
          }
        } else if (trip) {
          // Default if no payers or zero amount
          setPayerSelectionMode("checkbox")
          const iCP: { [key: string]: boolean } = {}
          trip.participants.forEach((p) => (iCP[p.id] = false))
          setTempCheckboxPayers(iCP)
          setTempExactPayerAmounts({})
        }

        // Initialize split options based on existing shares
        const shares = expenseToEdit.shares
        const shareEntries = Object.entries(shares)
        const numSharers = shareEntries.length

        if (numSharers > 0) {
          const firstShareVal = shareEntries[0][1]
          const allSharesEqual = shareEntries.every(([_, val]) => Math.abs(val - firstShareVal) < 0.01)
          const expectedEqualShare = totalExpenseAmountNum / numSharers

          if (allSharesEqual && Math.abs(firstShareVal - expectedEqualShare) < 0.01) {
            setSplitMethod("equally")
            const sp: { [key: string]: boolean } = {}
            ;(trip?.participants || []).forEach((p) => (sp[p.id] = !!shares[p.id] && shares[p.id] > 0.001))
            setSplitParticipants(sp)
            setExactAmounts({})
            setPercentages({})
          } else {
            setSplitMethod("exact") // Default to exact if not perfectly equal
            const ex: { [key: string]: string } = {}
            shareEntries.forEach(([pId, val]) => {
              if (val > 0.001) ex[pId] = val.toFixed(2)
            })
            setExactAmounts(ex)
            const sp: { [key: string]: boolean } = {}
            ;(trip?.participants || []).forEach((p) => (sp[p.id] = !!shares[p.id] && shares[p.id] > 0.001))
            setSplitParticipants(sp)
            setPercentages({})
          }
        } else {
          // Default to equally among all if no shares
          setSplitMethod("equally")
          const sp: { [key: string]: boolean } = {}
          ;(trip?.participants || []).forEach((p) => (sp[p.id] = true))
          setSplitParticipants(sp)
          setExactAmounts({})
          setPercentages({})
        }
      } else {
        // Initialize form for adding
        resetForm()
      }
    }
  }, [isOpen, expenseToEdit, trip, resetForm])

  // Auto-update selectedPayers when expenseAmount changes (for single payer or default)
  useEffect(() => {
    if (!trip || trip.participants.length === 0 || currentStep !== "main") return

    const totalAmountNum = Number.parseFloat(expenseAmount) || 0

    setSelectedPayers((prevPayers) => {
      if (Object.keys(prevPayers).length === 0 && trip.participants.length > 0) {
        return { [trip.participants[0].id]: totalAmountNum }
      }
      if (Object.keys(prevPayers).length === 1) {
        const payerId = Object.keys(prevPayers)[0]
        if (trip.participants.some((p) => p.id === payerId) && prevPayers[payerId] !== totalAmountNum) {
          return { [payerId]: totalAmountNum }
        }
      }
      return prevPayers
    })
  }, [expenseAmount, trip, currentStep])

  // Auto-update selectedShares when expenseAmount or splitMethod/splitParticipants change
  useEffect(() => {
    if (!trip || trip.participants.length === 0 || currentStep !== "main") return

    const totalAmountNum = Number.parseFloat(expenseAmount) || 0

    if (splitMethod === "equally") {
      const activeSplitParticipantIds = Object.entries(splitParticipants)
        .filter(([_, isSelected]) => isSelected)
        .map(([id, _]) => id)

      const numSelectedToSplit = activeSplitParticipantIds.length
      const newSharesFromEffect: { [key: string]: number } = {}

      if (numSelectedToSplit > 0) {
        const sharePerPerson = totalAmountNum > 0 ? totalAmountNum / numSelectedToSplit : 0
        activeSplitParticipantIds.forEach((participantId) => {
          newSharesFromEffect[participantId] = sharePerPerson
        })
      }

      const finalNewShares: { [key: string]: number } = {}
      for (const pid in newSharesFromEffect) {
        if (newSharesFromEffect[pid] > 0.001) {
          finalNewShares[pid] = newSharesFromEffect[pid]
        }
      }

      // Only update if substantially different to avoid re-renders
      setSelectedShares((prevShares) => {
        const prevActiveShareKeys = Object.keys(prevShares).filter((k) => prevShares[k] > 0.001)
        const newActiveShareKeys = Object.keys(finalNewShares)

        if (prevActiveShareKeys.length !== newActiveShareKeys.length) return finalNewShares

        let changed = false
        for (const key of newActiveShareKeys) {
          if (!prevShares.hasOwnProperty(key) || Math.abs(prevShares[key] - finalNewShares[key]) > 0.01) {
            changed = true
            break
          }
        }
        if (!changed) {
          for (const key of prevActiveShareKeys) {
            if (!finalNewShares.hasOwnProperty(key)) {
              changed = true
              break
            }
          }
        }
        return changed ? finalNewShares : prevShares
      })
    }
  }, [expenseAmount, trip, splitMethod, splitParticipants, currentStep])

  const handleSaveExpense = async () => {
    if (!expenseDescription.trim() || !expenseAmount || !trip || !stableTripId) return
    const totalAmount = Number.parseFloat(expenseAmount)
    if (isNaN(totalAmount) || totalAmount <= 0) {
      alert("Сумма должна быть положительным числом.")
      return
    }
    if (Object.keys(selectedPayers).length === 0) {
      alert("Выберите, кто платил.")
      return
    }
    if (Object.keys(selectedShares).length === 0) {
      alert("Выберите, как разделить расход.")
      return
    }
    const sumOfPayers = Object.values(selectedPayers).reduce((s, a) => s + a, 0)
    if (Math.abs(sumOfPayers - totalAmount) > 0.01) {
      alert(
        `Сумма платежей (${sumOfPayers.toFixed(2)}) не совпадает с общей суммой расхода (${totalAmount.toFixed(2)}).`,
      )
      return
    }
    const sumOfShares = Object.values(selectedShares).reduce((s, a) => s + a, 0)
    if (Math.abs(sumOfShares - totalAmount) > 0.01) {
      alert(`Сумма долей (${sumOfShares.toFixed(2)}) не совпадает с общей суммой расхода (${totalAmount.toFixed(2)}).`)
      return
    }

    const expenseData = {
      description: expenseDescription,
      date: expenseToEdit?.date || new Date().toISOString().split("T")[0],
      totalAmount,
      payers: selectedPayers,
      shares: selectedShares,
    }

    try {
      const url = expenseToEdit
        ? `/api/trips/${stableTripId}/expenses/${expenseToEdit.id}`
        : `/api/trips/${stableTripId}/expenses`
      const method = expenseToEdit ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      })
      if (response.ok) {
        const savedOrUpdatedExpense = await response.json()
        onSaveSuccess(savedOrUpdatedExpense, !!expenseToEdit)
        onClose() // Close dialog after successful save
      } else {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || response.statusText)
      }
    } catch (e: any) {
      console.error("Ошибка при сохранении расхода:", e)
      alert(`Ошибка сохранения: ${e.message}`)
    }
  }

  const initializePayerSelectionStep = useCallback(() => {
    // This logic is now part of the useEffect that runs when `isOpen` and `expenseToEdit` change.
    // However, if user clicks "Оплатил" button again, we might want to re-evaluate.
    // For now, let's assume the useEffect handles initial setup.
    // If re-initialization is needed on button click, copy logic from useEffect here.
    const totalExpenseAmountNum = Number.parseFloat(expenseAmount) || 0
    if (Object.keys(selectedPayers).length > 0 && totalExpenseAmountNum > 0 && trip) {
      const payerEntries = Object.entries(selectedPayers)
      const firstPayerAmount = payerEntries.length > 0 ? payerEntries[0][1] : 0
      const allPayersPaidEqually = payerEntries.every(([_, amount]) => Math.abs(amount - firstPayerAmount) < 0.01)
      const expectedEqualAmount = payerEntries.length > 0 ? totalExpenseAmountNum / payerEntries.length : 0

      if (allPayersPaidEqually && Math.abs(firstPayerAmount - expectedEqualAmount) < 0.01 && payerEntries.length > 0) {
        setPayerSelectionMode("checkbox")
        const iCP: { [key: string]: boolean } = {}
        trip.participants.forEach((p) => (iCP[p.id] = !!selectedPayers[p.id]))
        setTempCheckboxPayers(iCP)
        setTempExactPayerAmounts({})
      } else {
        setPayerSelectionMode("exact")
        const iEA: { [key: string]: string } = {}
        trip.participants.forEach((p) => (iEA[p.id] = selectedPayers[p.id]?.toFixed(2) || ""))
        setTempExactPayerAmounts(iEA)
        setTempCheckboxPayers({})
      }
    } else if (trip) {
      setPayerSelectionMode("checkbox")
      const iCP: { [key: string]: boolean } = {}
      trip.participants.forEach((p) => (iCP[p.id] = false))
      setTempCheckboxPayers(iCP)
      setTempExactPayerAmounts({})
    }
    setCurrentStep("payerSelection")
  }, [expenseAmount, selectedPayers, trip])

  const handlePayerSelectionDone = () => {
    const totalExpenseAmount = Number.parseFloat(expenseAmount) || 0
    const newSelectedPayers: { [key: string]: number } = {}
    if (payerSelectionMode === "checkbox") {
      const checkedPayers = Object.keys(tempCheckboxPayers).filter((p) => tempCheckboxPayers[p])
      if (checkedPayers.length > 0 && totalExpenseAmount > 0) {
        const amountPerPayer = totalExpenseAmount / checkedPayers.length
        checkedPayers.forEach((p) => (newSelectedPayers[p] = amountPerPayer))
      } else if (checkedPayers.length > 0 && totalExpenseAmount === 0) {
        checkedPayers.forEach((p) => (newSelectedPayers[p] = 0))
      }
    } else {
      // exact mode
      let sumExactAmounts = 0
      Object.entries(tempExactPayerAmounts).forEach(([pId, amountStr]) => {
        const amountNum = Number.parseFloat(amountStr)
        if (!isNaN(amountNum) && amountNum > 0) {
          newSelectedPayers[pId] = amountNum
          sumExactAmounts += amountNum
        }
      })
      if (Math.abs(sumExactAmounts - totalExpenseAmount) > 0.01) {
        alert(
          `Сумма платежей (${sumExactAmounts.toFixed(2)}) не совпадает с общей суммой (${totalExpenseAmount.toFixed(2)}).`,
        )
        return
      }
    }
    setSelectedPayers(newSelectedPayers)
    setCurrentStep("main")
  }

  const openSplitOptions = useCallback(() => {
    // Initialize splitParticipants if empty
    if (Object.keys(splitParticipants).length === 0 && trip) {
      const initialSP: { [key: string]: boolean } = {}
      trip.participants.forEach((p) => (initialSP[p.id] = true)) // Default all selected
      setSplitParticipants(initialSP)
    }

    // Initialize exactAmounts or percentages based on current selectedShares and splitMethod
    if (splitMethod === "exact") {
      const currentExactAmounts: { [key: string]: string } = {}
      Object.entries(selectedShares).forEach(([pId, val]) => (currentExactAmounts[pId] = val.toFixed(2)))
      setExactAmounts(currentExactAmounts)
    } else if (splitMethod === "percentages") {
      const currentPercentages: { [key: string]: string } = {}
      const totalAmountNum = Number.parseFloat(expenseAmount) || 0
      if (totalAmountNum > 0) {
        Object.entries(selectedShares).forEach(
          ([pId, val]) => (currentPercentages[pId] = ((val / totalAmountNum) * 100).toFixed(1)),
        )
      }
      setPercentages(currentPercentages)
    }
    setCurrentStep("split-options")
  }, [trip, splitParticipants, splitMethod, selectedShares, expenseAmount])

  const applySplitOptions = () => {
    const totalAmountNum = Number.parseFloat(expenseAmount) || 0
    const newSelectedShares: { [key: string]: number } = {}

    if (splitMethod === "equally") {
      const participantsToSplit = Object.keys(splitParticipants).filter((p) => splitParticipants[p])
      if (participantsToSplit.length > 0) {
        const sharePerPerson = totalAmountNum / participantsToSplit.length
        participantsToSplit.forEach((p) => (newSelectedShares[p] = sharePerPerson))
      }
    } else if (splitMethod === "exact") {
      let sumExact = 0
      Object.entries(exactAmounts).forEach(([pId, amountStr]) => {
        const amountNum = Number.parseFloat(amountStr) || 0
        if (amountNum > 0) {
          newSelectedShares[pId] = amountNum
          sumExact += amountNum
        }
      })
      if (Math.abs(sumExact - totalAmountNum) > 0.01) {
        alert(`Сумма точных долей (${sumExact.toFixed(2)}) не совпадает с общей суммой (${totalAmountNum.toFixed(2)}).`)
        return
      }
    } else if (splitMethod === "percentages") {
      let sumPercentages = 0
      Object.entries(percentages).forEach(([pId, percentStr]) => {
        const percentNum = Number.parseFloat(percentStr) || 0
        if (percentNum > 0) {
          newSelectedShares[pId] = (totalAmountNum * percentNum) / 100
          sumPercentages += percentNum
        }
      })
      if (Math.abs(sumPercentages - 100) > 0.01) {
        alert(`Сумма процентов (${sumPercentages.toFixed(1)}%) не равна 100%.`)
        return
      }
    }
    setSelectedShares(newSelectedShares)
    setCurrentStep("main")
  }

  // Computed values and simple handlers
  const isDescriptionValid = useMemo(() => expenseDescription.trim().length > 0, [expenseDescription])
  const isAmountValid = useMemo(
    () => isDescriptionValid && expenseAmount.trim().length > 0 && Number.parseFloat(expenseAmount) > 0,
    [isDescriptionValid, expenseAmount],
  )
  const isPayerSelected = useMemo(
    () => isAmountValid && Object.keys(selectedPayers).length > 0,
    [isAmountValid, selectedPayers],
  )

  const canSave = useMemo(() => {
    const totalAmountNum = Number.parseFloat(expenseAmount)
    if (!expenseDescription.trim() || isNaN(totalAmountNum) || totalAmountNum <= 0) return false
    if (Object.keys(selectedPayers).length === 0 || Object.keys(selectedShares).length === 0) return false

    const sumPayers = Object.values(selectedPayers).reduce((s, v) => s + v, 0)
    if (Math.abs(sumPayers - totalAmountNum) > 0.01) return false

    const sumShares = Object.values(selectedShares).reduce((s, v) => s + v, 0)
    if (Math.abs(sumShares - totalAmountNum) > 0.01) return false

    return true
  }, [expenseDescription, expenseAmount, selectedPayers, selectedShares])

  const getPayerSummaryText = useCallback(() => {
    const payerIds = Object.keys(selectedPayers)
    if (payerIds.length === 0) return "Выберите участника"
    if (payerIds.length === 1) return participantMap[payerIds[0]] || "Неизвестный"

    const totalAmountNum = Number.parseFloat(expenseAmount) || 0
    if (totalAmountNum > 0 && payerIds.length > 0) {
      const firstPayerAmount = selectedPayers[payerIds[0]]
      const allPayEqually = payerIds.every((pId) => Math.abs(selectedPayers[pId] - firstPayerAmount) < 0.01)
      const expectedEqualAmount = totalAmountNum / payerIds.length
      if (allPayEqually && Math.abs(firstPayerAmount - expectedEqualAmount) < 0.01) {
        return `${payerIds.length} чел. (поровну)`
      }
    }
    return `${payerIds.length} чел. (точные суммы)`
  }, [selectedPayers, expenseAmount, participantMap])

  const getSplitSummaryText = useCallback(() => {
    const shareIds = Object.keys(selectedShares)
    if (shareIds.length === 0) return "На всех"

    const totalAmountNum = Number.parseFloat(expenseAmount) || 0
    if (totalAmountNum === 0 && shareIds.length > 0) return "Сумма 0" // Or specific text for zero amount

    const shareValues = Object.values(selectedShares)
    const firstShareValue = shareValues.length > 0 ? shareValues[0] : 0
    const allSharesEqual = shareValues.every((sVal) => Math.abs(sVal - firstShareValue) < 0.01)

    if (allSharesEqual && shareIds.length > 0 && Math.abs(firstShareValue - totalAmountNum / shareIds.length) < 0.01) {
      if (trip && shareIds.length === trip.participants.length) return "На всех"
      return `${shareIds.length} чел. (поровну)`
    }
    if (shareIds.length > 0) return `${shareIds.length} чел. (особые доли)`
    return "Выберите способ"
  }, [selectedShares, expenseAmount, trip])

  const toggleSplitParticipant = (participantId: string) =>
    setSplitParticipants((prev) => ({ ...prev, [participantId]: !prev[participantId] }))
  const getSelectedSplitCount = () => Object.values(splitParticipants).filter(Boolean).length
  const getAmountPerPersonForSplit = () => {
    const total = Number.parseFloat(expenseAmount) || 0
    const count = getSelectedSplitCount()
    return count > 0 ? total / count : 0
  }
  const updateExactAmountForSplit = (pId: string, amount: string) =>
    setExactAmounts((prev) => ({ ...prev, [pId]: amount }))
  const updatePercentageForSplit = (pId: string, pc: string) => setPercentages((prev) => ({ ...prev, [pId]: pc }))
  const getTotalExactAmountsForSplit = () =>
    Object.values(exactAmounts).reduce((s, a) => s + (Number.parseFloat(a) || 0), 0)
  const getTotalPercentagesForSplit = () =>
    Object.values(percentages).reduce((s, pc) => s + (Number.parseFloat(pc) || 0), 0)

  const canApplySplitOptions = useMemo(() => {
    const totalAmountNum = Number.parseFloat(expenseAmount) || 0
    if (splitMethod === "equally") return Object.values(splitParticipants).filter(Boolean).length > 0
    if (splitMethod === "exact") {
      return (
        Math.abs(Object.values(exactAmounts).reduce((s, a) => s + (Number.parseFloat(a) || 0), 0) - totalAmountNum) <
          0.01 && Object.values(exactAmounts).some((val) => Number.parseFloat(val) > 0)
      )
    }
    if (splitMethod === "percentages") {
      return (
        Math.abs(Object.values(percentages).reduce((s, pc) => s + (Number.parseFloat(pc) || 0), 0) - 100) < 0.01 &&
        Object.values(percentages).some((val) => Number.parseFloat(val) > 0)
      )
    }
    return false
  }, [splitMethod, expenseAmount, splitParticipants, exactAmounts, percentages])

  const areAllParticipantsSelectedForSplit = useMemo(
    () => trip && trip.participants.every((p) => splitParticipants[p.id]),
    [trip, splitParticipants],
  )
  const toggleAllParticipantsForSplit = () => {
    if (!trip) return
    const newAllSelectedState = !areAllParticipantsSelectedForSplit
    const newSplitParticipants: { [key: string]: boolean } = {}
    trip.participants.forEach((p) => (newSplitParticipants[p.id] = newAllSelectedState))
    setSplitParticipants(newSplitParticipants)
  }

  const totalTempExactPayerAmounts = Object.values(tempExactPayerAmounts).reduce(
    (s, a) => s + (Number.parseFloat(a) || 0),
    0,
  )
  const remainingTempExactPayerAmount = (Number.parseFloat(expenseAmount) || 0) - totalTempExactPayerAmounts

  return {
    // State
    currentStep,
    expenseDescription,
    expenseAmount,
    selectedPayers,
    selectedShares,
    payerSelectionMode,
    tempCheckboxPayers,
    tempExactPayerAmounts,
    splitMethod,
    splitParticipants,
    exactAmounts,
    percentages,
    // Setters & Handlers
    setCurrentStep,
    setExpenseDescription,
    setExpenseAmount,
    setPayerSelectionMode,
    setTempCheckboxPayers,
    setTempExactPayerAmounts,
    setSplitMethod,
    setSplitParticipants,
    setExactAmounts,
    setPercentages,
    handleSaveExpense,
    initializePayerSelectionStep,
    handlePayerSelectionDone,
    openSplitOptions,
    applySplitOptions,
    // Split option specific handlers
    toggleSplitParticipant,
    updateExactAmountForSplit,
    updatePercentageForSplit,
    toggleAllParticipantsForSplit,
    // Computed/derived values for UI
    isDescriptionValid,
    isAmountValid,
    isPayerSelected,
    canSave,
    canApplySplitOptions,
    getPayerSummaryText,
    getSplitSummaryText,
    getSelectedSplitCount,
    getAmountPerPersonForSplit,
    getTotalExactAmountsForSplit,
    getTotalPercentagesForSplit,
    areAllParticipantsSelectedForSplit,
    totalTempExactPayerAmounts,
    remainingTempExactPayerAmount,
    participantMap, // Expose participantMap for UI rendering within dialog
  }
}
