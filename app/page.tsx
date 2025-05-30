"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Users, Calendar, Trash2, X, Edit, Lock } from "lucide-react" // Added Lock
import Link from "next/link"
import type { Participant as ParticipantType } from "@/lib/types"
import { getUnlockedTrips } from "@/lib/pin-utils" // Import for checking unlocked trips

interface Trip {
  id: string
  name: string
  participants: ParticipantType[]
  createdAt: string
  pinHash?: string
}

interface Participant {
  id: string
  name: string
}

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTripName, setNewTripName] = useState("")
  const [participants, setParticipants] = useState<Participant[]>([
    { id: "1", name: "" },
    { id: "2", name: "" },
  ])

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null)

  const [isEditTripOpen, setIsEditTripOpen] = useState(false)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editTripName, setEditTripName] = useState("")
  const [editParticipants, setEditParticipants] = useState<Participant[]>([])

  const [newTripPin, setNewTripPin] = useState("")
  const [unlockedTripIds, setUnlockedTripIds] = useState<string[]>([])

  useEffect(() => {
    fetchTrips()
    setUnlockedTripIds(getUnlockedTrips())
  }, [])

  const fetchTrips = async () => {
    try {
      const response = await fetch("/api/trips")
      const data = await response.json()
      setTrips(data as Trip[])
    } catch (error) {
      console.error("Ошибка при загрузке поездок:", error)
    }
  }

  const addParticipant = () => {
    const newId = crypto.randomUUID() // Use crypto.randomUUID for unique IDs
    setParticipants([...participants, { id: newId, name: "" }])
  }

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((p) => p.id !== id))
    }
  }

  const updateParticipantName = (id: string, name: string) => {
    setParticipants(participants.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const isCreateTripDisabled = useMemo(() => {
    const hasName = newTripName.trim().length > 0
    const hasParticipants = participants.some((p) => p.name.trim().length > 0)
    const isPinValid = newTripPin.trim().length === 0 || newTripPin.trim().length === 4
    return !hasName || !hasParticipants || !isPinValid
  }, [newTripName, participants, newTripPin])

  const createTrip = async () => {
    if (isCreateTripDisabled) return // Already checked by button's disabled state

    const participantObjects: ParticipantType[] = participants
      .filter((p) => p.name.trim().length > 0)
      .map((p) => ({ id: p.id, name: p.name.trim() }))

    try {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTripName,
          participants: participantObjects,
          pin: newTripPin.trim() || undefined,
        }),
      })

      if (response.ok) {
        setNewTripName("")
        setNewTripPin("")
        setParticipants([
          { id: "1", name: "" },
          { id: "2", name: "" },
        ])
        setIsCreateDialogOpen(false)
        fetchTrips()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Ошибка создания поездки: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error("Ошибка при создании поездки:", error)
      alert("Произошла ошибка при создании поездки.")
    }
  }

  const confirmDeleteTrip = (trip: Trip, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setTripToDelete(trip)
    setIsDeleteConfirmOpen(true)
  }

  const deleteTrip = async () => {
    if (!tripToDelete) return

    try {
      const response = await fetch(`/api/trips/${tripToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setIsDeleteConfirmOpen(false)
        setTripToDelete(null)
        fetchTrips()
      }
    } catch (error) {
      console.error("Ошибка при удалении поездки:", error)
    }
  }

  const openEditTrip = (trip: Trip) => {
    setEditingTrip(trip)
    setEditTripName(trip.name)
    setEditParticipants(
      trip.participants.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    )
    setIsEditTripOpen(true)
  }

  const addEditParticipant = () => {
    const newId = crypto.randomUUID()
    setEditParticipants([...editParticipants, { id: newId, name: "" }])
  }

  const removeEditParticipant = (id: string) => {
    if (editParticipants.length > 1) {
      setEditParticipants(editParticipants.filter((p) => p.id !== id))
    }
  }

  const updateEditParticipantName = (id: string, name: string) => {
    setEditParticipants(editParticipants.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const saveEditTrip = async () => {
    if (!editTripName.trim() || !editingTrip) return

    const processedParticipants: ParticipantType[] = editParticipants
      .map((p) => ({ id: p.id, name: p.name.trim() }))
      .filter((p) => p.name.length > 0)

    if (processedParticipants.length === 0) {
      alert("Добавьте хотя бы одного участника")
      return
    }

    try {
      const response = await fetch(`/api/trips/${editingTrip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editTripName,
          participants: processedParticipants,
        }),
      })

      if (response.ok) {
        setIsEditTripOpen(false)
        setEditingTrip(null)
        fetchTrips()
      } else {
        const errorData = await response.json().catch(() => ({}))
        alert(`Ошибка обновления: ${errorData.error || response.statusText}`)
      }
    } catch (error) {
      console.error("Ошибка при обновлении поездки:", error)
      alert("Произошла ошибка при обновлении поездки.")
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Поездки</h1>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Создать
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Новая поездка</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="tripName" className="text-base font-medium">
                    Название
                  </Label>
                  <Input
                    id="tripName"
                    value={newTripName}
                    onChange={(e) => setNewTripName(e.target.value)}
                    placeholder="Например: Отпуск в Сочи"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="tripPin" className="text-base font-medium">
                    PIN-код (опционально)
                  </Label>
                  <Input
                    id="tripPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newTripPin}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "")
                      setNewTripPin(value)
                    }}
                    placeholder="4 цифры для защиты поездки"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Если указан, PIN-код будет запрашиваться при каждом доступе к поездке. Оставьте пустым, если PIN не
                    нужен.
                  </p>
                </div>

                <div>
                  <Label className="text-base font-medium">Участники</Label>
                  <div className="space-y-3 mt-3">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center space-x-2">
                        <Input
                          value={participant.name}
                          onChange={(e) => updateParticipantName(participant.id, e.target.value)}
                          placeholder="Имя участника"
                          className="flex-1"
                        />
                        {participants.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeParticipant(participant.id)}
                            className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    <Button
                      variant="ghost"
                      onClick={addParticipant}
                      className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start p-0 h-auto py-2"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить участника
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button onClick={createTrip} className="flex-1" disabled={isCreateTripDisabled}>
                    Создать поездку
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">
                    Отмена
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-3">
          {trips.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500 mb-4">Пока нет поездок</p>
                <p className="text-sm text-gray-400">Создайте первую поездку для отслеживания групповых расходов</p>
              </CardContent>
            </Card>
          ) : (
            trips.map((trip) => {
              const isLocked = trip.pinHash && !unlockedTripIds.includes(trip.id)
              return (
                <div key={trip.id} className="relative">
                  <Link href={`/trips/${trip.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center">
                              {isLocked && <Lock className="w-4 h-4 mr-2 text-gray-500" />}
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">{trip.name}</h3>
                            </div>
                            <div className="flex items-center text-sm text-gray-600 mb-3">
                              <Calendar className="w-4 h-4 mr-1" />
                              {new Date(trip.createdAt).toLocaleDateString("ru-RU")}
                            </div>
                            <div className="flex items-center text-sm text-gray-600 mb-2">
                              <Users className="w-4 h-4 mr-1" />
                              {trip.participants.length}{" "}
                              {trip.participants.length === 1
                                ? "участник"
                                : trip.participants.length > 1 && trip.participants.length < 5
                                  ? "участника"
                                  : "участников"}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              if (!isLocked) openEditTrip(trip)
                            }}
                            disabled={isLocked}
                            className="h-8 w-8 p-0 text-gray-600 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="flex items-end justify-between">
                          <p className="text-sm text-gray-900 font-bold">
                            {trip.participants
                              .slice(0, 3)
                              .map((p) => p.name)
                              .join(", ")}
                            {trip.participants.length > 3 && ` и еще ${trip.participants.length - 3}`}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              if (!isLocked) confirmDeleteTrip(trip, e)
                              else {
                                e.preventDefault()
                                e.stopPropagation()
                              }
                            }}
                            disabled={isLocked}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              )
            })
          )}
        </div>

        <Dialog open={isEditTripOpen} onOpenChange={setIsEditTripOpen}>
          <DialogContent className="w-[90vw] max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Редактировать поездку</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="editTripName" className="text-base font-medium">
                  Название поездки
                </Label>
                <Input
                  id="editTripName"
                  value={editTripName}
                  onChange={(e) => setEditTripName(e.target.value)}
                  placeholder="Например: Отпуск в Сочи"
                  className="mt-2"
                />
              </div>

              <div>
                <Label className="text-base font-medium">Участники</Label>
                <div className="space-y-3 mt-3">
                  {editParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center space-x-2">
                      <Input
                        value={participant.name}
                        onChange={(e) => updateEditParticipantName(participant.id, e.target.value)}
                        placeholder="Имя участника"
                        className="flex-1"
                      />
                      {editParticipants.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEditParticipant(participant.id)}
                          className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="ghost"
                    onClick={addEditParticipant}
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
                <Button onClick={saveEditTrip} className="flex-1">
                  Сохранить изменения
                </Button>
                <Button variant="outline" onClick={() => setIsEditTripOpen(false)} className="flex-1">
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить поездку?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Вы уверены, что хотите удалить поездку <strong>{tripToDelete?.name}</strong>?
                </p>
                <p className="text-sm text-red-600 font-medium">
                  Это действие удалит все расходы и данные поездки. Отменить это действие нельзя.
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="destructive" onClick={deleteTrip} className="flex-1">
                  Удалить поездку
                </Button>
                <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1">
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
