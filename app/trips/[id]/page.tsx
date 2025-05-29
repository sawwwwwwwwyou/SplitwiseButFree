"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ArrowLeft,
  Plus,
  Users,
  DollarSign,
  Calculator,
  Edit,
  Trash2,
  X,
  UserCheck,
  Lock,
  ArrowRight,
} from "lucide-react" // Added ArrowRight
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { Participant as ParticipantType } from "@/lib/types"
import { PinLockScreen } from "@/components/pin-lock-screen"
import { isTripUnlocked, lockTrip } from "@/lib/pin-utils"

interface Trip {
  id: string
  name: string
  participants: ParticipantType[]
  createdAt: string
  pinHash?: string
}

interface Expense {
  id: string
  description: string
  date: string
  totalAmount: number
  payers: { [participantId: string]: number }
  shares: { [participantId: string]: number }
  createdAt?: string
}

// Updated interface to reflect grouping by payer
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

type SplitMethod = "equally" | "exact" | "percentages"
type PayerSelectionStepMode = "checkbox" | "exact"

interface EditParticipant {
  id: string
  name: string
  isNew?: boolean
}

export default function TripPage() {
  const params = useParams()
  const router = useRouter()

  const [stableTripId, setStableTripId] = useState<string | null>(null)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<PayerSettlementGroup[]>([]) // Changed type
  const [balances, setBalances] = useState<{ [participant: string]: number }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [settlementViewMode, setSettlementViewMode] = useState<"optimized" | "detailed">("optimized");
  const [detailedSettlementsData, setDetailedSettlementsData] = useState<PayerSettlementGroup[]>([]); // Changed type
  const [isLoadingDetailedSettlements, setIsLoadingDetailedSettlements] = useState(false);

  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false)
  const [isEditTripOpen, setIsEditTripOpen] = useState(false)

  const [editTripName, setEditTripName] = useState("")
  const [editParticipants, setEditParticipants] = useState<EditParticipant[]>([])

  const [currentStep, setCurrentStep] = useState<"main" | "payerSelection" | "split-options">("main")
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [selectedPayers, setSelectedPayers] = useState<{ [participant: string]: number }>({})
  const [selectedShares, setSelectedShares] = useState<{ [participant: string]: number }>({})

  const [payerSelectionMode, setPayerSelectionMode] = useState<PayerSelectionStepMode>("checkbox")
  const [tempCheckboxPayers, setTempCheckboxPayers] = useState<{ [participant: string]: boolean }>({})
  const [tempExactPayerAmounts, setTempExactPayerAmounts] = useState<{ [participant: string]: string }>({})

  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equally")
  const [splitParticipants, setSplitParticipants] = useState<{ [participant: string]: boolean }>({})
  const [exactAmounts, setExactAmounts] = useState<{ [participant: string]: string }>({})
  const [percentages, setPercentages] = useState<{ [participant: string]: string }>({})

  const [newParticipantName, setNewParticipantName] = useState("")

  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [isDeleteExpenseConfirmOpen, setIsDeleteExpenseConfirmOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)

  const [isDeleteTripConfirmOpen, setIsDeleteTripConfirmOpen] = useState(false)
  const [isLocked, setIsLocked] = useState(true)

  useEffect(() => {
    if (settlementViewMode === "detailed" && stableTripId && detailedSettlementsData.length === 0) {
      const fetchDetailedSettlements = async () => {
        setIsLoadingDetailedSettlements(true);
        try {
          const response = await fetch(`/api/trips/${stableTripId}/detailed-settlements`);
          if (!response.ok) {
            throw new Error(`Failed to fetch detailed settlements: ${response.status}`);
          }
          const data = await response.json();
          setDetailedSettlementsData(data as PayerSettlementGroup[]);
        } catch (e: any) {
          console.error("Ошибка при загрузке подробных расчетов:", e);
          setDetailedSettlementsData([]); // Clear on error
        } finally {
          setIsLoadingDetailedSettlements(false);
        }
      };
      fetchDetailedSettlements();
    }
  }, [settlementViewMode, stableTripId, detailedSettlementsData.length]);

  useEffect(() => {
    const idFromParams = params?.id
    if (typeof idFromParams === "string" && idFromParams) {
      setStableTripId(idFromParams)
      setError(null)
    } else {
      setStableTripId(null)
      if (idFromParams !== undefined) {
        console.warn("Invalid trip ID in params:", idFromParams)
        setError("Неверный ID поездки.")
      }
      setIsLoading(false)
    }
  }, [params?.id])

  useEffect(() => {
    if (!stableTripId) {
      setTrip(null)
      setExpenses([])
      setSettlements([])
      setBalances({})
      if (params?.id !== undefined) {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(true)
    setError(null)
    let isMounted = true

    const fetchTripData = async () => {
      try {
        const response = await fetch(`/api/trips/${stableTripId}`)
        if (!isMounted) return
        if (!response.ok) {
          throw new Error(`Failed to fetch trip: ${response.status}`)
        }
        const data = await response.json()
        setTrip(data)

        if (data.pinHash && !isTripUnlocked(stableTripId)) {
          setIsLocked(true)
        } else {
          setIsLocked(false)
          fetchExpensesData()
        }
      } catch (e: any) {
        console.error("Ошибка при загрузке поездки:", e)
        setError(e.message || "Не удалось загрузить данные поездки.")
        setTrip(null)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    const fetchExpensesData = async () => {
      try {
        const response = await fetch(`/api/trips/${stableTripId}/expenses`)
        if (!isMounted) return
        if (!response.ok) {
          throw new Error(`Failed to fetch expenses: ${response.status}`)
        }
        const data = await response.json()
        setExpenses(data)
      } catch (e: any) {
        console.error("Ошибка при загрузке расходов:", e)
        setExpenses([])
      }
    }

    fetchTripData()

    return () => {
      isMounted = false
    }
  }, [stableTripId])

  const handleUnlock = () => {
    setIsLocked(false)
    if (stableTripId) {
      fetch(`/api/trips/${stableTripId}/expenses`)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to fetch expenses: ${response.status}`)
          return response.json()
        })
        .then((data) => {
          setExpenses(data)
          return fetch(`/api/trips/${stableTripId}/settlements`)
        })
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to fetch settlements: ${response.status}`)
          return response.json()
        })
        .then((data) => {
          setSettlements(data)
          calculateBalances()
        })
        .catch((error) => {
          console.error("Ошибка при загрузке данных после разблокировки:", error)
        })
    }
  }

  useEffect(() => {
    if (trip && stableTripId) {
      calculateBalances()
      const fetchSettlementsData = async () => {
        try {
          const response = await fetch(`/api/trips/${stableTripId}/settlements`)
          if (!response.ok) {
            throw new Error(`Failed to fetch settlements: ${response.status}`)
          }
          const data = await response.json()
          setSettlements(data)
        } catch (e: any) {
          console.error("Ошибка при загрузке расчетов:", e)
          setSettlements([])
        }
      }
      fetchSettlementsData()
    } else if (!trip) {
      setBalances({})
      setSettlements([])
    }
  }, [trip, expenses, stableTripId])

  const calculateBalances = () => {
    if (!trip) return
    const newBalances: { [participant: string]: number } = {}
    trip.participants.forEach((participant) => (newBalances[participant.id] = 0))
    expenses.forEach((expense) => {
      Object.entries(expense.payers).forEach(([p, amount]) => {
        if (newBalances.hasOwnProperty(p)) newBalances[p] += amount
      })
      Object.entries(expense.shares).forEach(([p, share]) => {
        if (newBalances.hasOwnProperty(p)) newBalances[p] -= share
      })
    })
    setBalances(newBalances)
  }

  const openEditTrip = () => {
    if (!trip) return
    setEditTripName(trip.name)
    setEditParticipants(trip.participants.map((p) => ({ id: p.id, name: p.name })))
    setIsEditTripOpen(true)
  }

  const addEditParticipant = () =>
    setEditParticipants((prev) => [...prev, { id: crypto.randomUUID(), name: "", isNew: true }])
  const removeEditParticipant = (id: string) => {
    if (editParticipants.length > 1) setEditParticipants((prev) => prev.filter((p) => p.id !== id))
  }
  const updateEditParticipantName = (id: string, name: string) =>
    setEditParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))

  const saveEditTrip = async () => {
    if (!editTripName.trim() || !trip || !stableTripId) return
    const processedParticipants = editParticipants.map((p) => ({
      id: p.id,
      name: p.name.trim(),
    }))
    try {
      const response = await fetch(`/api/trips/${stableTripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTripName, participants: processedParticipants }),
      })
      if (response.ok) {
        setIsEditTripOpen(false)
        const currentId = stableTripId
        setStableTripId(null)
        setTimeout(() => setStableTripId(currentId), 0)
      } else {
        throw new Error("Failed to update trip")
      }
    } catch (e) {
      console.error("Ошибка при обновлении поездки:", e)
      alert("Ошибка обновления.")
    }
  }

  const addParticipantToTrip = async () => {
    if (!newParticipantName.trim() || !stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newParticipantName.trim() }),
      })
      if (response.ok) {
        setNewParticipantName("")
        setIsAddParticipantOpen(false)
        const currentId = stableTripId
        setStableTripId(null)
        setTimeout(() => setStableTripId(currentId), 0)
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Ошибка добавления участника: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error("Ошибка при добавлении участника:", error)
      alert("Произошла ошибка при добавлении участника.")
    }
  }

  const resetExpenseForm = (isEditing = false) => {
    if (!isEditing) {
      setExpenseDescription("")
      setExpenseAmount("")
      setSelectedPayers({})
      setSelectedShares({})
      setSelectedExpense(null)
    }
    setPayerSelectionMode("checkbox")
    const initialCheckboxPayers: { [key: string]: boolean } = {}
    ;(trip?.participants || []).forEach((p) => (initialCheckboxPayers[p.id] = false))
    setTempCheckboxPayers(initialCheckboxPayers)
    setTempExactPayerAmounts({})
    setSplitMethod("equally")
    const initialSplitParticipants: { [key: string]: boolean } = {}
    ;(trip?.participants || []).forEach((p) => (initialSplitParticipants[p.id] = true))
    setSplitParticipants(initialSplitParticipants)
    setExactAmounts({})
    setPercentages({})
    setCurrentStep("main")

    if (!isEditing && trip && trip.participants.length > 0) {
      const firstParticipantId = trip.participants[0].id
      const totalAmountNum = Number.parseFloat(expenseAmount) || 0

      setSelectedPayers({ [firstParticipantId]: totalAmountNum })

      const numParticipants = trip.participants.length
      if (numParticipants > 0) {
        const sharePerPerson = totalAmountNum > 0 ? totalAmountNum / numParticipants : 0
        const defaultShares: { [key: string]: number } = {}
        trip.participants.forEach((p) => (defaultShares[p.id] = sharePerPerson))
        setSelectedShares(defaultShares)
      }
    }
  }

  const openAddExpense = () => {
    resetExpenseForm()
    setIsAddExpenseOpen(true)
  }

  const saveExpense = async () => {
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
      date: selectedExpense?.date || new Date().toISOString().split("T")[0],
      totalAmount,
      payers: selectedPayers,
      shares: selectedShares,
    }
    try {
      const url = selectedExpense
        ? `/api/trips/${stableTripId}/expenses/${selectedExpense.id}`
        : `/api/trips/${stableTripId}/expenses`
      const method = selectedExpense ? "PUT" : "POST"
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expenseData),
      })
      if (response.ok) {
        const savedOrUpdatedExpense = await response.json()
        setExpenses((prevExpenses) => {
          if (selectedExpense) {
            return prevExpenses.map((exp) => (exp.id === savedOrUpdatedExpense.id ? savedOrUpdatedExpense : exp))
          } else {
            return [...prevExpenses, savedOrUpdatedExpense]
          }
        })
        resetExpenseForm()
        setIsAddExpenseOpen(false)
        setSelectedExpense(null)
      } else {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || response.statusText)
      }
    } catch (e: any) {
      console.error("Ошибка при сохранении расхода:", e)
      alert(`Ошибка сохранения: ${e.message}`)
    }
  }

  const initializePayerSelectionStep = () => {
    const totalExpenseAmount = Number.parseFloat(expenseAmount) || 0
    if (Object.keys(selectedPayers).length > 0 && totalExpenseAmount > 0 && trip) {
      const payerEntries = Object.entries(selectedPayers)
      const firstPayerAmount = payerEntries.length > 0 ? payerEntries[0][1] : 0
      const allPayersPaidEqually = payerEntries.every(([_, amount]) => Math.abs(amount - firstPayerAmount) < 0.01)
      const expectedEqualAmount = payerEntries.length > 0 ? totalExpenseAmount / payerEntries.length : 0
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
  }

  const handlePayerSelectionDone = () => {
    const totalExpenseAmount = Number.parseFloat(expenseAmount) || 0
    const newSP: { [key: string]: number } = {}
    if (payerSelectionMode === "checkbox") {
      const checkedP = Object.keys(tempCheckboxPayers).filter((p) => tempCheckboxPayers[p])
      if (checkedP.length > 0 && totalExpenseAmount > 0) {
        const amtPP = totalExpenseAmount / checkedP.length
        checkedP.forEach((p) => (newSP[p] = amtPP))
      } else if (checkedP.length > 0 && totalExpenseAmount === 0) {
        checkedP.forEach((p) => (newSP[p] = 0))
      }
    } else {
      let sumExact = 0
      Object.entries(tempExactPayerAmounts).forEach(([p, valStr]) => {
        const valNum = Number.parseFloat(valStr)
        if (!isNaN(valNum) && valNum > 0) {
          newSP[p] = valNum
          sumExact += valNum
        }
      })
      if (Math.abs(sumExact - totalExpenseAmount) > 0.01) {
        alert(`Сумма платежей (${sumExact.toFixed(2)}) не совпадает с общей суммой (${totalExpenseAmount.toFixed(2)}).`)
        return
      }
    }
    setSelectedPayers(newSP)
    setCurrentStep("main")
  }

  const participantIdToNameMap = useMemo(() => {
    if (!trip) return {}
    return trip.participants.reduce(
      (acc, p) => {
        acc[p.id] = p.name
        return acc
      },
      {} as { [id: string]: string },
    )
  }, [trip])

  const getPayerSummaryText = () => {
    const pN = Object.keys(selectedPayers)
    if (pN.length === 0) return "Выберите участника"
    if (pN.length === 1) return truncateName(participantIdToNameMap[pN[0]])
    const tA = Number.parseFloat(expenseAmount) || 0
    if (tA > 0 && pN.length > 0) {
      const fPA = selectedPayers[pN[0]]
      const allEq = pN.every((p) => Math.abs(selectedPayers[p] - fPA) < 0.01)
      const expEqAmt = tA / pN.length
      if (allEq && Math.abs(fPA - expEqAmt) < 0.01) return `${pN.length} чел. (поровну)`
    }
    return `${pN.length} чел. (точные суммы)`
  }

  const truncateName = (name: string, maxLength = 7) =>
    name.length <= maxLength ? name : name.substring(0, maxLength - 1) + "..."
  const getExpenseIcon = (description: string) => {
    const desc = description.toLowerCase().trim()
    if (
      desc.includes("такси") ||
      desc.includes("taxi") ||
      desc.includes("трансфер") ||
      desc.includes("убер") ||
      desc.includes("uber") ||
      desc.includes("яндекс") ||
      desc.includes("автобус") ||
      desc.includes("метро") ||
      desc.includes("поезд")
    )
      return { icon: "🚗", color: "bg-blue-100", iconColor: "text-blue-600" }
    if (
      desc.includes("ресторан") ||
      desc.includes("еда") ||
      desc.includes("мак") ||
      desc.includes("макдак") ||
      desc.includes("макдоналдс") ||
      desc.includes("старбакс") ||
      desc.includes("кофе") ||
      desc.includes("магаз") ||
      desc.includes("супермаркет") ||
      desc.includes("доставка") ||
      desc.includes("пицца") ||
      desc.includes("бургер") ||
      desc.includes("кафе") ||
      desc.includes("обед") ||
      desc.includes("ужин") ||
      desc.includes("завтрак") ||
      desc.includes("продукты") ||
      desc.includes("grocery")
    )
      return { icon: "🍓", color: "bg-red-100", iconColor: "text-red-600" }
    if (
      desc.includes("бензин") ||
      desc.includes("бенз") ||
      desc.includes("заправка") ||
      desc.includes("топливо") ||
      desc.includes("газ") ||
      desc.includes("fuel") ||
      desc.includes("gas")
    )
      return { icon: "⛽", color: "bg-green-100", iconColor: "text-green-600" }
    if (
      desc.includes("доллар") ||
      desc.includes("dollar") ||
      desc.includes("деньги") ||
      desc.includes("money") ||
      desc.includes("банк") ||
      desc.includes("bank") ||
      desc.includes("обмен") ||
      desc.includes("валют")
    )
      return { icon: "💵", color: "bg-green-800", iconColor: "text-green-100" }
    if (
      desc.includes("билет") ||
      desc.includes("самолет") ||
      desc.includes("авиа") ||
      desc.includes("flight") ||
      desc.includes("plane") ||
      desc.includes("airport") ||
      desc.includes("аэропорт") ||
      desc.includes("перелет")
    )
      return { icon: "✈️", color: "bg-sky-100", iconColor: "text-sky-600" }
    if (
      desc.includes("парк") ||
      desc.includes("пропуск") ||
      desc.includes("кемпинг") ||
      desc.includes("палатк") ||
      desc.includes("camping") ||
      desc.includes("tent") ||
      desc.includes("отдых") ||
      desc.includes("природа") ||
      desc.includes("поход")
    )
      return { icon: "🏕️", color: "bg-emerald-100", iconColor: "text-emerald-600" }
    if (
      desc.includes("home") ||
      desc.includes("airbnb") ||
      desc.includes("hotel") ||
      desc.includes("отель") ||
      desc.includes("гостиница") ||
      desc.includes("квартира") ||
      desc.includes("жилье")
    )
      return { icon: "🏠", color: "bg-indigo-100", iconColor: "text-indigo-600" }
    if (
      desc.includes("ring") ||
      desc.includes("circle") ||
      desc.includes("кольцо") ||
      desc.includes("украшение") ||
      desc.includes("jewelry")
    )
      return { icon: "💍", color: "bg-purple-100", iconColor: "text-purple-600" }
    return { icon: "📄", color: "bg-blue-100", iconColor: "text-blue-700" }
  }
  const isDescriptionValid = () => expenseDescription.trim().length > 0
  const isAmountValid = () =>
    isDescriptionValid() && expenseAmount.trim().length > 0 && Number.parseFloat(expenseAmount) > 0
  const isPayerSelected = () => isAmountValid() && Object.keys(selectedPayers).length > 0

  const canSave = useMemo(() => {
    const tAN = Number.parseFloat(expenseAmount)
    if (!expenseDescription.trim() || isNaN(tAN) || tAN <= 0) return false
    if (Object.keys(selectedPayers).length === 0 || Object.keys(selectedShares).length === 0) return false
    const sP = Object.values(selectedPayers).reduce((s, v) => s + v, 0)
    if (Math.abs(sP - tAN) > 0.01) return false
    const sS = Object.values(selectedShares).reduce((s, v) => s + v, 0)
    if (Math.abs(sS - tAN) > 0.01) return false
    return true
  }, [expenseDescription, expenseAmount, selectedPayers, selectedShares])

  const openSplitOptions = () => {
    if (Object.keys(splitParticipants).length === 0 && trip) {
      const iS: { [key: string]: boolean } = {}
      trip.participants.forEach((p) => (iS[p.id] = true))
      setSplitParticipants(iS)
    }
    if (splitMethod === "exact") {
      const cE: { [key: string]: string } = {}
      Object.entries(selectedShares).forEach(([p, v]) => (cE[p] = v.toFixed(2)))
      setExactAmounts(cE)
    } else if (splitMethod === "percentages") {
      const cP: { [key: string]: string } = {}
      const tFP = Number.parseFloat(expenseAmount) || 0
      if (tFP > 0) Object.entries(selectedShares).forEach(([p, v]) => (cP[p] = ((v / tFP) * 100).toFixed(1)))
      setPercentages(cP)
    }
    setCurrentStep("split-options")
  }

  const applySplitOptions = () => {
    const tA = Number.parseFloat(expenseAmount) || 0
    const nS: { [key: string]: number } = {}
    if (splitMethod === "equally") {
      const pTS = Object.keys(splitParticipants).filter((p) => splitParticipants[p])
      if (pTS.length > 0) {
        const sPP = tA / pTS.length
        pTS.forEach((p) => (nS[p] = sPP))
      }
    } else if (splitMethod === "exact") {
      let sE = 0
      Object.entries(exactAmounts).forEach(([p, aS]) => {
        const nA = Number.parseFloat(aS) || 0
        if (nA > 0) {
          nS[p] = nA
          sE += nA
        }
      })
      if (Math.abs(sE - tA) > 0.01) {
        alert(`Сумма точных долей (${sE.toFixed(2)}) не совпадает с общей суммой (${tA.toFixed(2)}).`)
        return
      }
    } else if (splitMethod === "percentages") {
      let sP = 0
      Object.entries(percentages).forEach(([p, pcS]) => {
        const nP = Number.parseFloat(pcS) || 0
        if (nP > 0) {
          nS[p] = (tA * nP) / 100
          sP += nP
        }
      })
      if (Math.abs(sP - 100) > 0.01) {
        alert(`Сумма процентов (${sP.toFixed(1)}%) не равна 100%.`)
        return
      }
    }
    setSelectedShares(nS)
    setCurrentStep("main")
  }

  const toggleSplitParticipant = (p: string) => setSplitParticipants((prev) => ({ ...prev, [p]: !prev[p] }))
  const getSelectedSplitCount = () => Object.values(splitParticipants).filter(Boolean).length
  const getAmountPerPerson = () => {
    const t = Number.parseFloat(expenseAmount) || 0
    const c = getSelectedSplitCount()
    return c > 0 ? t / c : 0
  }
  const updateExactAmount = (p: string, a: string) => setExactAmounts((prev) => ({ ...prev, [p]: a }))
  const updatePercentage = (p: string, pc: string) => setPercentages((prev) => ({ ...prev, [p]: pc }))
  const getTotalExactAmounts = () => Object.values(exactAmounts).reduce((s, a) => s + (Number.parseFloat(a) || 0), 0)
  const getTotalPercentages = () => Object.values(percentages).reduce((s, pc) => s + (Number.parseFloat(pc) || 0), 0)

  const canApplySplitOptions = () => {
    const tA = Number.parseFloat(expenseAmount) || 0
    if (splitMethod === "equally") return getSelectedSplitCount() > 0
    if (splitMethod === "exact")
      return (
        Math.abs(getTotalExactAmounts() - tA) < 0.01 &&
        Object.keys(exactAmounts).some((k) => Number.parseFloat(exactAmounts[k]) > 0)
      )
    if (splitMethod === "percentages")
      return (
        Math.abs(getTotalPercentages() - 100) < 0.01 &&
        Object.keys(percentages).some((k) => Number.parseFloat(percentages[k]) > 0)
      )
    return false
  }

  const areAllParticipantsSelectedForSplit = () => trip && trip.participants.every((p) => splitParticipants[p.id])
  const toggleAllParticipantsForSplit = () => {
    if (!trip) return
    const allS = areAllParticipantsSelectedForSplit()
    const nS: { [key: string]: boolean } = {}
    trip.participants.forEach((p) => (nS[p.id] = !allS))
    setSplitParticipants(nS)
  }

  const getSplitSummaryText = () => {
    const sC = Object.keys(selectedShares).length
    if (sC === 0) return "На всех"
    const tAN = Number.parseFloat(expenseAmount) || 0
    if (tAN === 0) return "Сумма 0"
    const sV = Object.values(selectedShares)
    const fS = sV.length > 0 ? sV[0] : 0
    const allEqS = sV.every((s) => Math.abs(s - fS) < 0.01)
    if (allEqS && sC > 0 && Math.abs(fS - tAN / sC) < 0.01) {
      if (trip && sC === trip.participants.length) return "На всех"
      return `${sC} чел. (поровну)`
    }
    if (sC > 0) return `${sC} чел. (особые доли)`
    return "Выберите способ"
  }

  const openEditExpenseModal = (expense: Expense) => {
    setSelectedExpense(expense)
    setExpenseDescription(expense.description)
    setExpenseAmount(expense.totalAmount.toFixed(2))
    setSelectedPayers(expense.payers)
    setSelectedShares(expense.shares)
    initializePayerSelectionStep()
    const totalAmt = expense.totalAmount
    const shares = expense.shares
    const shareEntries = Object.entries(shares);
    const numSharers = shareEntries.length;
    // const totalAmt = expense.totalAmount;

    if (numSharers > 0) {
      const firstShareVal = shareEntries[0][1];
      const allSharesEqual = shareEntries.every(([_, val]) => Math.abs(val - firstShareVal) < 0.01);
      // Check if it's a valid "equally" split based on the number of sharers
      const expectedEqualShare = totalAmt / numSharers;

      if (allSharesEqual && Math.abs(firstShareVal - expectedEqualShare) < 0.01) {
        setSplitMethod("equally");
        const sp: { [key: string]: boolean } = {};
        (trip?.participants || []).forEach(p => (sp[p.id] = !!shares[p.id] && shares[p.id] > 0.001));
        setSplitParticipants(sp);
        setExactAmounts({});
        setPercentages({});
      } else {
        // Default to "exact" if not perfectly equal. User can change to "percentages".
        setSplitMethod("exact");
        const ex: { [key: string]: string } = {};
        shareEntries.forEach(([p, val]) => {
          if (val > 0.001) ex[p] = val.toFixed(2);
        });
        setExactAmounts(ex);
        const sp: { [key: string]: boolean } = {};
        (trip?.participants || []).forEach(p => (sp[p.id] = !!shares[p.id] && shares[p.id] > 0.001));
        setSplitParticipants(sp); // Reflects who has shares, useful if user switches to "equally"
        setPercentages({});
      }
    } else { // No shares found or all shares are zero, default to equally among all
      setSplitMethod("equally");
      const sp: { [key: string]: boolean } = {};
      (trip?.participants || []).forEach(p => (sp[p.id] = true)); // Default to all selected
      setSplitParticipants(sp);
      setExactAmounts({});
      setPercentages({});
    }
    setCurrentStep("main")
    setIsAddExpenseOpen(true)
  }

  const confirmDeleteExpense = (expenseId: string) => {
    setExpenseToDelete(expenseId)
    setIsDeleteExpenseConfirmOpen(true)
  }
  const deleteExpense = async () => {
    if (!expenseToDelete || !stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}/expenses/${expenseToDelete}`, { method: "DELETE" })
      if (response.ok) {
        setExpenses((prevExpenses) => prevExpenses.filter((exp) => exp.id !== expenseToDelete))
        setIsDeleteExpenseConfirmOpen(false)
        setExpenseToDelete(null)
      } else {
        throw new Error("Failed to delete expense")
      }
    } catch (e) {
      console.error("Ошибка при удалении расхода:", e)
      alert("Ошибка удаления.")
    }
  }

  const confirmDeleteTrip = () => setIsDeleteTripConfirmOpen(true)
  const deleteTrip = async () => {
    if (!stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}`, { method: "DELETE" })
      if (response.ok) router.push("/")
      else throw new Error("Failed to delete trip")
    } catch (e) {
      console.error("Ошибка при удалении поездки:", e)
      alert("Ошибка удаления.")
    }
  }

  const totalTempExactPayerAmounts = useMemo(
    () => Object.values(tempExactPayerAmounts).reduce((s, a) => s + (Number.parseFloat(a) || 0), 0),
    [tempExactPayerAmounts],
  )
  const remainingTempExactPayerAmount = useMemo(
    () => (Number.parseFloat(expenseAmount) || 0) - totalTempExactPayerAmounts,
    [expenseAmount, totalTempExactPayerAmounts],
  )

  useEffect(() => {
            if (!trip || trip.participants.length === 0) {
                setSelectedPayers({});
                return;
            }
            const totalAmountNum = Number.parseFloat(expenseAmount) || 0;

            // Only update payers if not in payer selection step, to avoid overriding user input there
            if (currentStep === 'main') {
                setSelectedPayers(prevPayers => {
                    // If no payers selected, default to first participant
                    if (Object.keys(prevPayers).length === 0 && trip.participants.length > 0) {
                        return { [trip.participants[0].id]: totalAmountNum };
                    }
                    // If one payer is selected, update their amount to total amount
                    if (Object.keys(prevPayers).length === 1) {
                        const payerId = Object.keys(prevPayers)[0];
                        if (trip.participants.some(p => p.id === payerId) && prevPayers[payerId] !== totalAmountNum) {
                            return { [payerId]: totalAmountNum };
                        }
                    }
                    // If multiple payers, their amounts are set via payerSelectionStep, don't auto-update here.
                    return prevPayers;
                });
            }
        }, [expenseAmount, trip, currentStep]);

        useEffect(() => {
            if (!trip || trip.participants.length === 0) {
                setSelectedShares({});
                return;
            }

            const totalAmountNum = Number.parseFloat(expenseAmount) || 0;

            if (splitMethod === "equally") {
                const activeSplitParticipantIds = Object.entries(splitParticipants)
                    .filter(([_, isSelected]) => isSelected)
                    .map(([id, _]) => id);

                const numSelectedToSplit = activeSplitParticipantIds.length;
                const newSharesFromEffect: { [key: string]: number } = {};

                if (numSelectedToSplit > 0) {
                    const sharePerPerson = totalAmountNum > 0 ? totalAmountNum / numSelectedToSplit : 0;
                    activeSplitParticipantIds.forEach(participantId => {
                        newSharesFromEffect[participantId] = sharePerPerson;
                    });
                }
                
                // Filter out zero shares before comparing and setting
                const finalNewShares: { [key: string]: number } = {};
                for (const pid in newSharesFromEffect) {
                    if (newSharesFromEffect[pid] > 0.001) { 
                        finalNewShares[pid] = newSharesFromEffect[pid];
                    }
                }

                setSelectedShares(prevShares => {
                    const prevActiveShareKeys = Object.keys(prevShares).filter(k => prevShares[k] > 0.001);
                    const newActiveShareKeys = Object.keys(finalNewShares);

                    if (prevActiveShareKeys.length !== newActiveShareKeys.length) return finalNewShares;
                    
                    let changed = false;
                    for (const key of newActiveShareKeys) {
                        if (!prevShares.hasOwnProperty(key) || Math.abs(prevShares[key] - finalNewShares[key]) > 0.01) {
                            changed = true;
                            break;
                        }
                    }
                    if (!changed) { // Check if prevShares has keys not in finalNewShares
                         for (const key of prevActiveShareKeys) {
                            if(!finalNewShares.hasOwnProperty(key)) {
                                changed = true;
                                break;
                            }
                        }
                    }
                    return changed ? finalNewShares : prevShares;
                });
            }
            // For "exact" and "percentages", selectedShares are managed by user interactions in applySplitOptions.
        }, [expenseAmount, trip, splitMethod, splitParticipants]);

  const handleLockTrip = () => {
    if (trip) {
      lockTrip(trip.id)
      setIsLocked(true)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных поездки {stableTripId ? `для ID: ${stableTripId}` : ""}...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">Ошибка: {error}</p>
          <Button
            onClick={() => {
              const currentId = params?.id
              if (typeof currentId === "string") {
                setStableTripId(null)
                setTimeout(() => setStableTripId(currentId), 0)
              } else {
                router.push("/")
              }
            }}
            className="mt-4"
          >
            Попробовать снова
          </Button>
          <Link href="/" className="block mt-2">
            <Button variant="outline">На главную</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-600">Поездка не найдена или данные отсутствуют.</p>
        <Link href="/" className="block mt-2">
          <Button variant="outline">На главную</Button>
        </Link>
      </div>
    )
  }

  if (trip && trip.pinHash && isLocked) {
    return <PinLockScreen tripId={trip.id} tripName={trip.name} pinHash={trip.pinHash} onUnlock={handleUnlock} />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">{trip.name}</h1>
          <div className="flex items-center space-x-1">
            {trip.pinHash && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLockTrip}
                className="text-gray-600 hover:text-gray-800"
                title="Заблокировать поездку"
              >
                <Lock className="w-5 h-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={openEditTrip} className="text-gray-600 hover:text-gray-800">
              <Edit className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="expenses" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">Расходы</TabsTrigger>
            <TabsTrigger value="balances">Балансы</TabsTrigger>
            <TabsTrigger value="settlements">Расчеты</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Расходы</h2>
              <Button size="sm" onClick={openAddExpense}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Пока нет расходов</p>
                  </CardContent>
                </Card>
              ) : (
                [...expenses]
                  .sort((a, b) => {
                    if (a.createdAt && b.createdAt)
                      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    const dC = new Date(b.date).getTime() - new Date(a.date).getTime()
                    if (dC !== 0) return dC
                    return b.id.localeCompare(a.id)
                  })
                  .map((expense) => (
                    <Card key={expense.id}>
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${getExpenseIcon(expense.description).color}`}
                            >
                              <span className="text-lg">{getExpenseIcon(expense.description).icon}</span>
                            </div>
                            <CardTitle className="text-base font-medium">{expense.description}</CardTitle>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Badge variant="secondary" className="text-sm">
                              ${expense.totalAmount.toFixed(2)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditExpenseModal(expense)}
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmDeleteExpense(expense.id)}
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <p className="text-xs text-gray-500 mb-1">
                          {new Date(expense.date).toLocaleDateString("ru-RU")}
                        </p>
                        <div className="text-xs text-gray-500">
                          <p>
                            Платили:{" "}
                            {Object.entries(expense.payers)
                              .map(([n, a]) => `${truncateName(participantIdToNameMap[n], 10)} $${a.toFixed(2)}`)
                              .join(", ")}
                          </p>
                          <p>
                            Участвуют:{" "}
                            {Object.keys(expense.shares)
                              .map((n) => truncateName(participantIdToNameMap[n], 10))
                              .join(", ")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="balances" className="space-y-4 pt-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Участники и Балансы</h2>
              <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Users className="w-4 h-4 mr-2" /> Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-md">
                  <DialogHeader>
                    <DialogTitle>Добавить участника</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="participantName">Имя участника</Label>
                      <Input
                        id="participantName"
                        value={newParticipantName}
                        onChange={(e) => setNewParticipantName(e.target.value)}
                        placeholder="Имя"
                      />
                    </div>
                    <Button onClick={addParticipantToTrip} className="w-full">
                      Добавить участника
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-3">
              {trip.participants.map((participant) => {
                const balance = balances[participant.id] || 0
                return (
                  <Card key={participant.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{participant.name}</span>
                        <div className="text-right">
                          <span
                            className={`font-bold ${balance > 0.009 ? "text-green-600" : balance < -0.009 ? "text-red-600" : "text-gray-600"}`}
                          >
                            ${Math.abs(balance).toFixed(2)}
                          </span>
                          <p className="text-xs text-gray-500">
                            {balance > 0.009 ? "получит" : balance < -0.009 ? "должен" : "квиты"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="settlements" className="space-y-4 pt-4">
            <Tabs defaultValue="optimized" onValueChange={(value) => setSettlementViewMode(value as "optimized" | "detailed")}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="optimized">Оптимизированные</TabsTrigger>
                <TabsTrigger value="detailed">Подробные</TabsTrigger>
              </TabsList>
              <TabsContent value="optimized">
                <h2 className="text-lg font-semibold mb-3">Оптимизированные расчеты</h2>
                {settlements.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        {expenses.length > 0 ? "Все расчеты завершены!" : "Добавьте расходы для расчета"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  settlements.map((group) => (
                    <div key={`optimized-${group.payerId}`} className="mb-4">
                      <h3 className="text-md font-semibold text-gray-800 mb-2">{group.payerName}</h3>
                      {group.transactions.map((transaction, txIndex) => (
                        <Card key={`optimized-tx-${group.payerId}-${transaction.receiverId}-${txIndex}`} className="mb-2">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">
                                  {group.payerName} <ArrowRight className="inline w-4 h-4 mx-1 text-gray-400" /> {transaction.receiverName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Перевести ${transaction.amount.toFixed(2)}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-red-600">
                                ${transaction.amount.toFixed(2)}
                              </p>
                            </div>
                          </CardContent>
                          </Card>
                      ))}
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="detailed">
                <h2 className="text-lg font-semibold mb-3">Подробные расчеты</h2>
                {isLoadingDetailedSettlements ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-500">Загрузка подробных расчетов...</p>
                  </div>
                ) : detailedSettlementsData.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        {expenses.length > 0 ? "Нет данных для подробного расчета или все квиты." : "Добавьте расходы для расчета"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  detailedSettlementsData.map((group) => (
                    <div key={`detailed-${group.payerId}`} className="mb-4">
                      <h3 className="text-md font-semibold text-gray-800 mb-2">{group.payerName}</h3>
                      {group.transactions.map((transaction, txIndex) => (
                        <Card key={`detailed-tx-${group.payerId}-${transaction.receiverId}-${txIndex}`} className="mb-2">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">
                                  {group.payerName} <ArrowRight className="inline w-4 h-4 mx-1 text-gray-400" /> {transaction.receiverName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Перевести ${transaction.amount.toFixed(2)}
                                </p>
                              </div>
                              <p className="text-lg font-bold text-red-600">
                                ${transaction.amount.toFixed(2)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

        <Dialog
          open={isAddExpenseOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              resetExpenseForm()
              setSelectedExpense(null)
            }
            setIsAddExpenseOpen(isOpen)
          }}
        >
          <DialogContent
          hideClose
          className="w-[90vw] max-w-md h-[90vh] p-0 flex flex-col overflow-hidden"
        >
            {currentStep === "main" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-center relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-0 top-1/2 -translate-y-1/2"
                      onClick={() => setIsAddExpenseOpen(false)}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                    <DialogTitle>{selectedExpense ? "Редактировать" : "Добавить"} расход</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  <div className="text-center">
                    <h3 className="text-md font-medium text-gray-700">{trip.name}</h3>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${getExpenseIcon(expenseDescription).color}`}
                    >
                      <span className={`text-2xl ${getExpenseIcon(expenseDescription).iconColor}`}>
                        {getExpenseIcon(expenseDescription).icon}
                      </span>
                    </div>
                    <Input
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      placeholder="Описание"
                      className="flex-1 border-none outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 border-b-2 border-gray-200 focus:border-b-2 focus:border-gray-200 rounded-none px-0 text-lg bg-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className={`font-medium ${isDescriptionValid() ? "text-gray-600" : "text-gray-400"}`}>
                      Сумма
                    </span>
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDescriptionValid() ? "bg-green-700" : "bg-gray-100"}`}
                      >
                        <span className={`text-xl font-bold ${isDescriptionValid() ? "text-white" : "text-gray-400"}`}>
                          $
                        </span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={expenseAmount}
                        onChange={(e) => setExpenseAmount(e.target.value)}
                        placeholder="0"
                        disabled={!isDescriptionValid()}
                        className={`flex-1 border-none outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 border-b-2 rounded-none px-0 text-2xl font-medium bg-transparent ${isDescriptionValid() ? "border-gray-200 focus:border-b-2 focus:border-gray-200 text-gray-900" : "border-gray-100 focus:border-b-2 focus:border-gray-100 text-gray-400 cursor-not-allowed"}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className={`font-medium ${isAmountValid() ? "text-gray-600" : "text-gray-400"}`}>
                      Оплатил
                    </span>
                    <Button
                      variant="outline"
                      onClick={initializePayerSelectionStep}
                      disabled={!isAmountValid()}
                      className="w-full justify-start text-left min-h-[48px] font-normal"
                    >
                      {getPayerSummaryText()}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <span className={`font-medium ${isPayerSelected() ? "text-gray-600" : "text-gray-400"}`}>
                      Разделить
                    </span>
                    <Button
                      variant="outline"
                      onClick={openSplitOptions}
                      disabled={!isPayerSelected()}
                      className="w-full justify-start text-left min-h-[48px] font-normal"
                    >
                      {getSplitSummaryText()}
                    </Button>
                  </div>
                </div>
                <div className="p-4 pt-0 flex-shrink-0">
                  <Button
                    onClick={saveExpense}
                    disabled={!canSave}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                  >
                    {selectedExpense ? "СОХРАНИТЬ" : "ДОБАВИТЬ"}
                  </Button>
                </div>
              </>
            )}
            {currentStep === "payerSelection" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentStep("main")}>
                      Назад
                    </Button>
                    <DialogTitle>Кто платил?</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-4 border-b">
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={payerSelectionMode === "checkbox" ? "default" : "ghost"}
                      onClick={() => setPayerSelectionMode("checkbox")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Поровну
                    </Button>
                    <Button
                      variant={payerSelectionMode === "exact" ? "default" : "ghost"}
                      onClick={() => setPayerSelectionMode("exact")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Точные суммы
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {payerSelectionMode === "checkbox" &&
                    trip.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                        onClick={() => setTempCheckboxPayers((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{p.name}</span>
                        </div>
                        <Checkbox checked={tempCheckboxPayers[p.id] || false} readOnly />
                      </div>
                    ))}
                  {payerSelectionMode === "exact" && (
                    <>
                      {trip.participants.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{p.name}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={tempExactPayerAmounts[p.id] || ""}
                              onChange={(e) =>
                                setTempExactPayerAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              placeholder="0.00"
                              className="w-24 text-right"
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 mt-2 border-t text-right">
                        <p className="text-sm">Итого: ${totalTempExactPayerAmounts.toFixed(2)}</p>
                        <p
                          className={`text-sm ${remainingTempExactPayerAmount < -0.009 ? "text-red-500" : "text-gray-500"}`}
                        >
                          Осталось: ${remainingTempExactPayerAmount.toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 border-t flex-shrink-0">
                  <Button onClick={handlePayerSelectionDone} className="w-full bg-green-600 hover:bg-green-700">
                    Готово
                  </Button>
                </div>
              </>
            )}
            {currentStep === "split-options" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => setCurrentStep("main")}>
                      Назад
                    </Button>
                    <DialogTitle>Способ деления</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-4 border-b">
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={splitMethod === "equally" ? "default" : "ghost"}
                      onClick={() => setSplitMethod("equally")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Поровну (=)
                    </Button>
                    <Button
                      variant={splitMethod === "exact" ? "default" : "ghost"}
                      onClick={() => setSplitMethod("exact")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Точные (1.23)
                    </Button>
                    <Button
                      variant={splitMethod === "percentages" ? "default" : "ghost"}
                      onClick={() => setSplitMethod("percentages")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Проценты (%)
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {splitMethod === "equally" && (
                    <>
                      {trip.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                          onClick={() => toggleSplitParticipant(p.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{p.name}</span>
                          </div>
                          <Checkbox checked={splitParticipants[p.id] || false} readOnly />
                        </div>
                      ))}
                      <div className="pt-4 mt-2 border-t flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">${getAmountPerPerson().toFixed(2)}/чел.</p>
                          <p className="text-xs text-gray-500">({getSelectedSplitCount()} участника)</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleAllParticipantsForSplit}
                          className={cn(
                            areAllParticipantsSelectedForSplit() && "bg-green-100 border-green-200 text-green-700",
                          )}
                        >
                          {areAllParticipantsSelectedForSplit() ? (
                            <UserCheck className="w-4 h-4 mr-2" />
                          ) : (
                            <Users className="w-4 h-4 mr-2" />
                          )}
                          Все
                        </Button>
                      </div>
                    </>
                  )}
                  {splitMethod === "exact" &&
                    trip.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{p.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-gray-500">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={exactAmounts[p.id] || ""}
                            onChange={(e) => updateExactAmount(p.id, e.target.value)}
                            placeholder="0.00"
                            className="w-24 text-right"
                          />
                        </div>
                      </div>
                    ))}
                  {splitMethod === "percentages" &&
                    trip.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{p.name}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Input
                            type="number"
                            step="0.1"
                            value={percentages[p.id] || ""}
                            onChange={(e) => updatePercentage(p.id, e.target.value)}
                            placeholder="0"
                            className="w-20 text-right"
                          />
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                    ))}
                  {(splitMethod === "exact" || splitMethod === "percentages") && (
                    <div className="pt-4 mt-2 border-t text-right">
                      <p className="text-sm">
                        Итого:{" "}
                        {splitMethod === "exact"
                          ? `$${getTotalExactAmounts().toFixed(2)}`
                          : `${getTotalPercentages().toFixed(1)}%`}
                      </p>
                      <p
                        className={`text-sm ${(splitMethod === "exact" && Math.abs(getTotalExactAmounts() - (Number.parseFloat(expenseAmount) || 0)) > 0.009) || (splitMethod === "percentages" && Math.abs(getTotalPercentages() - 100) > 0.09) ? "text-red-500" : "text-gray-500"}`}
                      >
                        {splitMethod === "exact"
                          ? `Разница: $${(getTotalExactAmounts() - (Number.parseFloat(expenseAmount) || 0)).toFixed(2)}`
                          : `Разница: ${(getTotalPercentages() - 100).toFixed(1)}%`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t flex-shrink-0">
                  <Button
                    onClick={applySplitOptions}
                    disabled={!canApplySplitOptions()}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Готово
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
          <DialogContent className="w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать поездку</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label htmlFor="editTripName" className="text-base font-medium">
                  Название поездки
                </Label>
                <Input
                  id="editTripName"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  placeholder="Например: Тусим в Италии"
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="text-base font-medium">Участники</Label>
                <div className="space-y-3 mt-3">
                  {editParticipants.map((p) => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Input
                        value={p.name}
                        onChange={(e) => updateEditParticipantName(p.id, e.target.value)}
                        placeholder="Имя участника"
                        className="flex-1"
                      />
                      {editParticipants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditParticipant(p.id)}
                          className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={addEditParticipant}
                    className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start p-0 h-auto py-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить участника
                  </Button>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Важно:</strong> При изменении участников существующие расходы останутся без изменений. Новые
                  участники будут доступны только для новых расходов.
                </p>
              </div>
              <div className="flex space-x-2 pt-4">
                <Button onClick={saveEditTrip} className="flex-1">
                  Сохранить изменения
                </Button>
                <Button variant="outline" onClick={() => setIsEditTripOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteExpenseConfirmOpen} onOpenChange={setIsDeleteExpenseConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить расход?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-gray-600">
                Вы уверены, что хотите удалить этот расход? Это действие нельзя отменить.
              </p>
              <div className="flex space-x-2">
                <Button variant="destructive" onClick={deleteExpense} className="flex-1">
                  Удалить
                </Button>
                <Button variant="outline" onClick={() => setIsDeleteExpenseConfirmOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteTripConfirmOpen} onOpenChange={setIsDeleteTripConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить поездку?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Вы уверены, что хотите удалить поездку <strong>"{trip.name}"</strong>?
                </p>
                <p className="text-sm text-red-600 font-medium">
                  Это действие удалит все расходы и данные поездки. Отменить это действие нельзя.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="destructive" onClick={deleteTrip} className="flex-1">
                  Удалить поездку
                </Button>
                <Button variant="outline" onClick={() => setIsDeleteTripConfirmOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )\
}
