import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp, type DocumentReference } from 'firebase-admin/firestore'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta configurar ${name} en el servidor.`)
  return value
}

function getFirebaseAdminApp() {
  const existingApp = getApps().find((app) => app.name === 'tasks-email-api')
  if (existingApp) return existingApp
  const serviceAccount = JSON.parse(requiredEnv('FIREBASE_ADMIN_SERVICE_ACCOUNT'))
  return initializeApp({ credential: cert(serviceAccount) }, 'tasks-email-api')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

function formatDueDate(value: Timestamp, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(value.toDate())
  } catch {
    return new Intl.DateTimeFormat('es-EC', { dateStyle: 'full', timeStyle: 'short' }).format(value.toDate())
  }
}

type ReminderTask = {
  ref: DocumentReference
  title: string
  description: string
  dueAt: Timestamp
  timeZone: string
}

type ReminderGroup = { userId: string; tasks: ReminderTask[] }

function jsonResponse(body: object, status: number) {
  return Response.json(body, { status })
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('Falta configurar CRON_SECRET para los recordatorios.')
    return jsonResponse({ error: 'La tarea programada no está configurada.' }, 500)
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'No autorizado.' }, 401)
  }

  try {
    const app = getFirebaseAdminApp()
    const firestore = getFirestore(app)
    const now = Timestamp.now()
    const snapshot = await firestore.collection('tasks').where('reminderAt', '<=', now).limit(200).get()
    const groups = new Map<string, ReminderGroup>()

    for (const taskDoc of snapshot.docs) {
      const data = taskDoc.data()
      const dueAt = data.dueAt
      if (
        data.completed === true || data.reminderEnabled !== true || data.reminderSentAt != null ||
        !(dueAt instanceof Timestamp) || dueAt.toMillis() <= now.toMillis() || typeof data.userId !== 'string'
      ) {
        await taskDoc.ref.update({ reminderAt: null })
        continue
      }

      const task: ReminderTask = {
        ref: taskDoc.ref,
        title: typeof data.title === 'string' ? data.title : 'Tarea sin título',
        description: typeof data.description === 'string' ? data.description : '',
        dueAt,
        timeZone: typeof data.timeZone === 'string' ? data.timeZone : 'UTC',
      }
      const group = groups.get(data.userId) ?? { userId: data.userId, tasks: [] }
      group.tasks.push(task)
      groups.set(data.userId, group)
    }

    const firebaseAuth = getAuth(app)
    const ses = new SESv2Client({ region: requiredEnv('AWS_REGION') })
    let emailsSent = 0
    let tasksReminded = 0
    let groupsProcessed = 0

    // Bound each run; remaining tasks are picked up by the next scheduled check.
    for (const group of groups.values()) {
      if (groupsProcessed >= 10) break
      groupsProcessed += 1
      let account
      try {
        account = await firebaseAuth.getUser(group.userId)
      } catch (error) {
        console.error('No se encontró la cuenta del propietario de tareas con recordatorio.', error)
        await Promise.all(group.tasks.map((task) => task.ref.update({ reminderAt: null })))
        continue
      }
      if (!account.email || !account.emailVerified) {
        await Promise.all(group.tasks.map((task) => task.ref.update({ reminderAt: null })))
        continue
      }

      const textLines = group.tasks.map((task) => {
        const due = formatDueDate(task.dueAt, task.timeZone)
        return `• ${task.title} — fecha límite: ${due}${task.description ? `\n  ${task.description}` : ''}`
      })
      const textBody = [
        'MIS TAREAS · RECORDATORIO', '',
        'Tienes tareas pendientes cuya fecha límite se acerca:', '',
        ...textLines, '',
        'Este recordatorio se envía una sola vez por tarea y solo si todavía está pendiente.',
        'Si no encuentras el mensaje, revisa también las carpetas de Spam y Promociones.',
      ].join('\n')
      const taskRows = group.tasks.map((task) => `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e9e3;border-radius:12px;background:#ffffff"><tr><td style="padding:15px 17px"><strong style="display:block;color:#20352c;font-size:15px;line-height:1.45">${escapeHtml(task.title)}</strong><span style="display:block;margin-top:6px;color:#8a5a13;font-size:12px;font-weight:700">Fecha límite: ${escapeHtml(formatDueDate(task.dueAt, task.timeZone))}</span>${task.description ? `<p style="margin:8px 0 0;color:#718077;font-size:13px;line-height:1.55;white-space:pre-line">${escapeHtml(task.description)}</p>` : ''}</td></tr></table></td></tr>`).join('')
      const htmlBody = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f6f1;font-family:Arial,Helvetica,sans-serif;color:#20352c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border:1px solid #e1e9e2;border-radius:18px;overflow:hidden"><tr><td style="padding:27px 28px;background:#216b4d;color:#fff"><p style="margin:0 0 8px;color:#d8f0df;font-size:11px;font-weight:700;letter-spacing:2px">MIS TAREAS</p><h1 style="margin:0;font-size:24px;line-height:1.3">Se acerca la fecha de entrega</h1><p style="margin:9px 0 0;color:#e8f4eb;font-size:14px;line-height:1.5">Estas tareas todavía aparecen como pendientes.</p></td></tr><tr><td style="padding:23px 24px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${taskRows}</table></td></tr><tr><td style="padding:16px 22px;background:#f8faf7;border-top:1px solid #e6ece6;text-align:center;color:#859187;font-size:11px;line-height:1.5">Te enviamos este aviso una sola vez por tarea. Si ya la completaste, puedes ignorarlo. Si no aparece en tu bandeja, revisa Spam y Promociones.</td></tr></table></td></tr></table></body></html>`

      await ses.send(new SendEmailCommand({
        FromEmailAddress: requiredEnv('SES_FROM_EMAIL'),
        Destination: { ToAddresses: [account.email] },
        Content: {
          Simple: {
            Subject: { Data: 'Recordatorio: tienes tareas pendientes', Charset: 'UTF-8' },
            Body: { Html: { Data: htmlBody, Charset: 'UTF-8' }, Text: { Data: textBody, Charset: 'UTF-8' } },
          },
        },
      }))

      const sentAt = Timestamp.now()
      await Promise.all(group.tasks.map((task) => task.ref.update({ reminderSentAt: sentAt, reminderAt: null })))
      emailsSent += 1
      tasksReminded += group.tasks.length
    }

    return jsonResponse({ emailsSent, tasksReminded }, 200)
  } catch (error) {
    console.error('No se pudieron procesar los recordatorios por correo.', error)
    return jsonResponse({ error: 'No se pudieron procesar los recordatorios.' }, 500)
  }
}
