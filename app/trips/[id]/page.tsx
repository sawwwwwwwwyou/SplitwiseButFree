"use client"

import { useState, useMemo, useCallback } from "react"
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
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn, getExpenseIcon, truncateName } from "@/lib/utils" // Assuming utils are combined
import type { Expense } from "@/lib/types"
import { PinLockScreen } from "@/components/pin-lock-screen"

import { useTripData } from "@/hooks/use-trip-data"
import { useTripOperations } from "@/hooks/use-trip-operations"
import { useExpenseListOperations } from "@/hooks/use-expense-list-operations"
import { useExpenseDialog } from "@/hooks/use-expense-dialog"
import { useSettlementData } from "@/hooks/use-settlement-data"

export default function TripPage() {
  const router = useRouter()

  const {
    stableTripId,
    trip,
    expenses,
    isLoading,
    error,
    isLocked,
    setIsLocked,
    handleUnlockSuccess,
    refreshTripData,
    manuallySetExpenses,
    setTrip: setCoreTripData,
  } = useTripData()

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

  const onTripUpdatedOrParticipantAdded = useCallback(() => {
    refreshTripData()
  }, [refreshTripData])

  const onTripDeleted = useCallback(() => {
    // Navigation is handled within the hook, but can add more logic here if needed
  }, [])

  const {
    isEditTripOpen,
    setIsEditTripOpen,
    editTripName,
    setEditTripName,
    editParticipantsList,
    setEditParticipantsList,
    addEditParticipantHandler,
    removeEditParticipantHandler,
    updateEditParticipantNameHandler,
    handleSaveEditTrip,
    openEditTripDialog,
    isDeleteTripConfirmOpen,
    setIsDeleteTripConfirmOpen,
    handleConfirmDeleteTrip,
    handleDeleteTrip,
    isAddParticipantDialogOpen,
    setIsAddParticipantDialogOpen,
    newParticipantNameText,
    setNewParticipantNameText,
    handleAddParticipantToTrip,
    handleManualLockTrip,
  } = useTripOperations(trip, stableTripId, onTripUpdatedOrParticipantAdded, onTripDeleted)

  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false)
  const [currentExpenseToEdit, setCurrentExpenseToEdit] = useState<Expense | null>(null)

  const handleExpenseSaveSuccess = useCallback(
    (savedExpense: Expense, isEdit: boolean) => {
      manuallySetExpenses((prevExpenses) => {
        if (isEdit) {
          return prevExpenses.map((exp) => (exp.id === savedExpense.id ? savedExpense : exp))
        }
        return [...prevExpenses, savedExpense]
      })
      setCurrentExpenseToEdit(null) // Clear after save
    },
    [manuallySetExpenses],
  )

  const expenseDialog = useExpenseDialog(
    trip,
    stableTripId,
    currentExpenseToEdit,
    isAddExpenseDialogOpen,
    () => {
      setIsAddExpenseDialogOpen(false)
      setCurrentExpenseToEdit(null) // Clear on close
    },
    handleExpenseSaveSuccess,
  )

  const handleOpenAddExpenseDialog = () => {
    setCurrentExpenseToEdit(null)
    setIsAddExpenseDialogOpen(true)
  }

  const handleOpenEditExpenseDialog = (expense: Expense) => {
    setCurrentExpenseToEdit(expense)
    setIsAddExpenseDialogOpen(true)
  }

  const onExpenseDeletedFromList = useCallback(
    (deletedExpenseId: string) => {
      manuallySetExpenses((prev) => prev.filter((exp) => exp.id !== deletedExpenseId))
    },
    [manuallySetExpenses],
  )

  const {
    sortedExpenses,
    isDeleteExpenseConfirmOpen,
    setIsDeleteExpenseConfirmOpen,
    handleConfirmDeleteExpense,
    handleDeleteExpenseFromList,
  } = useExpenseListOperations(expenses, stableTripId, onExpenseDeletedFromList, handleOpenEditExpenseDialog)

  const {
    balances,
    optimizedSettlements,
    detailedSettlements,
    isLoadingDetailedSettlements,
    settlementViewMode,
    setSettlementViewMode,
  } = useSettlementData(trip, expenses, stableTripId)

  const effectiveParticipantMap = participantIdToNameMap // Use the one derived from core trip data

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка данных поездки...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">Ошибка: {error}</p>
          <Button onClick={refreshTripData} className="mt-4">
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

  if (trip.pinHash && isLocked) {
    return (
      <PinLockScreen
        tripId={trip.id}
        tripName={trip.name}
        pinHash={trip.pinHash}
        onUnlock={() => {
          handleUnlockSuccess()
          // Settlements will be recalculated by useSettlementData hook due to expenses change
        }}
      />
    )
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
                onClick={() => {
                  handleManualLockTrip()
                  setIsLocked(true) // Manually update lock state in parent
                }}
                className="text-gray-600 hover:text-gray-800"
                title="Заблокировать поездку"
              >
                <Lock className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={openEditTripDialog}
              className="text-gray-600 hover:text-gray-800"
            >
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
              <Button size="sm" onClick={handleOpenAddExpenseDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить
              </Button>
            </div>
            <div className="space-y-3">
              {sortedExpenses.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Пока нет расходов</p>
                  </CardContent>
                </Card>
              ) : (
                sortedExpenses.map((expense) => (
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
                            onClick={() => handleOpenEditExpenseDialog(expense)}
                            className="h-8 w-8"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleConfirmDeleteExpense(expense.id)}
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3">
                      <p className="text-xs text-gray-500 mb-1">{new Date(expense.date).toLocaleDateString("ru-RU")}</p>
                      <div className="text-xs text-gray-500">
                        <p>
                          Платили:{" "}
                          {Object.entries(expense.payers)
                            .map(
                              ([pId, amt]) =>
                                `${truncateName(effectiveParticipantMap[pId] || "?", 10)} $${amt.toFixed(2)}`,
                            )
                            .join(", ")}
                        </p>
                        <p>
                          Участвуют:{" "}
                          {Object.keys(expense.shares)
                            .map((pId) => truncateName(effectiveParticipantMap[pId] || "?", 10))
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
              <Dialog open={isAddParticipantDialogOpen} onOpenChange={setIsAddParticipantDialogOpen}>
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
                        value={newParticipantNameText}
                        onChange={(e) => setNewParticipantNameText(e.target.value)}
                        placeholder="Имя"
                      />
                    </div>
                    <Button onClick={handleAddParticipantToTrip} className="w-full">
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
            <Tabs
              defaultValue="optimized"
              onValueChange={(value) => setSettlementViewMode(value as "optimized" | "detailed")}
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="optimized">Оптимизированные</TabsTrigger>
                <TabsTrigger value="detailed">Подробные</TabsTrigger>
              </TabsList>
              <TabsContent value="optimized">
                <h2 className="text-lg font-semibold mb-3">Оптимизированные расчеты</h2>
                {optimizedSettlements.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        {expenses.length > 0 ? "Все расчеты завершены!" : "Добавьте расходы для расчета"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  optimizedSettlements.map((group) => (
                    <div key={`optimized-${group.payerId}`} className="mb-4">
                      <h3 className="text-md font-semibold text-gray-800 mb-2">{group.payerName}</h3>
                      {group.transactions.map((transaction, txIndex) => (
                        <Card
                          key={`optimized-tx-${group.payerId}-${transaction.receiverId}-${txIndex}`}
                          className="mb-2"
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">
                                  {group.payerName} <ArrowRight className="inline w-4 h-4 mx-1 text-gray-400" />{" "}
                                  {transaction.receiverName}
                                </p>
                                <p className="text-xs text-gray-500">Перевести ${transaction.amount.toFixed(2)}</p>
                              </div>
                              <p className="text-lg font-bold text-red-600">${transaction.amount.toFixed(2)}</p>
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
                ) : detailedSettlements.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-500">
                        {expenses.length > 0
                          ? "Нет данных для подробного расчета или все квиты."
                          : "Добавьте расходы для расчета"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  detailedSettlements.map((group) => (
                    <div key={`detailed-${group.payerId}`} className="mb-4">
                      <h3 className="text-md font-semibold text-gray-800 mb-2">{group.payerName}</h3>
                      {group.transactions.map((transaction, txIndex) => (
                        <Card
                          key={`detailed-tx-${group.payerId}-${transaction.receiverId}-${txIndex}`}
                          className="mb-2"
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700">
                                  {group.payerName} <ArrowRight className="inline w-4 h-4 mx-1 text-gray-400" />{" "}
                                  {transaction.receiverName}
                                </p>
                                <p className="text-xs text-gray-500">Перевести ${transaction.amount.toFixed(2)}</p>
                              </div>
                              <p className="text-lg font-bold text-red-600">${transaction.amount.toFixed(2)}</p>
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
        </Tabs>

        {/* Add/Edit Expense Dialog */}
        <Dialog
          open={isAddExpenseDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen) expenseDialog.setCurrentStep("main")
            setIsAddExpenseDialogOpen(isOpen)
            if (!isOpen) setCurrentExpenseToEdit(null)
          }}
        >
          <DialogContent hideClose className="w-[90vw] max-w-md h-[90vh] p-0 flex flex-col overflow-hidden">
            {expenseDialog.currentStep === "main" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-center relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-0 top-1/2 -translate-y-1/2"
                      onClick={() => {
                        setIsAddExpenseDialogOpen(false)
                        setCurrentExpenseToEdit(null)
                      }}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                    <DialogTitle>{currentExpenseToEdit ? "Редактировать" : "Добавить"} расход</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                  <div className="text-center">
                    <h3 className="text-md font-medium text-gray-700">{trip.name}</h3>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${getExpenseIcon(expenseDialog.expenseDescription).color}`}
                    >
                      <span className={`text-2xl ${getExpenseIcon(expenseDialog.expenseDescription).iconColor}`}>
                        {getExpenseIcon(expenseDialog.expenseDescription).icon}
                      </span>
                    </div>
                    <Input
                      value={expenseDialog.expenseDescription}
                      onChange={(e) => expenseDialog.setExpenseDescription(e.target.value)}
                      placeholder="Описание"
                      className="flex-1 border-none outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 border-b-2 border-gray-200 focus:border-b-2 focus:border-gray-200 rounded-none px-0 text-lg bg-transparent"
                    />
                  </div>
                  <div className="space-y-2">
                    <span
                      className={`font-medium ${expenseDialog.isDescriptionValid ? "text-gray-600" : "text-gray-400"}`}
                    >
                      Сумма
                    </span>
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${expenseDialog.isDescriptionValid ? "bg-green-700" : "bg-gray-100"}`}
                      >
                        <span
                          className={`text-xl font-bold ${expenseDialog.isDescriptionValid ? "text-white" : "text-gray-400"}`}
                        >
                          $
                        </span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        value={expenseDialog.expenseAmount}
                        onChange={(e) => expenseDialog.setExpenseAmount(e.target.value)}
                        placeholder="0"
                        disabled={!expenseDialog.isDescriptionValid}
                        className={`flex-1 border-none outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 border-b-2 rounded-none px-0 text-2xl font-medium bg-transparent ${expenseDialog.isDescriptionValid ? "border-gray-200 focus:border-b-2 focus:border-gray-200 text-gray-900" : "border-gray-100 focus:border-b-2 focus:border-gray-100 text-gray-400 cursor-not-allowed"}`}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className={`font-medium ${expenseDialog.isAmountValid ? "text-gray-600" : "text-gray-400"}`}>
                      Оплатил
                    </span>
                    <Button
                      variant="outline"
                      onClick={expenseDialog.initializePayerSelectionStep}
                      disabled={!expenseDialog.isAmountValid}
                      className="w-full justify-start text-left min-h-[48px] font-normal"
                    >
                      {expenseDialog.getPayerSummaryText()}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <span
                      className={`font-medium ${expenseDialog.isPayerSelected ? "text-gray-600" : "text-gray-400"}`}
                    >
                      Разделить
                    </span>
                    <Button
                      variant="outline"
                      onClick={expenseDialog.openSplitOptions}
                      disabled={!expenseDialog.isPayerSelected}
                      className="w-full justify-start text-left min-h-[48px] font-normal"
                    >
                      {expenseDialog.getSplitSummaryText()}
                    </Button>
                  </div>
                </div>
                <div className="p-4 pt-0 flex-shrink-0">
                  <Button
                    onClick={expenseDialog.handleSaveExpense}
                    disabled={!expenseDialog.canSave}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300"
                  >
                    {currentExpenseToEdit ? "СОХРАНИТЬ" : "ДОБАВИТЬ"}
                  </Button>
                </div>
              </>
            )}
            {expenseDialog.currentStep === "payerSelection" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => expenseDialog.setCurrentStep("main")}>
                      Назад
                    </Button>
                    <DialogTitle>Кто платил?</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-4 border-b">
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={expenseDialog.payerSelectionMode === "checkbox" ? "default" : "ghost"}
                      onClick={() => expenseDialog.setPayerSelectionMode("checkbox")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Поровну
                    </Button>
                    <Button
                      variant={expenseDialog.payerSelectionMode === "exact" ? "default" : "ghost"}
                      onClick={() => expenseDialog.setPayerSelectionMode("exact")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Точные суммы
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {expenseDialog.payerSelectionMode === "checkbox" &&
                    trip.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                        onClick={() =>
                          expenseDialog.setTempCheckboxPayers((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                        }
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{p.name}</span>
                        </div>
                        <Checkbox checked={expenseDialog.tempCheckboxPayers[p.id] || false} readOnly />
                      </div>
                    ))}
                  {expenseDialog.payerSelectionMode === "exact" && (
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
                              value={expenseDialog.tempExactPayerAmounts[p.id] || ""}
                              onChange={(e) =>
                                expenseDialog.setTempExactPayerAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              placeholder="0.00"
                              className="w-24 text-right"
                            />
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 mt-2 border-t text-right">
                        <p className="text-sm">Итого: ${expenseDialog.totalTempExactPayerAmounts.toFixed(2)}</p>
                        <p
                          className={`text-sm ${expenseDialog.remainingTempExactPayerAmount < -0.009 ? "text-red-500" : "text-gray-500"}`}
                        >
                          Осталось: ${expenseDialog.remainingTempExactPayerAmount.toFixed(2)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div className="p-4 border-t flex-shrink-0">
                  <Button
                    onClick={expenseDialog.handlePayerSelectionDone}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Готово
                  </Button>
                </div>
              </>
            )}
            {expenseDialog.currentStep === "split-options" && (
              <>
                <DialogHeader className="p-4 pb-0 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => expenseDialog.setCurrentStep("main")}>
                      Назад
                    </Button>
                    <DialogTitle>Способ деления</DialogTitle>
                  </div>
                </DialogHeader>
                <div className="p-4 border-b">
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={expenseDialog.splitMethod === "equally" ? "default" : "ghost"}
                      onClick={() => expenseDialog.setSplitMethod("equally")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Поровну (=)
                    </Button>
                    <Button
                      variant={expenseDialog.splitMethod === "exact" ? "default" : "ghost"}
                      onClick={() => expenseDialog.setSplitMethod("exact")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Точные (1.23)
                    </Button>
                    <Button
                      variant={expenseDialog.splitMethod === "percentages" ? "default" : "ghost"}
                      onClick={() => expenseDialog.setSplitMethod("percentages")}
                      className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                    >
                      Проценты (%)
                    </Button>
                  </div>
                </div>
                <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                  {expenseDialog.splitMethod === "equally" && (
                    <>
                      {trip.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer"
                          onClick={() => expenseDialog.toggleSplitParticipant(p.id)}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{p.name}</span>
                          </div>
                          <Checkbox checked={expenseDialog.splitParticipants[p.id] || false} readOnly />
                        </div>
                      ))}
                      <div className="pt-4 mt-2 border-t flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">
                            ${expenseDialog.getAmountPerPersonForSplit().toFixed(2)}/чел.
                          </p>
                          <p className="text-xs text-gray-500">({expenseDialog.getSelectedSplitCount()} участника)</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={expenseDialog.toggleAllParticipantsForSplit}
                          className={cn(
                            expenseDialog.areAllParticipantsSelectedForSplit &&
                              "bg-green-100 border-green-200 text-green-700",
                          )}
                        >
                          {expenseDialog.areAllParticipantsSelectedForSplit ? (
                            <UserCheck className="w-4 h-4 mr-2" />
                          ) : (
                            <Users className="w-4 h-4 mr-2" />
                          )}
                          Все
                        </Button>
                      </div>
                    </>
                  )}
                  {expenseDialog.splitMethod === "exact" &&
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
                            value={expenseDialog.exactAmounts[p.id] || ""}
                            onChange={(e) => expenseDialog.updateExactAmountForSplit(p.id, e.target.value)}
                            placeholder="0.00"
                            className="w-24 text-right"
                          />
                        </div>
                      </div>
                    ))}
                  {expenseDialog.splitMethod === "percentages" &&
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
                            value={expenseDialog.percentages[p.id] || ""}
                            onChange={(e) => expenseDialog.updatePercentageForSplit(p.id, e.target.value)}
                            placeholder="0"
                            className="w-20 text-right"
                          />
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                    ))}
                  {(expenseDialog.splitMethod === "exact" || expenseDialog.splitMethod === "percentages") && (
                    <div className="pt-4 mt-2 border-t text-right">
                      <p className="text-sm">
                        Итого:{" "}
                        {expenseDialog.splitMethod === "exact"
                          ? `$${expenseDialog.getTotalExactAmountsForSplit().toFixed(2)}`
                          : `${expenseDialog.getTotalPercentagesForSplit().toFixed(1)}%`}
                      </p>
                      <p
                        className={`text-sm ${(expenseDialog.splitMethod === "exact" && Math.abs(expenseDialog.getTotalExactAmountsForSplit() - (Number.parseFloat(expenseDialog.expenseAmount) || 0)) > 0.009) || (expenseDialog.splitMethod === "percentages" && Math.abs(expenseDialog.getTotalPercentagesForSplit() - 100) > 0.09) ? "text-red-500" : "text-gray-500"}`}
                      >
                        {expenseDialog.splitMethod === "exact"
                          ? `Разница: $${(expenseDialog.getTotalExactAmountsForSplit() - (Number.parseFloat(expenseDialog.expenseAmount) || 0)).toFixed(2)}`
                          : `Разница: ${(expenseDialog.getTotalPercentagesForSplit() - 100).toFixed(1)}%`}
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t flex-shrink-0">
                  <Button
                    onClick={expenseDialog.applySplitOptions}
                    disabled={!expenseDialog.canApplySplitOptions}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Готово
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Trip Dialog */}
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
                  {editParticipantsList.map((p) => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <Input
                        value={p.name}
                        onChange={(e) => updateEditParticipantNameHandler(p.id, e.target.value)}
                        placeholder="Имя участника"
                        className="flex-1"
                      />
                      {editParticipantsList.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditParticipantHandler(p.id)}
                          className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={addEditParticipantHandler}
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
                <Button onClick={handleSaveEditTrip} className="flex-1">
                  Сохранить изменения
                </Button>
                <Button variant="outline" onClick={() => setIsEditTripOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Expense Confirm Dialog */}
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
                <Button variant="destructive" onClick={handleDeleteExpenseFromList} className="flex-1">
                  Удалить
                </Button>
                <Button variant="outline" onClick={() => setIsDeleteExpenseConfirmOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Trip Confirm Dialog */}
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
                <Button variant="destructive" onClick={handleDeleteTrip} className="flex-1">
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
