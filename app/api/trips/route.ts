import { type NextRequest, NextResponse } from "next/server"
import { getTrips, createTrip } from "@/lib/storage"

export async function GET() {
  try {
    const trips = await getTrips()
    return NextResponse.json(trips)
  } catch (error) {
    console.error("Error in GET /api/trips:", error)
    return NextResponse.json({ error: "Failed to fetch trips" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, participants: participantObjects, pin } = await request.json() // participants теперь participantObjects

    if (!name || !participantObjects || !Array.isArray(participantObjects)) {
      return NextResponse.json({ error: "Name and participants array (of objects) are required" }, { status: 400 })
    }
    // Дополнительная валидация, что каждый элемент participantObjects имеет id и name, если нужно

    const trip = await createTrip(name, participantObjects, pin) // Передаем participantObjects
    return NextResponse.json(trip, { status: 201 })
  } catch (error) {
    console.error("Error in POST /api/trips:", error)
    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 })
  }
}
