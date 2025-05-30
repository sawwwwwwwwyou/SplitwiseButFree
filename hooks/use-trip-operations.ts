"use client"

import { useState, useCallback } from "react"
import type { Trip, Participant as ParticipantType } from "@/lib/types"
import { useRouter } from "next/navigation"
import { lockTrip as lockTripUtil } from "@/lib/pin-utils"

interface EditParticipant extends ParticipantType {
  isNew?: boolean
}

export function useTripOperations(
  trip: Trip | null,
  stableTripId: string | null,
  onTripUpdated: () => void,
  onTripDeleted: () => void,
) {
  const router = useRouter()

  const [isEditTripOpen, setIsEditTripOpen] = useState(false)
  const [editTripName, setEditTripName] = useState("")
  const [editParticipantsList, setEditParticipantsList] = useState<EditParticipant[]>([])

  const [isDeleteTripConfirmOpen, setIsDeleteTripConfirmOpen] = useState(false)

  const [isAddParticipantDialogOpen, setIsAddParticipantDialogOpen] = useState(false)
  const [newParticipantNameText, setNewParticipantNameText] = useState("")

  const openEditTripDialog = useCallback(() => {
    if (!trip) return
    setEditTripName(trip.name)
    setEditParticipantsList(trip.participants.map((p) => ({ ...p, isNew: false })))
    setIsEditTripOpen(true)
  }, [trip])

  const addEditParticipantHandler = () => {
    setEditParticipantsList((prev) => [...prev, { id: crypto.randomUUID(), name: "", isNew: true }])
  }

  const removeEditParticipantHandler = (id: string) => {
    if (editParticipantsList.length > 1) {
      setEditParticipantsList((prev) => prev.filter((p) => p.id !== id))
    }
  }

  const updateEditParticipantNameHandler = (id: string, name: string) => {
    setEditParticipantsList((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const handleSaveEditTrip = async () => {
    if (!editTripName.trim() || !trip || !stableTripId) return

    const processedParticipants: ParticipantType[] = editParticipantsList
      .map((p) => ({ id: p.id, name: p.name.trim() }))
      .filter((p) => p.name.length > 0)

    if (processedParticipants.length === 0) {
      alert("Добавьте хотя бы одного участника.")
      return
    }

    try {
      const response = await fetch(`/api/trips/${stableTripId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editTripName, participants: processedParticipants }),
      })
      if (response.ok) {
        setIsEditTripOpen(false)
        onTripUpdated()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update trip: ${response.statusText}`)
      }
    } catch (e: any) {
      console.error("Ошибка при обновлении поездки:", e)
      alert(`Ошибка обновления: ${e.message}`)
    }
  }

  const handleConfirmDeleteTrip = () => setIsDeleteTripConfirmOpen(true)

  const handleDeleteTrip = async () => {
    if (!stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}`, { method: "DELETE" })
      if (response.ok) {
        onTripDeleted() // Callback to navigate or update UI
        router.push("/")
      } else {
        throw new Error("Failed to delete trip")
      }
    } catch (e) {
      console.error("Ошибка при удалении поездки:", e)
      alert("Ошибка удаления.")
    }
  }

  const handleAddParticipantToTrip = async () => {
    if (!newParticipantNameText.trim() || !stableTripId) return
    try {
      const response = await fetch(`/api/trips/${stableTripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newParticipantNameText.trim() }),
      })
      if (response.ok) {
        setNewParticipantNameText("")
        setIsAddParticipantDialogOpen(false)
        onTripUpdated()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Ошибка добавления участника: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error("Ошибка при добавлении участника:", error)
      alert("Произошла ошибка при добавлении участника.")
    }
  }

  const handleManualLockTrip = useCallback(() => {
    if (trip) {
      lockTripUtil(trip.id)
      // The parent component will set `isLocked` to true via `setIsLocked` from `useTripData`
    }
  }, [trip])

  return {
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
  }
}
