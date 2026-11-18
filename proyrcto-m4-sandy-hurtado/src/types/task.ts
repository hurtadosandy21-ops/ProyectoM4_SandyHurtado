import type { Timestamp } from 'firebase/firestore'

export type TaskPriority = 'urgent' | 'passable' | 'normal'

export interface Task {
  id: string
  userId: string
  title: string
  description: string
  completed: boolean
  createdAt: Timestamp | null
  dueAt?: Timestamp | null
  hasDueTime?: boolean
  reminderAt?: Timestamp | null
  reminderEnabled?: boolean
  reminderSentAt?: Timestamp | null
  timeZone?: string
  priority?: TaskPriority
}

export type TaskFilter = 'all' | 'pending' | 'completed'
