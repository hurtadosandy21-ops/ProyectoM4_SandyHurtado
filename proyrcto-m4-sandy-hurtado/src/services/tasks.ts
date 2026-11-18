import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Task, TaskPriority } from '../types/task'

const tasksCollection = collection(db, 'tasks')

function timestampMillis(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (value instanceof Date) return value.getTime()
  if (
    value !== null &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof value.toMillis === 'function'
  ) {
    return value.toMillis()
  }
  return 0
}

export function subscribeToTasks(
  userId: string,
  onTasks: (tasks: Task[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const userTasksQuery = query(tasksCollection, where('userId', '==', userId))

  return onSnapshot(
    userTasksQuery,
    (snapshot) => {
      try {
        const tasks = snapshot.docs.map((taskDoc) => {
          const data = taskDoc.data()
          return {
            id: taskDoc.id,
            userId: data.userId as string,
            title: data.title as string,
            description: (data.description as string | undefined) ?? '',
            completed: Boolean(data.completed),
            createdAt: data.createdAt ?? null,
            dueAt: data.dueAt ?? null,
            hasDueTime: data.hasDueTime !== false,
            reminderAt: data.reminderAt ?? null,
            reminderEnabled: data.reminderEnabled === true,
            reminderSentAt: data.reminderSentAt ?? null,
            timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'UTC',
            priority: data.priority === 'urgent' || data.priority === 'passable' ? data.priority : 'normal',
          }
        })
        tasks.sort(
          (a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt),
        )
        onTasks(tasks)
      } catch (reason) {
        onError(
          reason instanceof Error
            ? reason
            : new Error('No se pudieron procesar los documentos de tareas.'),
        )
      }
    },
    onError,
  )
}

export function createTask(
  userId: string,
  title: string,
  description: string,
  dueAt: Date | null = null,
  reminderEnabled = false,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  hasDueTime = Boolean(dueAt),
  priority: TaskPriority = 'normal',
) {
  const shouldRemind = Boolean(dueAt && hasDueTime && reminderEnabled)
  return addDoc(tasksCollection, {
    userId,
    title: title.trim(),
    description: description.trim(),
    completed: false,
    createdAt: serverTimestamp(),
    dueAt: dueAt ? Timestamp.fromDate(dueAt) : null,
    hasDueTime,
    reminderEnabled: shouldRemind,
    reminderAt: shouldRemind && dueAt
      ? Timestamp.fromDate(new Date(dueAt.getTime() - 48 * 60 * 60 * 1000))
      : null,
    reminderSentAt: null,
    timeZone,
    priority,
  })
}

type TaskChanges = Partial<Pick<Task, 'title' | 'description' | 'completed' | 'reminderEnabled' | 'timeZone' | 'hasDueTime' | 'priority'>> & {
  dueAt?: Date | null
}

export function updateTask(
  taskId: string,
  changes: TaskChanges,
) {
  const payload: Record<string, unknown> = {
    ...changes,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.description !== undefined
      ? { description: changes.description.trim() }
      : {}),
    updatedAt: serverTimestamp(),
  }

  if (changes.dueAt !== undefined) {
    const hasDueTime = changes.hasDueTime ?? true
    const shouldRemind = Boolean(changes.dueAt && hasDueTime && changes.reminderEnabled)
    payload.dueAt = changes.dueAt ? Timestamp.fromDate(changes.dueAt) : null
    payload.reminderEnabled = shouldRemind
    payload.reminderAt = shouldRemind && changes.dueAt
      ? Timestamp.fromDate(new Date(changes.dueAt.getTime() - 48 * 60 * 60 * 1000))
      : null
    payload.reminderSentAt = null
    payload.timeZone = changes.timeZone ?? 'UTC'
  }

  if (changes.completed === false) payload.reminderSentAt = null

  return updateDoc(doc(db, 'tasks', taskId), {
    ...payload,
  })
}

export function removeTask(taskId: string) {
  return deleteDoc(doc(db, 'tasks', taskId))
}
