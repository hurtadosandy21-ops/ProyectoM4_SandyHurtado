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
    const taskLines = tasks.map((task) => {
      const title = typeof task.title === 'string' ? task.title : 'Tarea sin título'
      return `• ${title} — ${task.completed === true ? 'Completada' : 'Pendiente'}`
    })

    const body = [
      'Este es el resumen actual de tus tareas:',
      '',
      `Total: ${tasks.length}`,
      `Pendientes: ${pendingCount}`,
      `Completadas: ${completedCount}`,
      '',
      ...(taskLines.length > 0 ? taskLines : ['Todavía no tienes tareas.']),
    ].join('\n')

    const ses = new SESv2Client({ region: requiredEnv('AWS_REGION') })
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: requiredEnv('SES_FROM_EMAIL'),
        Destination: { ToAddresses: [decodedToken.email] },
        Content: {
          Simple: {
            Subject: { Data: 'Resumen de tus tareas', Charset: 'UTF-8' },
            Body: { Text: { Data: body, Charset: 'UTF-8' } },
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
