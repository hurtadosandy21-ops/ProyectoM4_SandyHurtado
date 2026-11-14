import { useState } from 'react'
import { auth } from '../services/firebase'
import type { Task } from '../types/task'

interface TaskSummaryProps {
  tasks: Task[]
}

export function TaskSummary({ tasks }: TaskSummaryProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')
  const [sendError, setSendError] = useState('')
  const completedCount = tasks.filter((task) => task.completed).length
  const pendingCount = tasks.length - completedCount

  async function sendSummary() {
    const user = auth.currentUser
    if (!user) {
      setSendError('Inicia sesión para enviar el resumen.')
      return
    }

    setSending(true)
    setSendMessage('')
    setSendError('')
    try {
      const idToken = await user.getIdToken()
      const response = await fetch('/api/send-summary', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      })
      const result = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(result.error ?? 'No se pudo enviar el resumen.')
      setSendMessage(result.message ?? 'Resumen enviado.')
    } catch (reason) {
      setSendError(reason instanceof Error ? reason.message : 'No se pudo enviar el resumen.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="summary-card" aria-labelledby="summary-title">
      <div className="summary-header">
        <div>
          <p className="eyebrow">RESUMEN POR EMAIL</p>
          <h2 id="summary-title">Vista previa</h2>
        </div>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setShowPreview((visible) => !visible)}
          aria-expanded={showPreview}
        >
          {showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
        </button>
      </div>

      <div className="summary-stats" aria-label="Estado de tus tareas">
        <div><strong>{tasks.length}</strong><span>Total</span></div>
        <div><strong>{pendingCount}</strong><span>Pendientes</span></div>
        <div><strong>{completedCount}</strong><span>Completadas</span></div>
      </div>

      {showPreview && (
        <div className="summary-preview">
          {tasks.length === 0 ? (
            <p>No hay tareas para incluir en el resumen.</p>
          ) : (
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  <span>{task.title}</span>
                  <span className="summary-status">
                    {task.completed ? 'Completada' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="summary-note">El resumen se enviará al correo de tu cuenta.</p>
      <button className="button button-primary summary-send" type="button" onClick={sendSummary} disabled={sending}>
        {sending ? 'Enviando…' : 'Enviar resumen a mi correo'}
      </button>
      {sendMessage && <p className="notice success" role="status">{sendMessage}</p>}
      {sendError && <p className="notice error" role="alert">{sendError}</p>}
    </section>
  )
}
