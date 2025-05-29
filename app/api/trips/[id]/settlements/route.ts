import { type NextRequest, NextResponse } from "next/server"
import { getTrip, getExpenses } from "@/lib/storage"
import type { Participant } from "@/lib/types"

interface SettlementTransaction {
  fromId: string
  toId: string
  amount: number
}

// Updated interface to reflect grouping by payer
interface PayerSettlementGroup {
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

    // Calculate balances using participant IDs
    const balances: { [participantId: string]: number } = {}
    const participantMap: { [id: string]: Participant } = {}

    trip.participants.forEach((participant) => {
      balances[participant.id] = 0
      participantMap[participant.id] = participant
    })

    expenses.forEach((expense) => {
      Object.entries(expense.payers).forEach(([participantId, amount]) => {
        if (balances.hasOwnProperty(participantId)) {
          balances[participantId] += amount as number
        }
      })
      Object.entries(expense.shares).forEach(([participantId, share]) => {
        if (balances.hasOwnProperty(participantId)) {
          balances[participantId] -= share as number
        }
      })
    })

    const settlements = calculateOptimalSettlements(balances)

    // Group by payer (fromId)
    const settlementsByPayer: {
      [payerId: string]: PayerSettlementGroup
    } = {}

    settlements.forEach((settlement) => {
      const payerId = settlement.fromId
      const receiverId = settlement.toId

      if (!settlementsByPayer[payerId]) {
        settlementsByPayer[payerId] = {
          payerId: payerId,
          payerName: participantMap[payerId]?.name || "Unknown",
          totalToPay: 0,
          transactions: [],
        }
      }
      settlementsByPayer[payerId].totalToPay += settlement.amount
      settlementsByPayer[payerId].transactions.push({
        receiverId: receiverId,
        receiverName: participantMap[receiverId]?.name || "Unknown",
        amount: settlement.amount,
      })
    })

    // Sort transactions for each payer if needed, e.g., by amount or receiver name
    Object.values(settlementsByPayer).forEach((group) => {
      group.transactions.sort((a, b) => b.amount - a.amount) // Example: sort by amount descending
      group.totalToPay = Number.parseFloat(group.totalToPay.toFixed(2)) // Fix floating point issues
    })

    return NextResponse.json(Object.values(settlementsByPayer)) // Return the grouped structure
  } catch (error) {
    console.error("Error in GET /api/trips/[id]/settlements:", error)
    return NextResponse.json({ error: "Failed to calculate settlements" }, { status: 500 })
  }
}

function calculateOptimalSettlements(balances: { [participantId: string]: number }): SettlementTransaction[] {
  const settlements: SettlementTransaction[] = []
  const debtors: { id: string; amount: number }[] = []
  const creditors: { id: string; amount: number }[] = []

  Object.entries(balances).forEach(([participantId, balance]) => {
    if (balance < -0.01) {
      debtors.push({ id: participantId, amount: Math.abs(balance) })
    } else if (balance > 0.01) {
      creditors.push({ id: participantId, amount: balance })
    }
  })

  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => a.amount - b.amount) // Sort creditors ascending to match smallest debts first

  let i = 0,
    j = 0
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0.01) {
      settlements.push({
        fromId: debtor.id,
        toId: creditor.id,
        amount: Math.round(amount * 100) / 100,
      })
    }

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount < 0.01) i++
    if (creditor.amount < 0.01) j++
  }
  return settlements
}
