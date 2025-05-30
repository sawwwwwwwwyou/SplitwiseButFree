import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncateName(name: string, maxLength = 7): string {
  if (!name) return ""
  return name.length <= maxLength ? name : name.substring(0, maxLength - 1) + "..."
}

export function getExpenseIcon(description: string | undefined): { icon: string; color: string; iconColor: string } {
  if (!description) return { icon: "📄", color: "bg-blue-100", iconColor: "text-blue-700" }
  const desc = description.toLowerCase().trim()
  if (
    desc.includes("такси") ||
    desc.includes("taxi") ||
    desc.includes("трансфер") ||
    desc.includes("убер") ||
    desc.includes("uber") ||
    desc.includes("яндекс") ||
    desc.includes("автобус") ||
    desc.includes("метро") ||
    desc.includes("поезд")
  )
    return { icon: "🚗", color: "bg-blue-100", iconColor: "text-blue-600" }
  if (
    desc.includes("ресторан") ||
    desc.includes("еда") ||
    desc.includes("мак") ||
    desc.includes("макдак") ||
    desc.includes("макдоналдс") ||
    desc.includes("старбакс") ||
    desc.includes("кофе") ||
    desc.includes("магаз") ||
    desc.includes("супермаркет") ||
    desc.includes("доставка") ||
    desc.includes("пицца") ||
    desc.includes("бургер") ||
    desc.includes("кафе") ||
    desc.includes("обед") ||
    desc.includes("ужин") ||
    desc.includes("завтрак") ||
    desc.includes("продукты") ||
    desc.includes("grocery")
  )
    return { icon: "🍓", color: "bg-red-100", iconColor: "text-red-600" }
  if (
    desc.includes("бензин") ||
    desc.includes("бенз") ||
    desc.includes("заправка") ||
    desc.includes("топливо") ||
    desc.includes("газ") ||
    desc.includes("fuel") ||
    desc.includes("gas")
  )
    return { icon: "⛽", color: "bg-green-100", iconColor: "text-green-600" }
  if (
    desc.includes("доллар") ||
    desc.includes("dollar") ||
    desc.includes("деньги") ||
    desc.includes("money") ||
    desc.includes("банк") ||
    desc.includes("bank") ||
    desc.includes("обмен") ||
    desc.includes("валют")
  )
    return { icon: "💵", color: "bg-green-800", iconColor: "text-green-100" }
  if (
    desc.includes("билет") ||
    desc.includes("самолет") ||
    desc.includes("авиа") ||
    desc.includes("flight") ||
    desc.includes("plane") ||
    desc.includes("airport") ||
    desc.includes("аэропорт") ||
    desc.includes("перелет")
  )
    return { icon: "✈️", color: "bg-sky-100", iconColor: "text-sky-600" }
  if (
    desc.includes("парк") ||
    desc.includes("пропуск") ||
    desc.includes("кемпинг") ||
    desc.includes("палатк") ||
    desc.includes("camping") ||
    desc.includes("tent") ||
    desc.includes("отдых") ||
    desc.includes("природа") ||
    desc.includes("поход")
  )
    return { icon: "🏕️", color: "bg-emerald-100", iconColor: "text-emerald-600" }
  if (
    desc.includes("home") ||
    desc.includes("airbnb") ||
    desc.includes("hotel") ||
    desc.includes("отель") ||
    desc.includes("гостиница") ||
    desc.includes("квартира") ||
    desc.includes("жилье")
  )
    return { icon: "🏠", color: "bg-indigo-100", iconColor: "text-indigo-600" }
  if (
    desc.includes("ring") ||
    desc.includes("circle") ||
    desc.includes("кольцо") ||
    desc.includes("украшение") ||
    desc.includes("jewelry")
  )
    return { icon: "💍", color: "bg-purple-100", iconColor: "text-purple-600" }
  return { icon: "📄", color: "bg-blue-100", iconColor: "text-blue-700" }
}
