import { useState, type FormEvent } from 'react'
import type { Task, TaskFilter, TaskPriority } from '../types/task'

interface TaskListProps {
  tasks: Task[]
  filter: TaskFilter
  onToggle: (task: Task) => void
  onDelete: (task: Task) => void
  onUpdate: (task: Task, title: string, description: string, dueAt: Date | null, hasDueTime: boolean, priority: TaskPriority, reminderEnabled: boolean, timeZone: string) => void
}

function toLocalDateTimeInput(value: Task['dueAt']): string {
  if (!value) return ''
  const date = value.toDate()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function toLocalDateInput(value: Task['dueAt']): string {
  return toLocalDateTimeInput(value).slice(0, 10)
}

function toLocalTimeInput(value: Task['dueAt']): string {
  return toLocalDateTimeInput(value).slice(11, 16)
}

function localDateValue(daysFromToday = 0): string {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function formatTaskDate(value: Task['createdAt'] | Task['dueAt']): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(value.toDate())
}

function formatTaskDeadline(task: Task): string {
  if (!task.dueAt) return ''
  const options: Intl.DateTimeFormatOptions = task.hasDueTime === false
    ? { dateStyle: 'medium' }
    : { dateStyle: 'medium', timeStyle: 'short' }
  try {
    return new Intl.DateTimeFormat('es-EC', { ...options, timeZone: task.timeZone }).format(task.dueAt.toDate())
  } catch {
    return new Intl.DateTimeFormat('es-EC', options).format(task.dueAt.toDate())
  }
}

export function TaskList({ tasks, filter, onToggle, onDelete, onUpdate }: TaskListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editDatePreset, setEditDatePreset] = useState<'today' | 'tomorrow' | 'custom'>('today')
  const [editDueTime, setEditDueTime] = useState('')
  const [editDateError, setEditDateError] = useState('')
  const [editReminderEnabled, setEditReminderEnabled] = useState(false)
  const [editPriority, setEditPriority] = useState<TaskPriority>('normal')

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'pending') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  function startEditing(task: Task) {
    setEditingId(task.id)
    setEditTitle(task.title)
    setEditDescription(task.description)
    const taskDate = task.dueAt ? toLocalDateInput(task.dueAt) : localDateValue()
    setEditDueDate(taskDate)
    setEditDatePreset(taskDate === localDateValue() ? 'today' : taskDate === localDateValue(1) ? 'tomorrow' : 'custom')
    setEditDueTime(task.hasDueTime === false ? '' : toLocalTimeInput(task.dueAt))
    setEditDateError('')
    setEditReminderEnabled(task.reminderEnabled === true)
    setEditPriority(task.priority ?? 'normal')
  }

  function saveEdit(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault()
    const title = editTitle.trim()
    if (!title) return
    const dueAt = editDueDate ? new Date(`${editDueDate}T${editDueTime || '23:59:59'}`) : null
    if (editDueTime && !editDueDate) {
      setEditDateError('Elige una fecha para la hora límite seleccionada.')
      return
    }
    if (dueAt && dueAt.getTime() <= Date.now()) {
      setEditDateError('La fecha y hora límite debe ser posterior al momento actual.')
      return
    }
    setEditDateError('')
    onUpdate(
      task,
      title,
      editDescription,
      dueAt,
      Boolean(dueAt && editDueTime),
      editPriority,
      Boolean(dueAt && editReminderEnabled),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
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
              <label>
                Prioridad
                <select className="priority-select" value={editPriority} onChange={(event) => setEditPriority(event.target.value as TaskPriority)}>
                  <option value="urgent">Urgente</option>
                  <option value="passable">Pasable</option>
                  <option value="normal">Normal</option>
                </select>
              </label>
              <div className="deadline-picker">
                <span className="deadline-label">Fecha límite</span>
                <div className="deadline-presets" role="group" aria-label="Elegir fecha límite">
                  <button className={editDatePreset === 'today' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setEditDatePreset('today'); setEditDueDate(localDateValue()); setEditDateError('') }}>Hoy</button>
                  <button className={editDatePreset === 'tomorrow' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setEditDatePreset('tomorrow'); setEditDueDate(localDateValue(1)); setEditDateError('') }}>Mañana</button>
                  <button className={editDatePreset === 'custom' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setEditDatePreset('custom'); if (!editDueDate) setEditDueDate(localDateValue()); setEditDateError('') }}>Elegir fecha</button>
                </div>
                {editDatePreset === 'custom' && <label className="custom-date-field">
                  Personalizar fecha
                  <input type="date" value={editDueDate} onChange={(event) => { setEditDueDate(event.target.value); setEditDateError('') }} />
                </label>}
                <label>
                  Hora límite <span className="optional">(opcional)</span>
                  <input type="time" value={editDueTime} onChange={(event) => { setEditDueTime(event.target.value); setEditDateError('') }} />
                </label>
              </div>
              {editDateError && <p className="notice error" role="alert">{editDateError}</p>}
              <label className="reminder-toggle">
                <input type="checkbox" checked={editReminderEnabled} disabled={!editDueTime} onChange={(event) => setEditReminderEnabled(event.target.checked)} />
                Enviarme recordatorio por correo cuando se acerque la fecha
              </label>
              {editDueTime && editReminderEnabled && <p className="reminder-note">Si sigue pendiente, enviaremos un recordatorio cuando falten cerca de 48 horas. El sistema revisa los avisos una vez al día, así que el envío puede tardar hasta alrededor de 24 horas. Programa la tarea con al menos 2 días de anticipación y revisa Recibidos, Promociones y Spam.</p>}
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
                  <span className="task-title">{task.title}</span>
                  <span className={`task-priority-badge priority-${task.priority ?? 'normal'}`}>{task.priority === 'urgent' ? 'Urgente' : task.priority === 'passable' ? 'Pasable' : 'Normal'}</span>
                </label>
                {task.description && <p>{task.description}</p>}
                <div className="task-meta">
                  {task.createdAt && <span>Agregada: {formatTaskDate(task.createdAt)}</span>}
                  {task.dueAt && <span className={!task.completed && task.dueAt.toMillis() < Date.now() ? 'task-deadline overdue' : 'task-deadline'}>Entrega: {formatTaskDeadline(task)}{task.hasDueTime === false ? ' · sin hora definida' : ''}</span>}
                  {task.reminderEnabled && task.dueAt && !task.completed && !task.reminderSentAt && <span className="task-reminder-meta">Recordatorio por correo activado</span>}
                  {task.reminderSentAt && <span className="task-reminder-meta">Recordatorio enviado</span>}
                </div>
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
