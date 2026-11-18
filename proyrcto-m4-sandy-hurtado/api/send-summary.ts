import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta configurar ${name} en el servidor.`)
  return value
}

function getFirebaseAdminApp() {
  const existingApp = getApps().find((app) => app.name === 'tasks-email-api')
  if (existingApp) return existingApp

  const serviceAccount = JSON.parse(requiredEnv('FIREBASE_ADMIN_SERVICE_ACCOUNT'))

  return initializeApp(
    { credential: cert(serviceAccount) },
    'tasks-email-api',
  )
}

function jsonResponse(body: object, status: number) {
  return Response.json(body, { status })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character] ?? character
  })
}

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get('authorization')
  const idToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!idToken) {
    return jsonResponse({ error: 'Inicia sesión para enviar el resumen.' }, 401)
  }

  let decodedToken
  try {
    // Verificamos la sesión antes de leer Firestore para limitar el resumen a su propietario.
    decodedToken = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken)
  } catch {
    return jsonResponse({ error: 'La sesión no es válida. Inicia sesión de nuevo.' }, 401)
  }

  if (!decodedToken.email) {
    return jsonResponse({ error: 'La cuenta no tiene un correo electrónico.' }, 400)
  }

  if (decodedToken.email_verified !== true) {
    return jsonResponse({ error: 'Verifica el correo de tu cuenta antes de enviar el resumen.' }, 403)
  }

  try {
    const firestore = getFirestore(getFirebaseAdminApp())
    // El filtro por UID evita incluir tareas de otras cuentas en el correo.
    const snapshot = await firestore
      .collection('tasks')
      .where('userId', '==', decodedToken.uid)
      .get()

    const tasks = snapshot.docs.map((taskDoc) => taskDoc.data())
    const completedCount = tasks.filter((task) => task.completed === true).length
    const pendingCount = tasks.length - completedCount
    const normalizedTasks = tasks.map((task) => ({
      title: typeof task.title === 'string' ? task.title : 'Tarea sin título',
      description: typeof task.description === 'string' ? task.description : '',
      completed: task.completed === true,
    }))

    const taskText = normalizedTasks.length > 0
      ? normalizedTasks.map((task) => [
          `${task.completed ? '[COMPLETADA]' : '[PENDIENTE]'} ${task.title}`,
          ...(task.description ? [`  ${task.description}`] : []),
        ].join('\n')).join('\n\n')
      : 'Todavía no tienes tareas.'
    const textBody = [
      'MIS TAREAS · RESUMEN',
      `Hola${decodedToken.name ? `, ${decodedToken.name}` : ''}: este es el estado actual de tus tareas.`,
      '',
      `Total: ${tasks.length}`,
      `Pendientes: ${pendingCount}`,
      `Completadas: ${completedCount}`,
      '',
      'DETALLE DE TAREAS',
      taskText,
      '',
      'Este mensaje fue generado automáticamente desde Mis tareas.',
    ].join('\n')
    const taskCards = normalizedTasks.length > 0
      ? normalizedTasks.map((task) => {
          const stateColor = task.completed ? '#216b4d' : '#8a5a13'
          const stateBackground = task.completed ? '#e6f4eb' : '#fff3d9'
          return `<tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e9e3;border-radius:12px;background:#ffffff"><tr><td style="padding:16px 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:15px;line-height:1.45;font-weight:700;color:#20352c">${escapeHtml(task.title)}</td><td align="right" style="white-space:nowrap;padding-left:10px"><span style="display:inline-block;padding:5px 9px;border-radius:999px;background:${stateBackground};color:${stateColor};font-size:11px;font-weight:700">${task.completed ? 'Completada' : 'Pendiente'}</span></td></tr></table>${task.description ? `<p style="margin:8px 0 0;color:#718077;font-size:13px;line-height:1.55;white-space:pre-line">${escapeHtml(task.description)}</p>` : ''}</td></tr></table></td></tr>`
        }).join('')
      : '<tr><td style="padding:20px;border:1px dashed #cbd8ce;border-radius:12px;color:#718077;text-align:center;font-size:14px">Todavía no tienes tareas. Cuando agregues una, aparecerá aquí.</td></tr>'
    const htmlBody = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f6f1;font-family:Arial,Helvetica,sans-serif;color:#20352c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px"><tr><td style="padding:28px 30px;background:#216b4d;border-radius:18px 18px 0 0;color:#ffffff"><p style="margin:0 0 8px;color:#d8f0df;font-size:11px;font-weight:700;letter-spacing:2px">MIS TAREAS</p><h1 style="margin:0;font-size:26px;line-height:1.25">Tu resumen está listo</h1><p style="margin:10px 0 0;color:#e8f4eb;font-size:14px;line-height:1.5">Hola${decodedToken.name ? `, ${escapeHtml(decodedToken.name)}` : ''}. Aquí tienes el avance de tu lista.</p></td></tr><tr><td style="padding:24px 22px 12px;background:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${[
      ['Total', tasks.length, '#20352c'],
      ['Pendientes', pendingCount, '#8a5a13'],
      ['Completadas', completedCount, '#216b4d'],
    ].map(([label, count, color]) => `<td width="33.33%" style="padding:0 5px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e9e3;border-radius:12px;background:#f9fbf8"><tr><td style="padding:14px 10px;text-align:center"><strong style="display:block;color:${color};font-size:24px">${count}</strong><span style="display:block;margin-top:4px;color:#718077;font-size:11px">${label}</span></td></tr></table></td>`).join('')}</tr></table></td></tr><tr><td style="padding:4px 27px 28px;background:#ffffff"><h2 style="margin:0 0 14px;font-size:16px;color:#20352c">Detalle de tareas</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${taskCards}</table></td></tr><tr><td style="padding:17px 22px;background:#f8faf7;border-top:1px solid #e6ece6;border-radius:0 0 18px 18px;text-align:center;color:#859187;font-size:11px;line-height:1.5">Mensaje automático de Mis tareas.<br>Este correo resume la información guardada en tu cuenta.</td></tr></table></td></tr></table></body></html>`

    const ses = new SESv2Client({ region: requiredEnv('AWS_REGION') })
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: requiredEnv('SES_FROM_EMAIL'),
        Destination: { ToAddresses: [decodedToken.email] },
        Content: {
          Simple: {
            Subject: { Data: 'Resumen de tus tareas', Charset: 'UTF-8' },
            Body: {
              Html: { Data: htmlBody, Charset: 'UTF-8' },
              Text: { Data: textBody, Charset: 'UTF-8' },
            },
          },
        },
      }),
    )

    return jsonResponse({ message: 'El resumen fue enviado a tu correo.' }, 200)
  } catch (error) {
    console.error('No se pudo enviar el resumen de tareas.', error)
    return jsonResponse(
      { error: 'No se pudo enviar el resumen. Revisa la configuración del servidor.' },
      500,
    )
  }
}
