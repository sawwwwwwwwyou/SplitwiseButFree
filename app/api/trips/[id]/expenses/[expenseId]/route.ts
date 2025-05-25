import { type NextRequest, NextResponse } from "next/server"
import { updateExpense, deleteExpense } from "@/lib/storage"

export async function PUT(request: NextRequest, { params }: { params: { id: string; expenseId: string } }) {
  try {
    const { description, date, totalAmount, payers, shares } = await request.json()

    if (!description || !date || !totalAmount || !payers || !shares) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }

    const expense = await updateExpense(
      params.id,
      params.expenseId,
      description,
      date,
      Number.parseFloat(totalAmount),
      payers,
      shares,
    )

    if (!expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error("Error in PUT /api/trips/[id]/expenses/[expenseId]:", error)
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string; expenseId: string } }) {
  try {
    const success = await deleteExpense(params.id, params.expenseId)

    if (!success) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/trips/[id]/expenses/[expenseId]:", error)
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 })
  }
}
