import { beforeEach, describe, expect, it, vi } from 'vitest'

const firestoreMocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  collection: vi.fn(() => 'tasks-collection'),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => 'task-reference'),
  onSnapshot: vi.fn(),
  query: vi.fn(() => 'user-tasks-query'),
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  updateDoc: vi.fn(),
  where: vi.fn(() => 'user-filter'),
}))

vi.mock('firebase/firestore', () => firestoreMocks)
vi.mock('./firebase', () => ({ db: {} }))

import { createTask, removeTask, updateTask } from './tasks'

describe('tasks service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guarda la tarea asociada al usuario y recorta los campos de texto', async () => {
    firestoreMocks.addDoc.mockResolvedValue({ id: 'new-task' })

    await createTask('user-1', '  Preparar informe  ', '  Revisar notas  ')

    expect(firestoreMocks.addDoc).toHaveBeenCalledWith('tasks-collection', {
      userId: 'user-1',
      title: 'Preparar informe',
      description: 'Revisar notas',
      completed: false,
      createdAt: 'server-timestamp',
    })
  })

  it('actualiza solo los datos de la tarea indicada', async () => {
    firestoreMocks.updateDoc.mockResolvedValue(undefined)

    await updateTask('task-1', {
      title: '  Informe final  ',
      description: '  Listo  ',
      completed: true,
    })

    expect(firestoreMocks.doc).toHaveBeenCalledWith({}, 'tasks', 'task-1')
    expect(firestoreMocks.updateDoc).toHaveBeenCalledWith('task-reference', {
      title: 'Informe final',
      description: 'Listo',
      completed: true,
      updatedAt: 'server-timestamp',
    })
  })

  it('elimina el documento de tarea seleccionado', async () => {
    firestoreMocks.deleteDoc.mockResolvedValue(undefined)

    await removeTask('task-1')

    expect(firestoreMocks.doc).toHaveBeenCalledWith({}, 'tasks', 'task-1')
    expect(firestoreMocks.deleteDoc).toHaveBeenCalledWith('task-reference')
  })
})
