import { type NextRequest, NextResponse } from "next/server"
import { getTrip, getExpenses } from "@/lib/storage"
import type { Participant } from "@/lib/types"

interface DetailedSettlementTransaction {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

// Updated interface to reflect grouping by payer
interface PayerDetailedSettlementGroup {
  payerId: string
  payerName: string
  totalToPay: number // Sum of amounts this payer needs to pay out
  transactions: Array<{
    receiverId: string
    receiverName: string
    amount: number
  }>
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const tripId = params.id
    const trip = await getTrip(tripId)
    const expenses = await getExpenses(tripId)

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    const participantMap: { [id: string]: Participant } = {}
    trip.participants.forEach((p) => {
      participantMap[p.id] = p
    })

    // Aggregate debts: key is "fromId_toId"
    const aggregatedDebts: { [key: string]: DetailedSettlementTransaction } = {}

    expenses.forEach((expense) => {
      const expenseDebtors: Array<{ id: string; amount: number }> = []
      const expenseCreditors: Array<{ id: string; amount: number }> = []

      trip.participants.forEach((participant) => {
        const paidInExpense = expense.payers[participant.id] || 0
        const shareInExpense = expense.shares[participant.id] || 0
        const balanceInExpense = paidInExpense - shareInExpense

        if (balanceInExpense < -0.01) {
          // Debtor for this specific expense
          expenseDebtors.push({ id: participant.id, amount: Math.abs(balanceInExpense) })
        } else if (balanceInExpense > 0.01) {
          // Creditor for this specific expense
          expenseCreditors.push({ id: participant.id, amount: balanceInExpense })
        }
      })

      // Settle debts within this single expense (simple greedy match)
      let dIdx = 0,
        cIdx = 0
      while (dIdx < expenseDebtors.length && cIdx < expenseCreditors.length) {
        const debtor = expenseDebtors[dIdx]
        const creditor = expenseCreditors[cIdx]
        const amountToTransfer = Math.min(debtor.amount, creditor.amount)

        if (amountToTransfer > 0.01) {
          const key = `${debtor.id}_${creditor.id}`
          if (!aggregatedDebts[key]) {
            aggregatedDebts[key] = {
              fromId: debtor.id,
              fromName: participantMap[debtor.id]?.name || "Unknown",
              toId: creditor.id,
              toName: participantMap[creditor.id]?.name || "Unknown",
              amount: 0,
            }
          }
          aggregatedDebts[key].amount += amountToTransfer
        }

        debtor.amount -= amountToTransfer
        creditor.amount -= amountToTransfer

        if (debtor.amount < 0.01) dIdx++
        if (creditor.amount < 0.01) cIdx++
      }
    })

    const finalDetailedTransactions = Object.values(aggregatedDebts).map((s) => ({
      ...s,
      amount: Number.parseFloat(s.amount.toFixed(2)),
    }))

    // Group by payer (fromId)
    const settlementsByPayer: { [payerId: string]: PayerDetailedSettlementGroup } = {}
    finalDetailedTransactions.forEach((transaction) => {
      const payerId = transaction.fromId
      const receiverId = transaction.toId

      if (!settlementsByPayer[payerId]) {
        settlementsByPayer[payerId] = {
          payerId: payerId,
          payerName: participantMap[payerId]?.name || "Unknown",
          totalToPay: 0,
          transactions: [],
        }
      }
      settlementsByPayer[payerId].totalToPay += transaction.amount
      settlementsByPayer[payerId].transactions.push({
        receiverId: receiverId,
        receiverName: participantMap[receiverId]?.name || "Unknown",
        amount: transaction.amount,
      })
    })

    Object.values(settlementsByPayer).forEach((group) => {
      group.totalToPay = Number.parseFloat(group.totalToPay.toFixed(2))
      group.transactions.sort((a, b) => b.amount - a.amount) // Optional: sort transactions
    })

    return NextResponse.json(Object.values(settlementsByPayer))
  } catch (error) {
    console.error("Error in GET /api/trips/[id]/detailed-settlements:", error)
    return NextResponse.json({ error: "Failed to calculate detailed settlements" }, { status: 500 })
  }
}
