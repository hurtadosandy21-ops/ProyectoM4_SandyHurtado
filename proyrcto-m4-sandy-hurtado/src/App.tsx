import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './services/firebase'
import { createTask, removeTask, subscribeToTasks, updateTask } from './services/tasks'
import { TaskList } from './components/TaskList'
import { TaskSummary } from './components/TaskSummary'
import { NotificationCenter } from './components/NotificationCenter'
import { AppFooter } from './components/AppFooter'
import type { Task, TaskFilter, TaskPriority } from './types/task'

type AuthMode = 'login' | 'register'
type AppView = 'add' | 'tasks' | 'summary' | 'notifications'
type DatePreset = 'today' | 'tomorrow' | 'custom'
type Confirmation = { kind: 'complete' | 'delete'; task: Task }

function localDateValue(daysFromToday = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.'
}

function dateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function reminderDateLabel(task: Task, now: Date) {
  if (!task.dueAt) return 'Sin fecha límite definida'
  const timeZone = task.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const dueAt = task.dueAt.toDate()
  let dayLabel = 'Fecha límite'
  try {
    const todayKey = dateKeyInTimeZone(now, timeZone)
    const dueKey = dateKeyInTimeZone(dueAt, timeZone)
    if (dueKey === todayKey) dayLabel = 'Hoy'
    else if (dueKey === addDaysToDateKey(todayKey, 1)) dayLabel = 'Mañana'
  } catch {
    // Use the browser locale if a saved time zone is no longer recognized.
  }
  let time = ''
  try {
    time = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit', timeZone }).format(dueAt)
  } catch {
    time = new Intl.DateTimeFormat('es-EC', { hour: 'numeric', minute: '2-digit' }).format(dueAt)
  }
  return task.hasDueTime === false ? `${dayLabel} · sin hora definida` : `${dayLabel} · límite ${time}`
}

