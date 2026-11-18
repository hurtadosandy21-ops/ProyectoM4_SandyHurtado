import { useState } from 'react'
import type { Task } from '../types/task'

interface NotificationCenterProps {
  tasks: Task[]
  email: string
}

function formatDate(value: Date, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'full',
      timeStyle: 'short',
      ...(timeZone ? { timeZone } : {}),
    }).format(value)
  } catch {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'full', timeStyle: 'short' }).format(value)
  }
}

function reminderMoment(task: Task): Date {
  return task.reminderAt?.toDate() ?? new Date(task.dueAt!.toMillis() - 48 * 60 * 60 * 1000)
}

export function NotificationCenter({ tasks, email }: NotificationCenterProps) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const pending = tasks
    .filter((task) => !task.completed && task.reminderEnabled === true && task.dueAt && task.dueAt.toMillis() > Date.now() && !task.reminderSentAt)
    .sort((a, b) => reminderMoment(a).getTime() - reminderMoment(b).getTime())
  const sent = tasks
    .filter((task) => task.reminderSentAt)
    .sort((a, b) => (b.reminderSentAt?.toMillis() ?? 0) - (a.reminderSentAt?.toMillis() ?? 0))
  const previewTask = tasks.find((task) => task.id === previewId)

  function closePreview() {
    setShowPreview(false)
    setPreviewId(null)
  }

  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <header className="notifications-heading">
        <div>
          <p className="eyebrow">AVISOS DE TUS TAREAS</p>
          <h1 id="notifications-title">Notificaciones</h1>
          <p>Consulta los recordatorios programados y revisa cómo se verá el correo antes de que se envíe.</p>
        </div>
        <button className="button button-quiet" type="button" aria-expanded={showPreview} onClick={() => { if (showPreview) closePreview(); else setShowPreview(true) }}>
          {showPreview ? 'Cerrar vista previa' : 'Ver vista previa'}
        </button>
      </header>

      <section className="notification-panel" aria-labelledby="scheduled-notifications-title">
        <div className="notification-panel-heading">
          <div>
            <h2 id="scheduled-notifications-title">Recordatorios programados</h2>
            <p>Se envían una sola vez si la tarea sigue pendiente, cuando falten cerca de 48 horas. El sistema revisa los avisos una vez al día, por lo que el correo puede tardar hasta alrededor de 24 horas. Programa con al menos 2 días de anticipación y revisa Recibidos, Promociones y Spam.</p>
          </div>
          <span className="notification-count">{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <p className="empty-state">No tienes recordatorios pendientes. Al agregar o editar una tarea, indica su fecha límite y activa el aviso por correo.</p>
        ) : (
          <ul className="notification-list">
            {pending.map((task) => {
              const dueAt = task.dueAt!.toDate()
              const scheduledAt = reminderMoment(task)
              const ready = scheduledAt.getTime() <= Date.now()
              const expanded = showPreview && previewId === task.id
              return (
                <li className="notification-item" key={task.id}>
                  <div className="notification-item-copy">
                    <strong>{task.title}</strong>
                    <span>Fecha límite: {formatDate(dueAt, task.timeZone)}</span>
                    <span>{ready ? 'Se enviará en la próxima revisión' : `Aviso programado: ${formatDate(scheduledAt, task.timeZone)}`}</span>
                  </div>
                  <button
                    className="button button-quiet notification-preview-button"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                      if (expanded) closePreview()
                      else { setPreviewId(task.id); setShowPreview(true) }
                    }}
                  >
                    {expanded ? 'Cerrar vista previa' : 'Ver vista previa'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {showPreview && <section className="notification-preview-section" id="notification-preview" aria-labelledby="notification-preview-title">
          <div className="notification-preview-label">
            <div>
              <p className="eyebrow">VISTA PREVIA</p>
              <h2 id="notification-preview-title">Correo de recordatorio</h2>
            </div>
            <div className="notification-preview-actions">
              {previewTask && <button className="button button-quiet" type="button" onClick={() => setPreviewId(null)}>Ver ejemplo</button>}
              <button className="button button-quiet" type="button" onClick={closePreview}>Cerrar vista previa</button>
            </div>
          </div>
          <article className="email-preview-card notification-email-preview" aria-label="Vista previa del recordatorio por correo">
            <header className="email-preview-header">
              <p>MIS TAREAS</p>
              <h3>Se acerca la fecha de entrega</h3>
              <span>Estas tareas todavía aparecen como pendientes.</span>
            </header>
            <div className="email-preview-body">
              <p className="notification-recipient"><strong>Para:</strong> {email}</p>
              <p className="notification-subject"><strong>Asunto:</strong> Recordatorio: tienes tareas pendientes</p>
              <p className="notification-preview-disclaimer">{previewTask ? 'Vista previa de este recordatorio. Si otros avisos coinciden en la misma revisión, el correo puede incluir más tareas.' : 'Ejemplo del correo que se enviará cuando programes un recordatorio para una tarea pendiente.'} El sistema revisa los avisos una vez al día. Revisa también Recibidos, Promociones y Spam.</p>
              <div className="notification-task-preview">
                <strong>{previewTask?.title ?? 'Preparar informe'}</strong>
                <span>{previewTask?.dueAt ? `Fecha límite: ${formatDate(previewTask.dueAt.toDate(), previewTask.timeZone)}` : 'Fecha límite: la fecha y hora que selecciones'}</span>
                {previewTask?.description
                  ? <p>{previewTask.description}</p>
                  : !previewTask && <p>Completa esta tarea antes de la fecha límite que elegiste.</p>}
              </div>
            </div>
            <footer className="email-preview-footer">Te enviamos este aviso una sola vez por tarea. Si ya la completaste, puedes ignorarlo. Si no aparece en tu bandeja, revisa Spam y Promociones.</footer>
          </article>
      </section>}

      <section className="notification-panel notification-history" aria-labelledby="sent-notifications-title">
        <div className="notification-panel-heading">
          <div>
            <h2 id="sent-notifications-title">Recordatorios enviados</h2>
            <p>Historial de avisos que ya salieron por correo.</p>
          </div>
          <span className="notification-count">{sent.length}</span>
        </div>
        {sent.length === 0 ? (
          <p className="empty-state">Todavía no se ha enviado ningún recordatorio.</p>
        ) : (
          <ul className="notification-list">
            {sent.map((task) => (
              <li className="notification-item" key={task.id}>
                <div className="notification-item-copy">
                  <strong>{task.title}</strong>
                  {task.reminderSentAt && <span>Enviado: {formatDate(task.reminderSentAt.toDate(), task.timeZone)}</span>}
                </div>
                <span className="notification-sent-badge">Enviado</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
