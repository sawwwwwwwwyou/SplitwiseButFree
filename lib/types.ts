export interface Trip {
  id: string
  name: string
  participants: string[]
  createdAt: string
}

export interface Expense {
  id: string
  description: string
  date: string
  totalAmount: number
  payers: { [participant: string]: number }
  shares: { [participant: string]: number }
  createdAt?: string
}
