import { useState } from 'react'
import { auth } from '../services/firebase'
import type { Task } from '../types/task'

interface TaskSummaryProps {
  tasks: Task[]
  name?: string
}

export function TaskSummary({ tasks, name }: TaskSummaryProps) {
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
      const responseText = await response.text()
      const contentType = response.headers.get('content-type') ?? ''
      let result: { message?: string; error?: string } | null = null
      if (responseText && contentType.includes('application/json')) {
        try {
          result = JSON.parse(responseText) as { message?: string; error?: string }
        } catch {
          result = null
        }
      }

      if (!result) {
        if (response.status === 404 || contentType.includes('text/html')) {
          throw new Error('No se encontró la API de envío. Para probar el correo localmente, inicia el proyecto con Vercel CLI; npm run dev solo inicia la interfaz de Vite.')
        }
        throw new Error(`El servidor no devolvió una respuesta válida (HTTP ${response.status}). Revisa los logs de /api/send-summary en Vercel.`)
      }
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
          <h2 id="summary-title">Tu correo de resumen</h2>
        </div>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setShowPreview((visible) => !visible)}
          aria-expanded={showPreview}
          aria-controls="email-preview"
        >
          {showPreview ? 'Cerrar vista previa' : 'Mostrar vista previa del correo'}
        </button>
      </div>

      <div className="summary-stats" aria-label="Estado de tus tareas">
        <div><strong>{tasks.length}</strong><span>Total</span></div>
        <div><strong>{pendingCount}</strong><span>Pendientes</span></div>
        <div><strong>{completedCount}</strong><span>Completadas</span></div>
      </div>

      {showPreview && (
        <div className="summary-preview" id="email-preview">
          <article className="email-preview-card" aria-label="Vista previa del correo de resumen">
            <header className="email-preview-header">
              <p>MIS TAREAS</p>
              <h3>Tu resumen está listo</h3>
              <span>{name ? `Hola, ${name}. Aquí tienes el avance de tu lista.` : 'Aquí tienes el avance de tu lista.'}</span>
            </header>
            <div className="email-preview-body">
              <div className="email-preview-stats" aria-label="Conteo de tareas en el correo">
                <div><strong>{tasks.length}</strong><span>Total</span></div>
                <div><strong>{pendingCount}</strong><span>Pendientes</span></div>
                <div><strong>{completedCount}</strong><span>Completadas</span></div>
              </div>
              <h3>Detalle de tareas</h3>
              {tasks.length === 0 ? (
                <p className="email-preview-empty">Todavía no tienes tareas. Cuando agregues una, aparecerá aquí.</p>
              ) : (
                <ul className="email-preview-list">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        {task.description && <p>{task.description}</p>}
                      </div>
                      <span className={task.completed ? 'email-status completed' : 'email-status pending'}>
                        {task.completed ? 'Completada' : 'Pendiente'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="email-preview-footer">Mensaje automático de Mis tareas.<br />Este correo resume la información guardada en tu cuenta.</footer>
          </article>
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
