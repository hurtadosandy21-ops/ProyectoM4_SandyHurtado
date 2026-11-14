import { useState, type FormEvent } from 'react'
import type { Task, TaskFilter } from '../types/task'

interface TaskListProps {
  tasks: Task[]
  filter: TaskFilter
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
  onUpdate: (task: Task, title: string, description: string) => void
}

export function TaskList({ tasks, filter, onToggle, onDelete, onUpdate }: TaskListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'pending') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  function startEditing(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description)
  }

  function saveEdit(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault()
    const title = editTitle.trim()
    if (!title) return
    onUpdate(task, title, editDescription)
    setEditingId(null)
  }

  if (visibleTasks.length === 0) {
    return <p className="empty-state">No hay tareas en este filtro todavía.</p>
  }

  return (
    <ul className="task-list">
      {visibleTasks.map((task) => (
        <li className={`task-card${task.completed ? ' is-complete' : ''}`} key={task.id}>
          {editingId === task.id ? (
            <form className="edit-form" onSubmit={(event) => saveEdit(event, task)}>
              <label>
                Título
                <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} required />
              </label>
              <label>
                Descripción
                <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} />
              </label>
              <div className="task-actions">
                <button className="button button-primary" type="submit">Guardar</button>
                <button className="button button-quiet" type="button" onClick={() => setEditingId(null)}>Cancelar</button>
              </div>
            </form>
          ) : (
            <>
              <div className="task-content">
                <label className="task-check">
                  <input type="checkbox" checked={task.completed} onChange={() => onToggle(task)} />
                  <span>{task.title}</span>
                </label>
                {task.description && <p>{task.description}</p>}
              </div>
              <div className="task-actions">
                <button className="button button-quiet" type="button" onClick={() => startEditing(task)}>Editar</button>
                <button className="button button-danger" type="button" onClick={() => onDelete(task)}>Eliminar</button>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}
