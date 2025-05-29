"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Lock, ArrowLeft } from "lucide-react"
import { verifyPin, saveUnlockedTrip, isTripUnlocked } from "@/lib/pin-utils"
import Link from "next/link"

interface PinLockScreenProps {
  tripId: string
  tripName: string
  pinHash: string
  onUnlock: () => void
}

export function PinLockScreen({ tripId, tripName, pinHash, onUnlock }: PinLockScreenProps) {
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Проверяем, разблокирована ли уже поездка
    if (isTripUnlocked(tripId)) {
      onUnlock()
    }
  }, [tripId, onUnlock])

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Разрешаем только цифры
    const value = e.target.value.replace(/\D/g, "")
    setPin(value)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (pin.length !== 4) {
      setError("PIN-код должен состоять из 4 цифр")
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const isValid = await verifyPin(pin, tripId, pinHash)

      if (isValid) {
        saveUnlockedTrip(tripId)
        onUnlock()
      } else {
        setError("Неверный PIN-код")
      }
    } catch (err) {
      console.error("Ошибка при проверке PIN-кода:", err)
      setError("Произошла ошибка при проверке PIN-кода")
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="absolute left-4 top-4">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
          </Link>
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-xl">{tripName}</CardTitle>
          <CardDescription>Введите PIN-код для доступа к поездке</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={handlePinChange}
                placeholder="Введите 4-значный PIN-код"
                className="text-center text-2xl tracking-widest"
              />
              {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pin.length !== 4 || isChecking}>
              {isChecking ? "Проверка..." : "Разблокировать"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
