export interface Participant {
  id: string
  name: string
}

export interface Trip {
  id: string
  name: string
  participants: Participant[]
  createdAt: string
  pinHash?: string // Хеш PIN-кода для защиты поездки
}

export interface Expense {
  id: string
  description: string
  date: string
  totalAmount: number
  payers: { [participantId: string]: number }
  shares: { [participantId: string]: number }
  createdAt?: string
}
