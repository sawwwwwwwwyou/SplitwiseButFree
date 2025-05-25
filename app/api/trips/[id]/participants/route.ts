import { type NextRequest, NextResponse } from "next/server"
import { addParticipant } from "@/lib/storage"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name } = await request.json()

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const success = await addParticipant(params.id, name)

    if (!success) {
      return NextResponse.json({ error: "Failed to add participant or participant already exists" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in POST /api/trips/[id]/participants:", error)
    return NextResponse.json({ error: "Failed to add participant" }, { status: 500 })
  }
}