function priorityLabel(priority: TaskPriority | undefined) {
  if (priority === 'urgent') return 'Urgente'
  if (priority === 'passable') return 'Pasable'
  return 'Normal'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState(() => localDateValue())
  const [datePreset, setDatePreset] = useState<DatePreset>('today')
  const [dueTime, setDueTime] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [taskData, setTaskData] = useState<{ userId: string; tasks: Task[] } | null>(null)
  const [tasksLoadFailed, setTasksLoadFailed] = useState(false)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [view, setView] = useState<AppView>('add')
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [welcomeReminderTasks, setWelcomeReminderTasks] = useState<Task[]>([])
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const welcomeReminderShownFor = useRef<string | null>(null)
  const [skipConfirmations, setSkipConfirmations] = useState(() => {
    try {
      return localStorage.getItem('mis-tareas-skip-confirmations') === 'true'
    } catch {
      return false
    }
  })
  const tasks = user && taskData?.userId === user.uid ? taskData.tasks : []

  useEffect(() => {
    if (!menuOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        welcomeReminderShownFor.current = null
        setWelcomeReminderTasks([])
        setShowWelcomeMessage(false)
      } else if (welcomeReminderShownFor.current !== currentUser.uid) {
        setWelcomeReminderTasks([])
        setShowWelcomeMessage(false)
      }
      setUser(currentUser)
      setAuthReady(true)
      setError('')
      if (!currentUser) {
        setTaskData(null)
        setTasksLoadFailed(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!user || tasksLoadFailed || taskData?.userId !== user.uid || welcomeReminderShownFor.current === user.uid) return

    welcomeReminderShownFor.current = user.uid
    const now = new Date()
    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const todayKey = dateKeyInTimeZone(now, localTimeZone)
    const tomorrowKey = addDaysToDateKey(todayKey, 1)
    const pendingTasks = taskData.tasks.filter((task) => !task.completed)
    const dueSoon = pendingTasks
      .filter((task) => {
        if (!task.dueAt) return true
        const timeZone = task.timeZone || localTimeZone
        try {
          const taskTodayKey = dateKeyInTimeZone(now, timeZone)
          const dueKey = dateKeyInTimeZone(task.dueAt.toDate(), timeZone)
          return dueKey === taskTodayKey || dueKey === addDaysToDateKey(taskTodayKey, 1)
        } catch {
          const dueKey = dateKeyInTimeZone(task.dueAt.toDate(), localTimeZone)
          return dueKey === todayKey || dueKey === tomorrowKey
        }
      })
      .sort((a, b) => (a.dueAt?.toMillis() ?? 0) - (b.dueAt?.toMillis() ?? 0))

    if (dueSoon.length > 0) setWelcomeReminderTasks(dueSoon)
    else if (pendingTasks.length === 0) setShowWelcomeMessage(true)
  }, [user, taskData, tasksLoadFailed])

  useEffect(() => {
    if (!user) {
      return
    }

    return subscribeToTasks(
      user.uid,
      (nextTasks) => {
        setTasksLoadFailed(false)
        setTaskData({ userId: user.uid, tasks: nextTasks })
      },
      (reason) => {
        setTasksLoadFailed(true)
        setError(`No se pudieron cargar las tareas: ${reason.message}`)
        setTaskData({ userId: user.uid, tasks: [] })
      },
    )
  }, [user])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setAuthMessage('')
    try {
      if (authMode === 'register') {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        await sendEmailVerification(credential.user)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      setPassword('')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true)
    setError('')
    setAuthMessage('')
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (reason) {
      const code = typeof reason === 'object' && reason !== null && 'code' in reason
        ? String(reason.code)
        : ''
      if (code === 'auth/operation-not-allowed') {
        setError('El acceso con Google aún no está activado en Firebase Authentication.')
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Se cerró la ventana de Google antes de completar el acceso.')
      } else {
        setError(errorMessage(reason))
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleResendVerification() {
    if (!user) return
    setBusy(true)
    setError('')
    setAuthMessage('')
    try {
      await sendEmailVerification(user)
      setAuthMessage(`Enviamos un nuevo enlace de verificación a ${user.email}.`)
    } catch (reason) {
      setError(`No se pudo enviar el enlace: ${errorMessage(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckVerification() {
    if (!user) return
    setBusy(true)
    setError('')
    setAuthMessage('')
    try {
      await reload(user)
      const refreshedUser = auth.currentUser
      if (refreshedUser?.emailVerified) {
        await refreshedUser.getIdToken(true)
        setUser(refreshedUser)
        setAuthMessage('Correo verificado. Ya puedes usar tus tareas.')
      } else {
        setError('Aún no aparece verificado. Abre el enlace del correo y vuelve a intentarlo.')
      }
    } catch (reason) {
      setError(`No se pudo comprobar la verificación: ${errorMessage(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordReset() {
    setError('')
    setAuthMessage('')
    if (!email.trim()) {
      setError('Escribe tu correo electrónico para enviarte el enlace de recuperación.')
      return
    }

    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setAuthMessage('Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.')
    } catch (reason) {
      setError(`No se pudo enviar el enlace: ${errorMessage(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !title.trim()) return
    if (dueTime && !dueDate) {
      setError('Elige una fecha para la hora límite seleccionada.')
      return
    }
    const dueAt = dueDate ? new Date(`${dueDate}T${dueTime || '23:59:59'}`) : null
    if (dueAt && dueAt.getTime() <= Date.now()) {
      setError('La fecha y hora límite debe ser posterior al momento actual.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createTask(
        user.uid,
        title,
        description,
        dueAt,
        Boolean(dueAt && reminderEnabled),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        Boolean(dueAt && dueTime),
        priority,
      )
      setTitle('')
      setDescription('')
      setDueDate(localDateValue())
      setDatePreset('today')
      setDueTime('')
      setReminderEnabled(true)
      setPriority('normal')
    } catch (reason) {
      setError(`No se pudo guardar la tarea: ${errorMessage(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  async function executeTaskAction(action: Confirmation) {
    setError('')
    try {
      if (action.kind === 'complete') {
        await updateTask(action.task.id, { completed: true })
      } else {
        await removeTask(action.task.id)
      }
    } catch (reason) {
      setError(action.kind === 'complete'
        ? `No se pudo completar la tarea: ${errorMessage(reason)}`
        : `No se pudo eliminar la tarea: ${errorMessage(reason)}`)
    }
  }

  function askBefore(action: Confirmation) {
    if (skipConfirmations) {
      void executeTaskAction(action)
      return
    }
    setConfirmation(action)
  }

  function handleToggle(task: Task) {
    if (task.completed) {
      void updateTask(task.id, {
        completed: false,
        dueAt: task.dueAt?.toDate() ?? null,
        hasDueTime: task.hasDueTime !== false,
        priority: task.priority ?? 'normal',
        reminderEnabled: task.reminderEnabled,
        timeZone: task.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      }).catch((reason: unknown) => setError(`No se pudo actualizar la tarea: ${errorMessage(reason)}`))
      return
    }
    askBefore({ kind: 'complete', task })
  }

  async function handleUpdate(task: Task, nextTitle: string, nextDescription: string, dueAt: Date | null, hasDueTime: boolean, nextPriority: TaskPriority, nextReminderEnabled: boolean, timeZone: string) {
    setError('')
    try {
      await updateTask(task.id, {
        title: nextTitle,
        description: nextDescription,
        dueAt,
        hasDueTime,
        priority: nextPriority,
        reminderEnabled: nextReminderEnabled,
        timeZone,
      })
    } catch (reason) {
      setError(`No se pudo editar la tarea: ${errorMessage(reason)}`)
    }
  }

  function handleDelete(task: Task) {
    askBefore({ kind: 'delete', task })
  }

  async function resolveConfirmation(confirmed: boolean) {
    const action = confirmation
    setConfirmation(null)
    if (skipConfirmations) {
      try {
        localStorage.setItem('mis-tareas-skip-confirmations', 'true')
      } catch {
        // The preference remains active for this session if browser storage is unavailable.
      }
    }
    if (confirmed && action) await executeTaskAction(action)
  }

  async function handleSignOut() {
    setError('')
    try {
      await signOut(auth)
    } catch (reason) {
      setError(`No se pudo cerrar sesión: ${errorMessage(reason)}`)
    }
  }

  if (!authReady) {
    return (
      <div className="app-layout">
        <main className="auth-page"><p className="loading">Comprobando tu sesión…</p></main>
        <AppFooter />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="app-layout">
        <main className="auth-page">
          <section className="auth-card">
          <p className="eyebrow">ORGANIZA TU DÍA</p>
          <h1>Mis tareas</h1>
          <p className="intro">Entra para consultar y organizar tus tareas.</p>
          <div className="auth-tabs" role="tablist" aria-label="Acceso">
            <button className={authMode === 'login' ? 'active' : ''} type="button" onClick={() => { setAuthMode('login'); setError('') }}>Iniciar sesión</button>
            <button className={authMode === 'register' ? 'active' : ''} type="button" onClick={() => { setAuthMode('register'); setError('') }}>Crear cuenta</button>
          </div>
          <form className="stack-form" onSubmit={handleAuth}>
            <label>Correo electrónico
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>Contraseña
              <input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button className="button button-primary full-width" type="submit" disabled={busy}>
              {busy ? 'Un momento…' : authMode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>
          <div className="auth-divider" aria-hidden="true"><span>o continúa con</span></div>
          <button className="button button-google full-width" type="button" onClick={handleGoogleSignIn} disabled={busy}>
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
              <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.3A20 20 0 0 0 24 44Z" />
              <path fill="#4A90E2" d="M12.6 27.5a12 12 0 0 1 0-7v-5.3H5.8a20 20 0 0 0 0 17.6l6.8-5.3Z" />
              <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6.1 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.3c1.6-4.9 6.1-8.4 11.4-8.4Z" />
            </svg>
            Continuar con Google
          </button>
          {authMode === 'login' && (
            <button className="auth-link" type="button" onClick={handlePasswordReset} disabled={busy}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {authMessage && <p className="notice success" role="status">{authMessage}</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          </section>
        </main>
        <AppFooter />
      </div>
    )
  }

  if (!user.emailVerified) {
    return (
      <div className="app-layout">
        <main className="auth-page">
          <section className="auth-card">
          <p className="eyebrow">VERIFICA TU CORREO</p>
          <h1>Confirma tu cuenta</h1>
          <p className="intro">Enviamos un enlace de verificación a <strong>{user.email}</strong>. Ábrelo para confirmar tu correo y después vuelve aquí.</p>
          <p className="verification-tip">Si no lo ves, revisa la bandeja de entrada, Promociones y la carpeta de Spam o Correo no deseado.</p>
          <div className="verification-actions">
            <button className="button button-primary full-width" type="button" onClick={handleCheckVerification} disabled={busy}>
              {busy ? 'Comprobando…' : 'Ya verifiqué mi correo'}
            </button>
            <button className="button button-quiet full-width" type="button" onClick={handleResendVerification} disabled={busy}>
              Reenviar enlace
            </button>
            <button className="auth-link" type="button" onClick={handleSignOut} disabled={busy}>
              Cerrar sesión
            </button>
          </div>
          {authMessage && <p className="notice success" role="status">{authMessage}</p>}
          {error && <p className="notice error" role="alert">{error}</p>}
          </section>
        </main>
        <AppFooter />
      </div>
    )
  }

  const completedCount = tasks.filter((task) => task.completed).length
  return (
    <div className="app-layout">
      <main className="page-shell">
      <header className="topbar">
        <div className="brand-area">
          <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuOpen} aria-controls="dashboard-navigation" onClick={() => setMenuOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
          </button>
          <a className="brand" href="/">Mis tareas<span>.</span></a>
        </div>
        <div className="account-area">
          <span className="user-email">{user.email}</span>
          <button className="button button-quiet" type="button" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </header>

      <div className="dashboard-layout">
      {menuOpen && <button className="menu-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside className={menuOpen ? 'dashboard-sidebar open' : 'dashboard-sidebar'}>
        <nav id="dashboard-navigation" aria-label="Menú de tareas">
          <div className="sidebar-heading">
            <p className="eyebrow">MENÚ</p>
            <button className="sidebar-close" type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
          <p className="sidebar-group-label">TAREAS</p>
          <button className={view === 'add' ? 'sidebar-link active' : 'sidebar-link'} type="button" aria-current={view === 'add' ? 'page' : undefined} onClick={() => { setView('add'); setError(''); setMenuOpen(false) }}>
            <span className="sidebar-icon" aria-hidden="true">＋</span>Agregar tareas
          </button>
          <button className={view === 'tasks' && filter === 'pending' ? 'sidebar-link active' : 'sidebar-link'} type="button" aria-current={view === 'tasks' && filter === 'pending' ? 'page' : undefined} onClick={() => { setFilter('pending'); setView('tasks'); setError(''); setMenuOpen(false) }}>
            <span className="sidebar-icon" aria-hidden="true">◷</span>Pendientes<span className="sidebar-count">{tasks.length - completedCount}</span>
          </button>
          <button className={view === 'tasks' && filter === 'completed' ? 'sidebar-link active' : 'sidebar-link'} type="button" aria-current={view === 'tasks' && filter === 'completed' ? 'page' : undefined} onClick={() => { setFilter('completed'); setView('tasks'); setError(''); setMenuOpen(false) }}>
            <span className="sidebar-icon" aria-hidden="true">✓</span>Completadas<span className="sidebar-count">{completedCount}</span>
          </button>
          <span className="sidebar-separator" />
          <button className={view === 'notifications' ? 'sidebar-link active' : 'sidebar-link'} type="button" aria-current={view === 'notifications' ? 'page' : undefined} onClick={() => { setView('notifications'); setError(''); setMenuOpen(false) }}>
            <span className="sidebar-icon" aria-hidden="true">🔔</span>Notificaciones<span className="sidebar-count">{tasks.filter((task) => !task.completed && task.reminderEnabled === true && task.dueAt && task.dueAt.toMillis() > Date.now() && !task.reminderSentAt).length}</span>
          </button>
          <button className={view === 'summary' ? 'sidebar-link active' : 'sidebar-link'} type="button" aria-current={view === 'summary' ? 'page' : undefined} onClick={() => { setView('summary'); setError(''); setMenuOpen(false) }}><span className="sidebar-icon" aria-hidden="true">✉</span>Resumen por correo</button>
        </nav>
      </aside>

      <section className="workspace">
        {view === 'add' && (
          <div className="page-heading">
            <div><p className="eyebrow">TU ESPACIO PERSONAL</p><h1>Hola, {user.email?.split('@')[0]}</h1></div>
            <p className="task-summary">{completedCount} de {tasks.length} completadas</p>
          </div>
        )}

        {error && <p className="notice error" role="alert">{error}</p>}

        {view === 'add' && <form className="new-task-card" onSubmit={handleAddTask}>
          <div className="new-task-heading">
            <div><p className="eyebrow">CAPTURA RÁPIDA</p><h2>Agregar una tarea</h2></div>
            <span className="task-add-mark" aria-hidden="true">＋</span>
          </div>
          <label>Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Por ejemplo: preparar informe" required />
          </label>
          <label>Descripción <span className="optional">(opcional)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Añade algún detalle…" />
          </label>
          <label>Prioridad
            <select className="priority-select" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="urgent">Urgente</option>
              <option value="passable">Pasable</option>
              <option value="normal">Normal</option>
            </select>
          </label>
          <div className="deadline-picker">
            <span className="deadline-label">Fecha límite</span>
            <div className="deadline-presets" role="group" aria-label="Elegir fecha límite">
              <button className={datePreset === 'today' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setDatePreset('today'); setDueDate(localDateValue()) }}>Hoy</button>
              <button className={datePreset === 'tomorrow' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setDatePreset('tomorrow'); setDueDate(localDateValue(1)) }}>Mañana</button>
              <button className={datePreset === 'custom' ? 'deadline-preset active' : 'deadline-preset'} type="button" onClick={() => { setDatePreset('custom'); if (!dueDate) setDueDate(localDateValue()) }}>Elegir fecha</button>
            </div>
            {datePreset === 'custom' && <label className="custom-date-field">Personalizar fecha
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>}
            <label>Hora límite <span className="optional">(opcional)</span>
              <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
            </label>
          </div>
          <label className="reminder-toggle">
            <input type="checkbox" checked={reminderEnabled} disabled={!dueTime} onChange={(event) => setReminderEnabled(event.target.checked)} />
            Recibir recordatorio por correo
          </label>
          <p className="reminder-note">
            {dueTime && reminderEnabled
              ? `Si sigue pendiente, enviaremos un recordatorio a ${user.email} cuando falten cerca de 48 horas. El sistema revisa los avisos una vez al día, así que el envío puede tardar hasta alrededor de 24 horas. Programa la tarea con al menos 2 días de anticipación y revisa Recibidos, Promociones y Spam.`
              : dueTime
                ? 'El recordatorio por correo está desactivado para esta tarea.'
                : 'La tarea se guardará con la fecha elegida, aunque no selecciones hora. En el aviso aparecerá como “sin hora definida”; para recibir recordatorio por correo debes elegir una hora.'}
          </p>
          <button className="button button-primary" type="submit" disabled={busy || !title.trim()}>{busy ? 'Guardando…' : 'Agregar tarea'}</button>
        </form>}

        {view === 'tasks' && <section className="tasks-section" aria-labelledby="tasks-title">
          <div className="tasks-heading">
            <div><p className="eyebrow">LISTA</p><h2 id="tasks-title">Tus tareas</h2></div>
            <div className="tasks-controls">
              <label className="filter-control">Mostrar
                <select
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as TaskFilter)
                    setView('tasks')
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="pending">Pendientes</option>
                  <option value="completed">Completadas</option>
                </select>
              </label>
            </div>
          </div>
          <div id="task-list-panel" className="task-list-panel">
            {taskData?.userId !== user.uid ? <p className="loading">Cargando tus tareas…</p> : (
              <TaskList tasks={tasks} filter={filter} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
            )}
          </div>
        </section>}

        {view === 'summary' && <TaskSummary tasks={tasks} name={user.displayName ?? undefined} />}
        {view === 'notifications' && (taskData?.userId !== user.uid
          ? <p className="loading">Cargando tus recordatorios…</p>
          : <NotificationCenter tasks={tasks} email={user.email ?? ''} />)}
      </section>
      </div>
      {(welcomeReminderTasks.length > 0 || showWelcomeMessage) && (
        <div className="confirmation-backdrop welcome-reminder-backdrop">
          <section className="welcome-reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-reminder-title" aria-describedby="welcome-reminder-description">
            <span className="welcome-reminder-icon" aria-hidden="true">{showWelcomeMessage ? '✦' : '◷'}</span>
            <p className="eyebrow">{showWelcomeMessage ? 'BIENVENIDO A MIS TAREAS' : 'UN AVISO PARA TI'}</p>
            <h2 id="welcome-reminder-title">{showWelcomeMessage ? '¡Hola! Qué bueno tenerte aquí' : '¡Hola! Tienes tareas pendientes'}</h2>
            <p id="welcome-reminder-description">
              {showWelcomeMessage
                ? 'Por ahora no tienes tareas pendientes. Cuando quieras, agrega una y organiza tu día.'
                : 'Te recuerdo las tareas que vencen hoy o mañana. También aparecen las que aún no tienen fecha u hora definida.'}
            </p>
            {welcomeReminderTasks.length > 0 && <ul className="welcome-reminder-list">
              {welcomeReminderTasks.map((task) => (
                <li key={task.id}>
                  <div className="welcome-reminder-task-title">
                    <strong>{task.title}</strong>
                    <span className={`task-priority-badge priority-${task.priority ?? 'normal'}`}>{priorityLabel(task.priority)}</span>
                  </div>
                  <span className="welcome-reminder-deadline">{reminderDateLabel(task, new Date())}</span>
                </li>
              ))}
            </ul>}
            <button className="button button-primary welcome-reminder-acknowledge" type="button" autoFocus onClick={() => { setWelcomeReminderTasks([]); setShowWelcomeMessage(false) }}>
              Gracias
            </button>
          </section>
        </div>
      )}
      {confirmation && (
        <div className="confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) void resolveConfirmation(false) }}>
          <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
            <p className="eyebrow">CONFIRMA LA ACCIÓN</p>
            <h2 id="confirmation-title">{confirmation.kind === 'complete' ? '¿Completar esta tarea?' : '¿Eliminar esta tarea?'}</h2>
            <p id="confirmation-description">{confirmation.kind === 'complete' ? 'La tarea quedará marcada como completada.' : <>Se eliminará <strong>{confirmation.task.title}</strong> de forma permanente.</>}</p>
            <label className="confirmation-skip">
              <input type="checkbox" checked={skipConfirmations} onChange={(event) => setSkipConfirmations(event.target.checked)} />
              No volver a preguntar
            </label>
            <div className="confirmation-actions">
              <button className="button button-quiet" type="button" onClick={() => void resolveConfirmation(false)}>No, cancelar</button>
              <button className={confirmation.kind === 'delete' ? 'button button-danger' : 'button button-primary'} type="button" onClick={() => void resolveConfirmation(true)}>
                Sí, {confirmation.kind === 'complete' ? 'completar' : 'eliminar'}
              </button>
            </div>
          </section>
        </div>
      )}
      </main>
      <AppFooter />
    </div>
  )
}

export default App
