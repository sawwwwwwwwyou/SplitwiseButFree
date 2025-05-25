"use client"

import { useState, useEffect } from "react"
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
  MoreVertical,
  ChevronRight,
  Check,
  Receipt,
  Settings,
  X,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Trip {
  id: string
  name: string
  participants: string[]
  createdAt: string
}

interface Expense {
  id: string
  description: string
  date: string
  totalAmount: number
  payers: { [participant: string]: number }
  shares: { [participant: string]: number }
}

interface Settlement {
  from: string
  to: string
  amount: number
}

type SplitMethod = "equally" | "exact" | "percentages"

interface EditParticipant {
  id: string
  name: string
  isNew?: boolean
}

export default function TripPage() {
  const params = useParams()
  const router = useRouter()
  const tripId = params.id as string

  const [trip, setTrip] = useState<Trip | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [balances, setBalances] = useState<{ [participant: string]: number }>({})

  // Dialogs state
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false)
  const [isEditTripOpen, setIsEditTripOpen] = useState(false)

  // Edit trip state
  const [editTripName, setEditTripName] = useState("")
  const [editParticipants, setEditParticipants] = useState<EditParticipant[]>([])

  // New expense flow state
  const [currentStep, setCurrentStep] = useState<"main" | "choose-payer" | "paid-amounts" | "split-options">("main")
  const [expenseDescription, setExpenseDescription] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [selectedPayers, setSelectedPayers] = useState<{ [participant: string]: number }>({})
  const [selectedShares, setSelectedShares] = useState<{ [participant: string]: number }>({})
  const [splitMethod, setSplitMethod] = useState<SplitMethod>("equally")
  const [splitParticipants, setSplitParticipants] = useState<{ [participant: string]: boolean }>({})
  const [exactAmounts, setExactAmounts] = useState<{ [participant: string]: string }>({})
  const [percentages, setPercentages] = useState<{ [participant: string]: string }>({})

  // Add participant form state
  const [newParticipantName, setNewParticipantName] = useState("")

  // Edit expense state
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [isEditExpenseOpen, setIsEditExpenseOpen] = useState(false)
  const [isDeleteExpenseConfirmOpen, setIsDeleteExpenseConfirmOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null)

  // Delete trip state
  const [isDeleteTripConfirmOpen, setIsDeleteTripConfirmOpen] = useState(false)

  // Edit expense form state
  const [editExpenseDescription, setEditExpenseDescription] = useState("")
  const [editExpenseDate, setEditExpenseDate] = useState("")
  const [editExpenseAmount, setEditExpenseAmount] = useState("")
  const [editSelectedPayers, setEditSelectedPayers] = useState<{ [participant: string]: string }>({})
  const [editSelectedShares, setEditSelectedShares] = useState<{ [participant: string]: boolean }>({})
  const [editSplitEqually, setEditSplitEqually] = useState(true)

  useEffect(() => {
    if (tripId) {
      fetchTrip()
      fetchExpenses()
    }
  }, [tripId])

  useEffect(() => {
    if (trip && expenses.length > 0) {
      calculateBalances()
      fetchSettlements()
    }
  }, [trip, expenses])

  const fetchTrip = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}`)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`)
        return
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Response is not JSON")
        return
      }

      const data = await response.json()
      setTrip(data)
    } catch (error) {
      console.error("Ошибка при загрузке поездки:", error)
    }
  }

  const fetchExpenses = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/expenses`)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`)
        return
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Response is not JSON")
        return
      }

      const data = await response.json()
      setExpenses(data)
    } catch (error) {
      console.error("Ошибка при загрузке расходов:", error)
    }
  }

  const fetchSettlements = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/settlements`)

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`)
        return
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Response is not JSON")
        return
      }

      const data = await response.json()
      setSettlements(data)
    } catch (error) {
      console.error("Ошибка при загрузке расчетов:", error)
    }
  }

  const calculateBalances = () => {
    if (!trip) return

    const newBalances: { [participant: string]: number } = {}

    // Initialize balances
    trip.participants.forEach((participant) => {
      newBalances[participant] = 0
    })

    // Calculate balances from expenses
    expenses.forEach((expense) => {
      // Add what each person paid
      Object.entries(expense.payers).forEach(([participant, amount]) => {
        newBalances[participant] += amount
      })

      // Subtract what each person owes
      Object.entries(expense.shares).forEach(([participant, share]) => {
        newBalances[participant] -= share
      })
    })

    setBalances(newBalances)
  }

  const openEditTrip = () => {
    if (!trip) return
    setEditTripName(trip.name)
    setEditParticipants(
      trip.participants.map((name, index) => ({
        id: index.toString(),
        name,
      })),
    )
    setIsEditTripOpen(true)
  }

  const addEditParticipant = () => {
    const newId = (editParticipants.length + 1).toString()
    setEditParticipants([...editParticipants, { id: newId, name: "", isNew: true }])
  }

  const removeEditParticipant = (id: string) => {
    if (editParticipants.length > 1) {
      setEditParticipants(editParticipants.filter((p) => p.id !== id))
    }
  }

  const updateEditParticipantName = (id: string, name: string) => {
    setEditParticipants(editParticipants.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const saveEditTrip = async () => {
    if (!editTripName.trim()) return

    const participantNames = editParticipants.map((p) => p.name.trim()).filter((name) => name.length > 0)

    if (participantNames.length === 0) {
      alert("Добавьте хотя бы одного участника")
      return
    }

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTripName,
          participants: participantNames,
        }),
      })

      if (response.ok) {
        setIsEditTripOpen(false)
        fetchTrip()
        // Пересчитать балансы с новыми участниками
        setTimeout(() => {
          calculateBalances()
          fetchSettlements()
        }, 100)
      }
    } catch (error) {
      console.error("Ошибка при обновлении поездки:", error)
    }
  }

  const addParticipant = async () => {
    if (!newParticipantName.trim()) return

    try {
      const response = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newParticipantName }),
      })

      if (response.ok) {
        setNewParticipantName("")
        setIsAddParticipantOpen(false)
        fetchTrip()
      }
    } catch (error) {
      console.error("Ошибка при добавлении участника:", error)
    }
  }

  const resetExpenseForm = () => {
    setCurrentStep("main")
    setExpenseDescription("")
    setExpenseAmount("")
    setSelectedPayers({})
    setSelectedShares({})
    setSplitMethod("equally")
    setSplitParticipants({})
    setExactAmounts({})
    setPercentages({})
  }

  const openAddExpense = () => {
    resetExpenseForm()
    setIsAddExpenseOpen(true)
  }

  const saveExpense = async () => {
    if (!expenseDescription.trim() || !expenseAmount || !trip) return

    const totalAmount = Number.parseFloat(expenseAmount)
    if (isNaN(totalAmount) || totalAmount <= 0) return

    try {
      const response = await fetch(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: expenseDescription,
          date: new Date().toISOString().split("T")[0],
          totalAmount,
          payers: selectedPayers,
          shares: selectedShares,
        }),
      })

      if (response.ok) {
        resetExpenseForm()
        setIsAddExpenseOpen(false)
        fetchExpenses()
      }
    } catch (error) {
      console.error("Ошибка при добавлении расхода:", error)
    }
  }

  const getPayerText = () => {
    const payerNames = Object.keys(selectedPayers)
    if (payerNames.length === 0) return "выберите плательщика"
    if (payerNames.length === 1) return payerNames[0]
    return `${payerNames[0]} и еще ${payerNames.length - 1}`
  }

  const getSplitText = () => {
    const shareCount = Object.keys(selectedShares).length
    if (shareCount === 0) return "выберите участников"
    if (splitMethod === "equally") return "поровну"
    if (splitMethod === "exact") return "точные суммы"
    if (splitMethod === "percentages") return "проценты"
    return "доли"
  }

  const canSave = () => {
    return (
      expenseDescription.trim() &&
      expenseAmount &&
      Object.keys(selectedPayers).length > 0 &&
      Object.keys(selectedShares).length > 0
    )
  }

  const selectSinglePayer = (participant: string) => {
    const amount = Number.parseFloat(expenseAmount) || 0
    setSelectedPayers({ [participant]: amount })

    // Автоматически установить равное деление между всеми участниками
    if (trip) {
      const sharePerPerson = amount / trip.participants.length
      const shares: { [key: string]: number } = {}
      trip.participants.forEach((p) => {
        shares[p] = sharePerPerson
      })
      setSelectedShares(shares)
    }

    setCurrentStep("main")
  }

  const goToMultiplePayers = () => {
    setCurrentStep("paid-amounts")
  }

  const updatePaidAmount = (participant: string, amount: string) => {
    const numAmount = Number.parseFloat(amount) || 0
    setSelectedPayers((prev) => ({
      ...prev,
      [participant]: numAmount,
    }))
  }

  const getTotalPaid = () => {
    return Object.values(selectedPayers).reduce((sum, amount) => sum + amount, 0)
  }

  const getAmountLeft = () => {
    const total = Number.parseFloat(expenseAmount) || 0
    return total - getTotalPaid()
  }

  const canDonePaidAmounts = () => {
    return Math.abs(getAmountLeft()) < 0.01
  }

  const donePaidAmounts = () => {
    setCurrentStep("main")
  }

  const openSplitOptions = () => {
    // Initialize split participants if not set
    if (Object.keys(splitParticipants).length === 0 && trip) {
      const initialSplit: { [key: string]: boolean } = {}
      trip.participants.forEach((p) => {
        initialSplit[p] = true
      })
      setSplitParticipants(initialSplit)
    }
    setCurrentStep("split-options")
  }

  const applySplitOptions = () => {
    const totalAmount = Number.parseFloat(expenseAmount) || 0
    const newShares: { [key: string]: number } = {}

    if (splitMethod === "equally") {
      const participants = Object.keys(splitParticipants).filter((p) => splitParticipants[p])
      const sharePerPerson = totalAmount / participants.length
      participants.forEach((p) => {
        newShares[p] = sharePerPerson
      })
    } else if (splitMethod === "exact") {
      Object.entries(exactAmounts).forEach(([participant, amount]) => {
        const numAmount = Number.parseFloat(amount) || 0
        if (numAmount > 0) {
          newShares[participant] = numAmount
        }
      })
    } else if (splitMethod === "percentages") {
      Object.entries(percentages).forEach(([participant, percent]) => {
        const numPercent = Number.parseFloat(percent) || 0
        if (numPercent > 0) {
          newShares[participant] = (totalAmount * numPercent) / 100
        }
      })
    }

    setSelectedShares(newShares)
    setCurrentStep("main")
  }

  const toggleSplitParticipant = (participant: string) => {
    setSplitParticipants((prev) => ({
      ...prev,
      [participant]: !prev[participant],
    }))
  }

  const getSelectedSplitCount = () => {
    return Object.values(splitParticipants).filter(Boolean).length
  }

  const getAmountPerPerson = () => {
    const total = Number.parseFloat(expenseAmount) || 0
    const count = getSelectedSplitCount()
    return count > 0 ? total / count : 0
  }

  const updateExactAmount = (participant: string, amount: string) => {
    setExactAmounts((prev) => ({
      ...prev,
      [participant]: amount,
    }))
  }

  const updatePercentage = (participant: string, percent: string) => {
    setPercentages((prev) => ({
      ...prev,
      [participant]: percent,
    }))
  }

  const getTotalExactAmounts = () => {
    return Object.values(exactAmounts).reduce((sum, amount) => sum + (Number.parseFloat(amount) || 0), 0)
  }

  const getTotalPercentages = () => {
    return Object.values(percentages).reduce((sum, percent) => sum + (Number.parseFloat(percent) || 0), 0)
  }

  const canApplySplitOptions = () => {
    const totalAmount = Number.parseFloat(expenseAmount) || 0

    if (splitMethod === "equally") {
      return getSelectedSplitCount() > 0
    } else if (splitMethod === "exact") {
      const totalExact = getTotalExactAmounts()
      return Math.abs(totalExact - totalAmount) < 0.01
    } else if (splitMethod === "percentages") {
      const totalPercent = getTotalPercentages()
      return Math.abs(totalPercent - 100) < 0.01
    }

    return false
  }

  const areAllParticipantsSelected = () => {
    if (!trip) return false
    return trip.participants.every((p) => splitParticipants[p])
  }

  const toggleAllParticipants = () => {
    if (!trip) return
    const allSelected = areAllParticipantsSelected()
    const newState: { [key: string]: boolean } = {}
    trip.participants.forEach((p) => {
      newState[p] = !allSelected
    })
    setSplitParticipants(newState)
  }

  const openEditExpense = (expense: Expense) => {
    setSelectedExpense(expense)
    setEditExpenseDescription(expense.description)
    setEditExpenseDate(expense.date)
    setEditExpenseAmount(expense.totalAmount.toString())

    // Set payers
    const payersState: { [participant: string]: string } = {}
    Object.entries(expense.payers).forEach(([participant, amount]) => {
      payersState[participant] = amount.toString()
    })
    setEditSelectedPayers(payersState)

    // Set shares
    const sharesState: { [participant: string]: boolean } = {}
    Object.keys(expense.shares).forEach((participant) => {
      sharesState[participant] = true
    })
    setEditSelectedShares(sharesState)

    setIsEditExpenseOpen(true)
  }

  const updateExpense = async () => {
    if (!editExpenseDescription.trim() || !editExpenseAmount || !trip || !selectedExpense) return

    const totalAmount = Number.parseFloat(editExpenseAmount)
    if (isNaN(totalAmount) || totalAmount <= 0) return

    // Validate payers
    const payers: { [participant: string]: number } = {}
    let totalPaid = 0

    Object.entries(editSelectedPayers).forEach(([participant, amount]) => {
      const paidAmount = Number.parseFloat(amount)
      if (!isNaN(paidAmount) && paidAmount > 0) {
        payers[participant] = paidAmount
        totalPaid += paidAmount
      }
    })

    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      alert("Сумма платежей должна равняться общей сумме расхода")
      return
    }

    // Calculate shares
    const shares: { [participant: string]: number } = {}
    const participantsInShares = Object.keys(editSelectedShares).filter((p) => editSelectedShares[p])

    if (participantsInShares.length === 0) {
      alert("Выберите хотя бы одного участника для разделения расхода")
      return
    }

    const sharePerPerson = totalAmount / participantsInShares.length
    participantsInShares.forEach((participant) => {
      shares[participant] = sharePerPerson
    })

    try {
      const response = await fetch(`/api/trips/${tripId}/expenses/${selectedExpense.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editExpenseDescription,
          date: editExpenseDate,
          totalAmount,
          payers,
          shares,
        }),
      })

      if (response.ok) {
        setIsEditExpenseOpen(false)
        setSelectedExpense(null)
        fetchExpenses()
      }
    } catch (error) {
      console.error("Ошибка при обновлении расхода:", error)
    }
  }

  const confirmDeleteExpense = (expenseId: string) => {
    setExpenseToDelete(expenseId)
    setIsDeleteExpenseConfirmOpen(true)
  }

  const deleteExpense = async () => {
    if (!expenseToDelete) return

    try {
      const response = await fetch(`/api/trips/${tripId}/expenses/${expenseToDelete}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setIsDeleteExpenseConfirmOpen(false)
        setExpenseToDelete(null)
        fetchExpenses()
      }
    } catch (error) {
      console.error("Ошибка при удалении расхода:", error)
    }
  }

  const confirmDeleteTrip = () => {
    setIsDeleteTripConfirmOpen(true)
  }

  const deleteTrip = async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        router.push("/")
      }
    } catch (error) {
      console.error("Ошибка при удалении поездки:", error)
    }
  }

  const handleEditPayerAmountChange = (participant: string, amount: string) => {
    setEditSelectedPayers((prev) => ({
      ...prev,
      [participant]: amount,
    }))
  }

  const handleEditShareToggle = (participant: string, checked: boolean) => {
    setEditSelectedShares((prev) => ({
      ...prev,
      [participant]: checked,
    }))
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mr-2">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mr-2">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 flex-1">{trip.name}</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openEditTrip}>
                <Settings className="w-4 h-4 mr-2" />
                Редактировать поездку
              </DropdownMenuItem>
              <DropdownMenuItem onClick={confirmDeleteTrip} className="text-red-600">
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить поездку
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="expenses" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">Расходы</TabsTrigger>
            <TabsTrigger value="balances">Балансы</TabsTrigger>
            <TabsTrigger value="settlements">Расчеты</TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Расходы</h2>
              <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openAddExpense}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-md h-[90vh] p-0">
                  {currentStep === "main" && (
                    <>
                      <DialogHeader className="p-4 pb-0">
                        <div className="flex items-center justify-center">
                          <DialogTitle>Добавить расход</DialogTitle>
                        </div>
                      </DialogHeader>
                      <div className="p-6 space-y-8 flex-1">
                        {/* Trip name centered */}
                        <div className="text-center">
                          <h3 className="text-lg font-medium text-gray-900">{trip.name}</h3>
                        </div>

                        {/* Description field */}
                        <div className="space-y-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                              <Receipt className="w-6 h-6 text-pink-600" />
                            </div>
                            <Input
                              value={expenseDescription}
                              onChange={(e) => setExpenseDescription(e.target.value)}
                              placeholder="Описание"
                              className="flex-1 border-0 border-b-2 border-gray-200 rounded-none px-0 focus:border-gray-400 text-lg"
                            />
                          </div>

                          {/* Amount field */}
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                              <span className="text-xl font-bold text-gray-700">$</span>
                            </div>
                            <Input
                              type="number"
                              step="0.01"
                              value={expenseAmount}
                              onChange={(e) => setExpenseAmount(e.target.value)}
                              placeholder="0"
                              className="flex-1 border-0 border-b-2 border-gray-200 rounded-none px-0 focus:border-gray-400 text-2xl font-medium"
                            />
                          </div>
                        </div>

                        {/* Payer and split options */}
                        <div className="space-y-6 pt-4">
                          {/* Payer selection */}
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-medium">Оплатил</span>
                            <Select
                              value={Object.keys(selectedPayers)[0] || ""}
                              onValueChange={(value) => {
                                if (value === "multiple") {
                                  goToMultiplePayers()
                                } else {
                                  selectSinglePayer(value)
                                }
                              }}
                            >
                              <SelectTrigger className="w-auto min-w-[200px] text-gray-900 border-gray-200 hover:bg-gray-50">
                                <SelectValue placeholder="выберите плательщика" />
                              </SelectTrigger>
                              <SelectContent>
                                {trip.participants.map((participant) => (
                                  <SelectItem key={participant} value={participant}>
                                    <div className="flex items-center space-x-3">
                                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                        {participant.charAt(0)}
                                      </div>
                                      <span>{participant}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectItem value="multiple">
                                  <div className="flex items-center justify-between w-full">
                                    <span className="font-medium">Несколько человек</span>
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Split selection */}
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-600 font-medium">Разделить</span>
                            <Button
                              variant="outline"
                              onClick={openSplitOptions}
                              className="text-gray-900 border-gray-200 hover:bg-gray-50 font-medium"
                            >
                              поровну
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Save button at bottom center */}
                      <div className="p-6 pt-0">
                        <Button
                          onClick={saveExpense}
                          disabled={!canSave()}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                        >
                          ДОБАВИТЬ
                        </Button>
                      </div>
                    </>
                  )}

                  {currentStep === "choose-payer" && (
                    <>
                      <DialogHeader className="p-4 pb-0">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="sm" onClick={() => setCurrentStep("main")}>
                            Назад
                          </Button>
                          <DialogTitle>Выбрать плательщика</DialogTitle>
                          <div className="w-16"></div>
                        </div>
                      </DialogHeader>
                      <div className="p-4 space-y-4">
                        {trip.participants.map((participant) => (
                          <div
                            key={participant}
                            onClick={() => selectSinglePayer(participant)}
                            className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                {participant.charAt(0)}
                              </div>
                              <span className="font-medium">{participant}</span>
                            </div>
                            {Object.keys(selectedPayers).includes(participant) && (
                              <Check className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                        ))}

                        <div
                          onClick={goToMultiplePayers}
                          className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <span className="font-medium">Несколько человек</span>
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === "paid-amounts" && (
                    <>
                      <DialogHeader className="p-4 pb-0">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="sm" onClick={() => setCurrentStep("choose-payer")}>
                            Назад
                          </Button>
                          <DialogTitle>Ввести суммы</DialogTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={donePaidAmounts}
                            disabled={!canDonePaidAmounts()}
                            className="text-green-600 disabled:text-gray-400"
                          >
                            Готово
                          </Button>
                        </div>
                      </DialogHeader>
                      <div className="p-4 space-y-4">
                        {trip.participants.map((participant) => (
                          <div key={participant} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                {participant.charAt(0)}
                              </div>
                              <span className="font-medium">{participant}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-500">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={selectedPayers[participant] || ""}
                                onChange={(e) => updatePaidAmount(participant, e.target.value)}
                                placeholder="0,00"
                                className="w-20 text-right border-0 border-b border-gray-300 focus:border-gray-400"
                              />
                            </div>
                          </div>
                        ))}

                        <div className="pt-4 border-t text-center space-y-1">
                          <div className="text-lg font-medium">
                            ${getTotalPaid().toFixed(2)} из ${expenseAmount || "0"}
                          </div>
                          <div className="text-sm text-gray-600">${getAmountLeft().toFixed(2)} осталось</div>
                        </div>
                      </div>
                    </>
                  )}

                  {currentStep === "split-options" && (
                    <>
                      <DialogHeader className="p-4 pb-0">
                        <div className="flex items-center justify-between">
                          <Button variant="ghost" size="sm" onClick={() => setCurrentStep("main")}>
                            Назад
                          </Button>
                          <DialogTitle>Способ деления</DialogTitle>
                          <div className="w-16"></div>
                        </div>
                      </DialogHeader>
                      <div className="p-4 space-y-6 flex-1">
                        {/* Split method icons */}
                        <div className="flex justify-center space-x-4">
                          <div className="text-center">
                            <div
                              className={`w-16 h-16 rounded-lg flex items-center justify-center ${splitMethod === "equally" ? "bg-green-100" : "bg-gray-100"}`}
                            >
                              <span className="text-2xl">💰</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <div
                              className={`w-16 h-16 rounded-lg flex items-center justify-center ${splitMethod === "exact" ? "bg-blue-100" : "bg-gray-100"}`}
                            >
                              <span className="text-2xl">🐘</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <div
                              className={`w-16 h-16 rounded-lg flex items-center justify-center ${splitMethod === "percentages" ? "bg-red-100" : "bg-gray-100"}`}
                            >
                              <span className="text-2xl">🦄</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-center">
                          <h3 className="font-medium text-lg">
                            {splitMethod === "equally" && "Разделить поровну"}
                            {splitMethod === "exact" && "Точные суммы"}
                            {splitMethod === "percentages" && "По процентам"}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {splitMethod === "equally" && "Выберите участников для равного деления"}
                            {splitMethod === "exact" && "Введите точную сумму для каждого участника"}
                            {splitMethod === "percentages" && "Введите процент для каждого участника"}
                          </p>
                        </div>

                        {/* Method selector */}
                        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                          <Button
                            variant={splitMethod === "equally" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSplitMethod("equally")}
                            className="flex-1"
                          >
                            =
                          </Button>
                          <Button
                            variant={splitMethod === "exact" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSplitMethod("exact")}
                            className="flex-1"
                          >
                            1.23
                          </Button>
                          <Button
                            variant={splitMethod === "percentages" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setSplitMethod("percentages")}
                            className="flex-1"
                          >
                            %
                          </Button>
                        </div>

                        {/* Participants list - different for each method */}
                        <div className="space-y-3">
                          {splitMethod === "equally" &&
                            trip.participants.map((participant) => (
                              <div key={participant} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                    {participant.charAt(0)}
                                  </div>
                                  <span className="font-medium">{participant}</span>
                                </div>
                                <div
                                  onClick={() => toggleSplitParticipant(participant)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                                    splitParticipants[participant] ? "bg-green-500 border-green-500" : "border-gray-300"
                                  }`}
                                >
                                  {splitParticipants[participant] && <Check className="w-4 h-4 text-white" />}
                                </div>
                              </div>
                            ))}

                          {splitMethod === "exact" &&
                            trip.participants.map((participant) => (
                              <div key={participant} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                    {participant.charAt(0)}
                                  </div>
                                  <span className="font-medium">{participant}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-500">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={exactAmounts[participant] || ""}
                                    onChange={(e) => updateExactAmount(participant, e.target.value)}
                                    placeholder="0.00"
                                    className="w-20 text-right border-0 border-b border-gray-300 focus:border-gray-400"
                                  />
                                </div>
                              </div>
                            ))}

                          {splitMethod === "percentages" &&
                            trip.participants.map((participant) => (
                              <div key={participant} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                                    {participant.charAt(0)}
                                  </div>
                                  <span className="font-medium">{participant}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={percentages[participant] || ""}
                                    onChange={(e) => updatePercentage(participant, e.target.value)}
                                    placeholder="0"
                                    className="w-16 text-right border-0 border-b border-gray-300 focus:border-gray-400"
                                  />
                                  <span className="text-gray-500">%</span>
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Summary */}
                        <div className="pt-4 border-t">
                          {splitMethod === "equally" && (
                            <div className="flex items-center justify-between">
                              <div className="text-center">
                                <div className="font-medium">${getAmountPerPerson().toFixed(2)}/человек</div>
                                <div className="text-sm text-gray-600">({getSelectedSplitCount()} человек)</div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={toggleAllParticipants}
                                className={`${
                                  areAllParticipantsSelected()
                                    ? "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
                                    : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                Все <Check className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          )}

                          {splitMethod === "exact" && (
                            <div className="text-center">
                              <div className="font-medium">Итого: ${getTotalExactAmounts().toFixed(2)}</div>
                              <div className="text-sm text-gray-600">
                                из ${expenseAmount || "0"} (
                                {Math.abs(getTotalExactAmounts() - (Number.parseFloat(expenseAmount) || 0)).toFixed(2)}{" "}
                                разница)
                              </div>
                            </div>
                          )}

                          {splitMethod === "percentages" && (
                            <div className="text-center">
                              <div className="font-medium">Итого: {getTotalPercentages().toFixed(1)}%</div>
                              <div className="text-sm text-gray-600">
                                из 100% ({Math.abs(getTotalPercentages() - 100).toFixed(1)}% разница)
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Done button at bottom center */}
                      <div className="p-6 pt-0">
                        <Button
                          onClick={applySplitOptions}
                          disabled={!canApplySplitOptions()}
                          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400"
                        >
                          ГОТОВО
                        </Button>
                      </div>
                    </>
                  )}
                </DialogContent>
              </Dialog>
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
                expenses.map((expense) => (
                  <Card key={expense.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{expense.description}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">${expense.totalAmount.toFixed(2)}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditExpense(expense)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDeleteExpense(expense.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-2">{new Date(expense.date).toLocaleDateString("ru-RU")}</p>
                      <div className="text-xs text-gray-500">
                        <p>
                          Платили:{" "}
                          {Object.entries(expense.payers)
                            .map(([name, amount]) => `${name} $${amount.toFixed(2)}`)
                            .join(", ")}
                        </p>
                        <p>Участвуют: {Object.keys(expense.shares).join(", ")}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="balances" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Участники</h2>
              <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Добавить
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[90vw] max-w-md">
                  <DialogHeader>
                    <DialogTitle>Добавить участника</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="participantName">Имя участника</Label>
                      <Input
                        id="participantName"
                        value={newParticipantName}
                        onChange={(e) => setNewParticipantName(e.target.value)}
                        placeholder="Имя"
                      />
                    </div>
                    <Button onClick={addParticipant} className="w-full">
                      Добавить участника
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {(trip?.participants || []).map((participant) => {
                const balance = balances[participant] || 0
                return (
                  <Card key={participant}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{participant}</span>
                        <div className="text-right">
                          <span
                            className={`font-bold ${balance > 0 ? "text-green-600" : balance < 0 ? "text-red-600" : "text-gray-600"}`}
                          >
                            ${Math.abs(balance).toFixed(2)}
                          </span>
                          <p className="text-xs text-gray-500">
                            {balance > 0 ? "получит" : balance < 0 ? "должен" : "квиты"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="settlements" className="space-y-4">
            <h2 className="text-lg font-semibold">Предложения по расчетам</h2>

            <div className="space-y-3">
              {settlements.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Все расчеты завершены!</p>
                  </CardContent>
                </Card>
              ) : (
                settlements.map((settlement, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {settlement.from} → {settlement.to}
                          </p>
                          <p className="text-sm text-gray-600">Перевести ${settlement.amount.toFixed(2)}</p>
                        </div>
                        <DollarSign className="w-5 h-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Trip Dialog */}
        <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
          <DialogContent className="w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать поездку</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="editTripName" className="text-base font-medium">
                  Название поездки
                </Label>
                <Input
                  id="editTripName"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  placeholder="Например: Отпуск в Сочи"
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-base font-medium">Участники</Label>
                <div className="space-y-3 mt-3">
                  {editParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-2">
                      <Input
                        value={participant.name}
                        onChange={(e) => updateEditParticipantName(participant.id, e.target.value)}
                        placeholder="Имя участника"
                        className="flex-1"
                      />
                      {editParticipants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditParticipant(participant.id)}
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

        {/* Edit Expense Dialog - keeping the old simple version for now */}
        <Dialog open={isEditExpenseOpen} onOpenChange={setIsEditExpenseOpen}>
          <DialogContent className="w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать расход</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editDescription">Описание</Label>
                <Input
                  id="editDescription"
                  value={editExpenseDescription}
                  onChange={(e) => setEditExpenseDescription(e.target.value)}
                  placeholder="Ужин в ресторане"
                />
              </div>
              <div>
                <Label htmlFor="editDate">Дата</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editExpenseDate}
                  onChange={(e) => setEditExpenseDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="editAmount">Общая сумма ($)</Label>
                <Input
                  id="editAmount"
                  type="number"
                  step="0.01"
                  value={editExpenseAmount}
                  onChange={(e) => setEditExpenseAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Кто платил</Label>
                <div className="space-y-2 mt-2">
                  {(trip?.participants || []).map((participant) => (
                    <div key={participant} className="flex items-center space-x-2">
                      <Label className="flex-1">{participant}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="w-20"
                        value={editSelectedPayers[participant] || ""}
                        onChange={(e) => handleEditPayerAmountChange(participant, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label> Разделить между</Label>
                <div className="space-y-2 mt-2">
                  {(trip?.participants || []).map((participant) => (
                    <div key={participant} className="flex items-center space-x-2">
                      <Checkbox
                        id={`editShare-${participant}`}
                        checked={editSelectedShares[participant] || false}
                        onCheckedChange={(checked) => handleEditShareToggle(participant, checked as boolean)}
                      />
                      <Label htmlFor={`editShare-${participant}`}>{participant}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={updateExpense} className="flex-1">
                  Сохранить изменения
                </Button>
                <Button variant="outline" onClick={() => setIsEditExpenseOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Expense Confirmation Dialog */}
        <Dialog open={isDeleteExpenseConfirmOpen} onOpenChange={setIsDeleteExpenseConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить расход?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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

        {/* Delete Trip Confirmation Dialog */}
        <Dialog open={isDeleteTripConfirmOpen} onOpenChange={setIsDeleteTripConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить поездку?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Вы уверены, что хотите удалить поездку <strong>"{trip?.name}"</strong>?
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
  )
}
