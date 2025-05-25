import { type NextRequest, NextResponse } from "next/server"
import { getTrip, updateTrip, deleteTrip } from "@/lib/storage"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const trip = await getTrip(params.id)

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    return NextResponse.json(trip)
  } catch (error) {
    console.error("Error in GET /api/trips/[id]:", error)
    return NextResponse.json({ error: "Failed to fetch trip" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, participants } = await request.json()

    if (!name || !participants || !Array.isArray(participants)) {
      return NextResponse.json({ error: "Name and participants array are required" }, { status: 400 })
    }

    const trip = await updateTrip(params.id, name, participants)

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    return NextResponse.json(trip)
  } catch (error) {
    console.error("Error in PUT /api/trips/[id]:", error)
    return NextResponse.json({ error: "Failed to update trip" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const success = await deleteTrip(params.id)

    if (!success) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/trips/[id]:", error)
    return NextResponse.json({ error: "Failed to delete trip" }, { status: 500 })
  }
}
