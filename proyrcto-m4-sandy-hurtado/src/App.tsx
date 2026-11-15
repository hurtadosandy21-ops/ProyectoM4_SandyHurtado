import { useEffect, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './services/firebase'
import { createTask, removeTask, subscribeToTasks, updateTask } from './services/tasks'
import { TaskList } from './components/TaskList'
import { TaskSummary } from './components/TaskSummary'
import { AppFooter } from './components/AppFooter'
import type { Task, TaskFilter } from './types/task'

type AuthMode = 'login' | 'register'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error. Inténtalo de nuevo.'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [taskData, setTaskData] = useState<{ userId: string; tasks: Task[] } | null>(null)
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [showTasks, setShowTasks] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const tasks = user && taskData?.userId === user.uid ? taskData.tasks : []

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthReady(true)
      setError('')
      if (!currentUser) setTaskData(null)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    return subscribeToTasks(
      user.uid,
      (nextTasks) => {
        setTaskData({ userId: user.uid, tasks: nextTasks })
      },
      (reason) => {
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
    setBusy(true)
    setError('')
    try {
      await createTask(user.uid, title, description)
      setTitle('')
      setDescription('')
    } catch (reason) {
      setError(`No se pudo guardar la tarea: ${errorMessage(reason)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleToggle(task: Task) {
    setError('')
    try {
      await updateTask(task.id, { completed: !task.completed })
    } catch (reason) {
      setError(`No se pudo actualizar la tarea: ${errorMessage(reason)}`)
    }
  }

  async function handleUpdate(task: Task, nextTitle: string, nextDescription: string) {
    setError('')
    try {
      await updateTask(task.id, { title: nextTitle, description: nextDescription })
    } catch (reason) {
      setError(`No se pudo editar la tarea: ${errorMessage(reason)}`)
    }
  }

  async function handleDelete(task: Task) {
    setError('')
    try {
      await removeTask(task.id)
    } catch (reason) {
      setError(`No se pudo eliminar la tarea: ${errorMessage(reason)}`)
    }
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
          <p className="intro">Enviamos un enlace a <strong>{user.email}</strong>. Ábrelo y después vuelve aquí para confirmar la verificación.</p>
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
  const visibleTaskCount =
    filter === 'pending'
      ? tasks.length - completedCount
      : filter === 'completed'
        ? completedCount
        : tasks.length

  return (
    <div className="app-layout">
      <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="/">Mis tareas<span>.</span></a>
        <div className="account-area">
          <span className="user-email">{user.email}</span>
          <button className="button button-quiet" type="button" onClick={handleSignOut}>Cerrar sesión</button>
        </div>
      </header>

      <section className="workspace">
        <div className="page-heading">
          <div><p className="eyebrow">TU ESPACIO PERSONAL</p><h1>Hola, {user.email?.split('@')[0]}</h1></div>
          <p className="task-summary">{completedCount} de {tasks.length} completadas</p>
        </div>

        {error && <p className="notice error" role="alert">{error}</p>}

        <form className="new-task-card" onSubmit={handleAddTask}>
          <h2>Agregar una tarea</h2>
          <label>Título
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Por ejemplo: preparar informe" required />
          </label>
          <label>Descripción <span className="optional">(opcional)</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Añade algún detalle…" />
          </label>
          <button className="button button-primary" type="submit" disabled={busy || !title.trim()}>{busy ? 'Guardando…' : 'Agregar tarea'}</button>
        </form>

        <TaskSummary tasks={tasks} />

        <section className="tasks-section" aria-labelledby="tasks-title">
          <div className="tasks-heading">
            <div><p className="eyebrow">LISTA</p><h2 id="tasks-title">Tus tareas</h2></div>
            <div className="tasks-controls">
              <label className="filter-control">Mostrar
                <select
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value as TaskFilter)
                    setShowTasks(true)
                  }}
                >
                  <option value="all">Todas</option>
                  <option value="pending">Pendientes</option>
                  <option value="completed">Completadas</option>
                </select>
              </label>
              <button
                className="button button-quiet task-collapse-button"
                type="button"
                aria-expanded={showTasks}
                aria-controls="task-list-panel"
                onClick={() => setShowTasks((visible) => !visible)}
              >
                {showTasks ? 'Ocultar lista' : `Ver lista (${visibleTaskCount})`}
                <svg className={showTasks ? 'task-chevron is-open' : 'task-chevron'} viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3.5 6 4.5 4 4.5-4" />
                </svg>
              </button>
            </div>
          </div>
          <div id="task-list-panel" className="task-list-panel" hidden={!showTasks}>
            {showTasks && (
              taskData?.userId !== user.uid ? <p className="loading">Cargando tus tareas…</p> : (
                <TaskList tasks={tasks} filter={filter} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
              )
            )}
          </div>
        </section>
      </section>
      </main>
      <AppFooter />
    </div>
  )
}

export default App
