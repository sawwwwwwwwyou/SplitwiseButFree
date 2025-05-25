import { type NextRequest, NextResponse } from "next/server"
import { getExpenses, createExpense } from "@/lib/storage"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const expenses = await getExpenses(params.id)
    return NextResponse.json(expenses)
  } catch (error) {
    console.error("Error in GET /api/trips/[id]/expenses:", error)
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { description, date, totalAmount, payers, shares } = await request.json()

    if (!description || !date || !totalAmount || !payers || !shares) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const expense = await createExpense(params.id, description, date, Number.parseFloat(totalAmount), payers, shares)

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/trips/[id]/expenses:", error)
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 })
  }
}
