import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'
import type { Task } from '../types/task'

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

describe('TaskList', () => {
  it('muestra solo las tareas pendientes cuando se aplica ese filtro', () => {
    render(
      <TaskList
        tasks={tasks}
        filter="pending"
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )

    expect(screen.getByText('Preparar informe')).toBeInTheDocument()
    expect(screen.queryByText('Enviar correo')).not.toBeInTheDocument()
  })

  it('muestra el estado vacío cuando el filtro no coincide con ninguna tarea', () => {
    render(
      <TaskList
        tasks={[tasks[1]]}
        filter="pending"
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )

    expect(screen.getByText('No hay tareas en este filtro todavía.')).toBeInTheDocument()
  })

  it('envía el cambio de estado de la tarea al componente padre', () => {
    const onToggle = vi.fn()
    render(
      <TaskList
        tasks={[tasks[0]]}
        filter="all"
        onToggle={onToggle}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Preparar informe' }))

    expect(onToggle).toHaveBeenCalledWith(tasks[0])
  })

  it('envía los cambios del formulario de edición al componente padre', () => {
    const onUpdate = vi.fn()
    render(
      <TaskList
        tasks={[tasks[0]]}
        filter="all"
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Informe final' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onUpdate).toHaveBeenCalledWith(tasks[0], 'Informe final', 'Revisar las notas')
  })

  it('llama a la acción de eliminar para la tarea elegida', () => {
    const onDelete = vi.fn()
    render(
      <TaskList
        tasks={[tasks[0]]}
        filter="all"
        onToggle={vi.fn()}
        onDelete={onDelete}
        onUpdate={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }))

    expect(onDelete).toHaveBeenCalledWith(tasks[0])
  })
})
