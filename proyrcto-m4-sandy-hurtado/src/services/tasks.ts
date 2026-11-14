import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Task } from '../types/task'

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

export function createTask(userId: string, title: string, description: string) {
  return addDoc(tasksCollection, {
    userId,
    title: title.trim(),
    description: description.trim(),
    completed: false,
    createdAt: serverTimestamp(),
  })
}

export function updateTask(
  taskId: string,
  changes: Partial<Pick<Task, 'title' | 'description' | 'completed'>>,
) {
  return updateDoc(doc(db, 'tasks', taskId), {
    ...changes,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(changes.description !== undefined
      ? { description: changes.description.trim() }
      : {}),
    updatedAt: serverTimestamp(),
  })
}

export function removeTask(taskId: string) {
  return deleteDoc(doc(db, 'tasks', taskId))
}
