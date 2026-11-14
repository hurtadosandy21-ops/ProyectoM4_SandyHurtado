import { useEffect, useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from './services/firebase'
import { createTask, removeTask, subscribeToTasks, updateTask } from './services/tasks'
import { TaskList } from './components/TaskList'
import { TaskSummary } from './components/TaskSummary'
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [busy, setBusy] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setTasks([])
      setLoadingTasks(false)
      return
    }

    setLoadingTasks(true)
    setError('')
    return subscribeToTasks(
      user.uid,
      (nextTasks) => {
        setTasks(nextTasks)
        setLoadingTasks(false)
      },
      (reason) => {
        setError(`No se pudieron cargar las tareas: ${reason.message}`)
        setLoadingTasks(false)
      },
    )
  }, [user])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password)
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
    return <main className="page-shell"><p className="loading">Comprobando tu sesión…</p></main>
  }

  if (!user) {
    return (
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
          {error && <p className="notice error" role="alert">{error}</p>}
        </section>
      </main>
    )
  }

  const completedCount = tasks.filter((task) => task.completed).length

  return (
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
            <label className="filter-control">Mostrar
              <select value={filter} onChange={(event) => setFilter(event.target.value as TaskFilter)}>
                <option value="all">Todas</option>
                <option value="pending">Pendientes</option>
                <option value="completed">Completadas</option>
              </select>
            </label>
          </div>
          {loadingTasks ? <p className="loading">Cargando tus tareas…</p> : (
            <TaskList tasks={tasks} filter={filter} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
          )}
        </section>
      </section>
    </main>
  )
}

export default App
