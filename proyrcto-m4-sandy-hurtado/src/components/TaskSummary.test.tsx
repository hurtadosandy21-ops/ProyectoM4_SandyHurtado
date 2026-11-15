import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskSummary } from './TaskSummary'
import type { Task } from '../types/task'

const { getIdTokenMock } = vi.hoisted(() => ({ getIdTokenMock: vi.fn() }))

vi.mock('../services/firebase', () => ({
  auth: { currentUser: { getIdToken: getIdTokenMock } },
}))

const tasks: Task[] = [
  {
    id: 'task-pending',
    userId: 'user-1',
    title: 'Preparar informe',
    description: 'Revisar las notas',
    completed: false,
    createdAt: null,
  },
  {
    id: 'task-completed',
    userId: 'user-1',
    title: 'Enviar correo',
    description: '',
    completed: true,
    createdAt: null,
  },
]

const fetchMock = vi.fn()

describe('TaskSummary', () => {
  beforeEach(() => {
    getIdTokenMock.mockResolvedValue('firebase-token')
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('muestra los totales y permite abrir la vista previa', () => {
    render(<TaskSummary tasks={tasks} />)

    expect(screen.getByLabelText('Estado de tus tareas')).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', { name: 'Ver vista previa' }))

    expect(screen.getByText('Preparar informe')).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar vista previa' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('envía la petición autenticada y muestra confirmación', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'El resumen fue enviado a tu correo.' }),
    })
    render(<TaskSummary tasks={tasks} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen a mi correo' }))

    expect(await screen.findByRole('status')).toHaveTextContent('El resumen fue enviado a tu correo.')
    expect(fetchMock).toHaveBeenCalledWith('/api/send-summary', {
      method: 'POST',
      headers: { Authorization: 'Bearer firebase-token' },
    })
  })

  it('presenta el error que devuelve el servidor', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Verifica tu correo antes de enviar el resumen.' }),
    })
    render(<TaskSummary tasks={tasks} />)

    fireEvent.click(screen.getByRole('button', { name: 'Enviar resumen a mi correo' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Verifica tu correo antes de enviar el resumen.')
  })
})
