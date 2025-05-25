import { type NextRequest, NextResponse } from "next/server"
import { getTrip, getExpenses } from "@/lib/storage"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = await getTrip(params.id)
    const expenses = await getExpenses(params.id)

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    // Calculate balances
    const balances: { [participant: string]: number } = {}

    // Initialize balances
    trip.participants.forEach((participant: string) => {
      balances[participant] = 0
    })

    // Calculate balances from expenses
    expenses.forEach((expense: any) => {
      // Add what each person paid
      Object.entries(expense.payers).forEach(([participant, amount]) => {
        if (balances.hasOwnProperty(participant)) {
          balances[participant] += amount as number
        }
      })

      // Subtract what each person owes
      Object.entries(expense.shares).forEach(([participant, share]) => {
        if (balances.hasOwnProperty(participant)) {
          balances[participant] -= share as number
        }
      })
    })

    // Generate optimal settlements using simplified algorithm
    const settlements = calculateOptimalSettlements(balances)

    return NextResponse.json(settlements)
  } catch (error) {
    console.error("Error in GET /api/trips/[id]/settlements:", error)
    return NextResponse.json({ error: "Failed to calculate settlements" }, { status: 500 })
  }
}

function calculateOptimalSettlements(balances: { [participant: string]: number }) {
  const settlements: { from: string; to: string; amount: number }[] = []

  // Create arrays of debtors and creditors
  const debtors: { name: string; amount: number }[] = []
  const creditors: { name: string; amount: number }[] = []

  Object.entries(balances).forEach(([participant, balance]) => {
    if (balance < -0.01) {
      // owes money
      debtors.push({ name: participant, amount: Math.abs(balance) })
    } else if (balance > 0.01) {
      // is owed money
      creditors.push({ name: participant, amount: balance })
    }
  })

  // Sort by amount (largest first)
  debtors.sort((a, b) => b.amount - a.amount)
  creditors.sort((a, b) => b.amount - a.amount)

  let i = 0,
    j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]

    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
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
