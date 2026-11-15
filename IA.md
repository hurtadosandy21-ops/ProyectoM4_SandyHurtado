# Uso de inteligencia artificial en el desarrollo

## Propósito y alcance

Durante el desarrollo de **Mis tareas** se utilizó inteligencia artificial como apoyo para comprender herramientas, investigar errores, proponer alternativas de implementación y revisar la documentación. Se usaron **ChatGPT** y **Gemini** como asistentes de consulta.

> **Transparencia:** Los prompts de este documento son reconstrucciones profesionales basadas en las tareas y problemas abordados. No son citas literales del historial. Los fragmentos de código son extractos representativos o versiones reducidas de la solución aplicada; se incluyen para explicar el razonamiento técnico.

## Índice

1. [Configurar la aplicación React y Vite](#1-configurar-la-aplicación-react-y-vite)
2. [Diagnosticar la inicialización de Firebase](#2-diagnosticar-la-inicialización-de-firebase)
3. [Aislar tareas por usuario en Firestore](#3-aislar-tareas-por-usuario-en-firestore)
4. [Verificar la cuenta antes de habilitar funciones](#4-verificar-la-cuenta-antes-de-habilitar-funciones)
5. [Diseñar el envío seguro del resumen](#5-diseñar-el-envío-seguro-del-resumen)
6. [Configurar IAM y proteger las credenciales](#6-configurar-iam-y-proteger-las-credenciales)
7. [Resolver el error ERR_REQUIRE_ESM en Vercel](#7-resolver-el-error-err_require_esm-en-vercel)
8. [Separar errores de firma y restricciones de SES](#8-separar-errores-de-firma-y-restricciones-de-ses)
9. [Agregar pruebas que validen comportamientos](#9-agregar-pruebas-que-validen-comportamientos)
10. [Documentar la aplicación para otra persona](#10-documentar-la-aplicación-para-otra-persona)

## 1. Configurar la aplicación React y Vite

### Prompt técnico reconstruido

> “Tengo Node.js y npm instalados. Necesito iniciar una aplicación de tareas con React y TypeScript usando Vite. Indícame cómo crearla, cómo instalar dependencias y cómo verificar que ejecuto los comandos desde la carpeta correcta.”

### Problema y diagnóstico

El repositorio contiene una carpeta contenedora y una carpeta interna con el código ejecutable. Ejecutar npm en la carpeta contenedora, que no contiene el package.json activo, provoca errores como ‘Missing script: dev’.

### Respuesta de IA — extracto

Los comandos deben ejecutarse en el directorio donde está el package.json de la aplicación. El servidor local se inicia con el script configurado en ese archivo:

~~~powershell
Set-Location .\proyrcto-m4-sandy-hurtado
npm install
npm run dev
~~~

La configuración permite identificar los comandos disponibles:

~~~json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && tsc --noEmit -p tsconfig.api.json && vite build",
    "lint": "oxlint",
    "test": "vitest run"
  }
}
~~~

### Qué estaba fallando y por qué esta solución es mejor

El problema no era una instalación incompleta de npm, sino ejecutar el comando en el nivel equivocado del repositorio. Confirmar la carpeta y los scripts evita reinstalar herramientas o modificar el proyecto sin necesidad.

### Aprendizaje e implementación

Aprendí a identificar la raíz real de una aplicación por su package.json. La ejecución, las pruebas y la compilación se hacen dentro de proyrcto-m4-sandy-hurtado/.

[↑ Volver al índice](#índice)

## 2. Diagnosticar la inicialización de Firebase

### Prompt técnico reconstruido

> “La página aparece en blanco después de conectar Firebase. Revisa el flujo de importaciones y explícame cómo distinguir un error de configuración de un export que falta. Quiero que Auth y Firestore se inicialicen una sola vez en un servicio compartido.”

### Problema y diagnóstico

Una pantalla en blanco puede aparecer cuando la aplicación intenta importar un símbolo que el módulo no exporta, o cuando se lee configuración vacía. En vez de cambiar estilos primero, se revisan la consola del navegador, la terminal y la cadena de importaciones.

### Respuesta de IA — extracto

La inicialización queda en un módulo y exporta explícitamente los servicios que usan los componentes:

~~~ts
const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
~~~

En el archivo de entorno del frontend se definen las variables que consume Firebase:

~~~env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
~~~

### Qué estaba fallando y por qué esta solución es mejor

La plantilla inicial no exponía Auth como el código de la aplicación esperaba. Exportar auth y db desde un solo módulo hace explícito el contrato entre la inicialización y sus consumidores. Las variables externas permiten usar valores distintos en desarrollo y producción sin copiar la configuración en varios archivos.

### Aprendizaje e implementación

Aprendí a verificar que cada import tenga su export correspondiente y a revisar las variables requeridas antes de perseguir errores secundarios. La inicialización está en src/services/firebase.ts.

[↑ Volver al índice](#índice)

## 3. Aislar tareas por usuario en Firestore

### Prompt técnico reconstruido

> “Firestore muestra documentos de tareas, pero la interfaz presenta el estado vacío. Comprueba cómo se relacionan el UID autenticado, el campo userId, la consulta en tiempo real y el estado de React. Propón una solución que no relaje las reglas de acceso.”

### Problema y diagnóstico

Que existan documentos no significa que la consulta actual los encuentre. La consulta filtra por userId; si el documento no tiene ese campo, tiene otro UID o la pantalla conserva datos asociados a una sesión anterior, la lista queda vacía o puede mostrar información equivocada.

### Respuesta de IA — extracto

La consulta se limita al usuario autenticado y escucha cambios de Firestore:

~~~ts
const userTasksQuery = query(
  tasksCollection,
  where('userId', '==', userId),
)

return onSnapshot(userTasksQuery, (snapshot) => {
  const tasks = snapshot.docs.map((taskDoc) => ({
    id: taskDoc.id,
    ...taskDoc.data(),
  }))
  onTasks(tasks)
}, onError)
~~~

La interfaz conserva qué cuenta produjo los datos y evita usarlos para otra cuenta:

~~~ts
const [taskData, setTaskData] = useState<{
  userId: string
  tasks: Task[]
} | null>(null)

const tasks =
  user && taskData?.userId === user.uid ? taskData.tasks : []
~~~

### Qué estaba fallando y por qué esta solución es mejor

La investigación debía comparar el campo que usa la consulta, no solamente el ID visual del documento. Filtrar por propietario y asociar el estado de pantalla al UID evita mostrar datos de otra sesión. Quitar el filtro para “hacer que aparezcan” las tareas habría ocultado el síntoma debilitando la privacidad.

### Aprendizaje e implementación

Aprendí a seguir el dato desde su creación hasta la suscripción: el campo userId se guarda al crear la tarea y se usa para filtrar los documentos. Las reglas de Firestore mantienen la misma comprobación de propiedad en el servidor.

[↑ Volver al índice](#índice)

## 4. Verificar la cuenta antes de habilitar funciones

### Prompt técnico reconstruido

> “La aplicación será pública y necesita confirmar la dirección de cada usuario. ¿Debo crear una identidad SES por cada destinatario? Diseña el flujo correcto usando Firebase Authentication y asegúrate de que el servidor pueda comprobar la verificación.”

### Problema y diagnóstico

Se estaban confundiendo dos verificaciones diferentes: Firebase confirma que el usuario controla su cuenta; Amazon SES valida la identidad de envío y, en sandbox, restringe los destinatarios autorizados. Crear una identidad SES por persona no es el mecanismo de verificación de usuarios de una aplicación.

### Respuesta de IA — extracto

Al registrarse, Firebase envía el enlace de confirmación:

~~~ts
const credential = await createUserWithEmailAndPassword(auth, email, password)
await sendEmailVerification(credential.user)
~~~

Antes de procesar el resumen, el endpoint valida el token y comprueba el reclamo de correo verificado:

~~~ts
decodedToken = await getAuth(adminApp).verifyIdToken(idToken)

if (decodedToken.email_verified !== true) {
  return jsonResponse(
    { error: 'Verifica el correo de tu cuenta antes de enviar el resumen.' },
    403,
  )
}
~~~

### Qué estaba fallando y por qué esta solución es mejor

SES no está diseñado para que la aplicación marque cada correo del público como identidad remitente. Firebase administra la verificación de cada usuario y SES envía desde una dirección remitente controlada por el proyecto. La comprobación también se realiza en el servidor, así que ocultar un botón en la interfaz no es la única barrera.

### Aprendizaje e implementación

Aprendí a separar autenticación, autorización del endpoint y configuración del proveedor de correo. La interfaz permite reenviar el enlace y actualizar el estado de verificación; la API exige email_verified antes de continuar.

[↑ Volver al índice](#índice)

## 5. Diseñar el envío seguro del resumen

### Prompt técnico reconstruido

> “Implementa un endpoint POST para enviar un resumen de tareas con Amazon SES. Debe aceptar un token Firebase Bearer, validar el token en el servidor, consultar solo las tareas del UID autenticado, calcular pendientes y completadas, y devolver errores HTTP claros. No aceptes como destino ni como UID valores arbitrarios del navegador.”

### Problema y diagnóstico

El navegador no debe decidir qué cuenta se consulta ni indicar una dirección de destino no autenticada. Si el endpoint confía en esos valores, una persona podría intentar pedir datos o envíos asociados a otra cuenta.

### Respuesta de IA — extracto

El servidor obtiene el UID y el correo del token verificado, y construye la consulta del propietario:

~~~ts
const decodedToken = await getAuth(getFirebaseAdminApp()).verifyIdToken(idToken)

const snapshot = await getFirestore(getFirebaseAdminApp())
  .collection('tasks')
  .where('userId', '==', decodedToken.uid)
  .get()

const tasks = snapshot.docs.map((taskDoc) => taskDoc.data())
const completedCount = tasks.filter((task) => task.completed === true).length
const pendingCount = tasks.length - completedCount
~~~

El destino se toma de la identidad autenticada y el remitente de la configuración del servidor:

~~~ts
await ses.send(new SendEmailCommand({
  FromEmailAddress: requiredEnv('SES_FROM_EMAIL'),
  Destination: { ToAddresses: [decodedToken.email] },
  Content: {
    Simple: {
      Subject: { Data: 'Resumen de tus tareas', Charset: 'UTF-8' },
      Body: { Text: { Data: body, Charset: 'UTF-8' } },
    },
  },
}))
~~~

### Qué estaba fallando y por qué esta solución es mejor

El resumen debe calcularse con los documentos recuperados por UID, no con una lista enviada por el cliente. Así, el servidor controla la identidad, la consulta y la dirección destino. Las credenciales de SES permanecen exclusivamente en el entorno del servidor.

### Aprendizaje e implementación

Aprendí a tratar el token como prueba de identidad y no como un simple dato. El endpoint está en api/send-summary.ts y responde con códigos 401, 403 o 500 según el tipo de problema.

[↑ Volver al índice](#índice)

## 6. Configurar IAM y proteger las credenciales

### Prompt técnico reconstruido

> “Estoy creando credenciales IAM para SES y quiero evitar permisos excesivos. Explica cuál es el ID de clave, cuál es el secreto generado por AWS, qué variables requiere la API y cómo reducir la política al remitente de la aplicación.”

### Problema y diagnóstico

El valor de descripción que se escribe al crear una clave es una etiqueta para reconocerla, no es el secreto criptográfico. Además, la política de envío debe coincidir con la dirección configurada como remitente.

### Respuesta de IA — extracto

La API espera credenciales como variables privadas del servidor:

~~~env
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
SES_FROM_EMAIL=
FIREBASE_ADMIN_SERVICE_ACCOUNT=
~~~

Una política de ejemplo restringe la acción al envío y condiciona el remitente:

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EnviarResumenDesdeRemitenteVerificado",
      "Effect": "Allow",
      "Action": "ses:SendEmail",
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "ses:FromAddress": "remitente-verificado@example.com"
        }
      }
    }
  ]
}
~~~

### Qué estaba fallando y por qué esta solución es mejor

Una clave incorrecta produce una firma inválida; un valor escrito como descripción no reemplaza el AWS_SECRET_ACCESS_KEY. Limitar la acción y el remitente reduce el alcance del acceso comparado con otorgar permisos administrativos completos.

### Aprendizaje e implementación

Aprendí a guardar el par de credenciales generado por AWS en variables de Vercel, nunca en variables con prefijo VITE_ ni en el repositorio. El ejemplo de política debe ajustarse a la identidad remitente verificada en SES.

[↑ Volver al índice](#índice)

## 7. Resolver el error ERR_REQUIRE_ESM en Vercel

### Prompt técnico reconstruido

> “El endpoint desplegado falla antes de enviar el correo con ERR_REQUIRE_ESM: jwks-rsa intenta cargar jose con require(), pero la dependencia instalada es un módulo ES. Analiza la causa y propone un arreglo reproducible que no edite node_modules directamente.”

### Problema y diagnóstico

El log mostraba una incompatibilidad entre el cargador CommonJS de jwks-rsa y la versión de jose resuelta al instalar dependencias. Como el error ocurría al cargar los módulos, SES ni siquiera llegaba a procesar el mensaje.

### Respuesta de IA — extracto

Se fijó una versión compatible de la dependencia transitiva en package.json usando overrides:

~~~json
{
  "overrides": {
    "jwks-rsa": {
      "jose": "4.15.9"
    }
  }
}
~~~

### Qué estaba fallando y por qué esta solución es mejor

Cambiar archivos dentro de node_modules no es reproducible: npm los vuelve a crear en la próxima instalación y Vercel obtiene otra copia limpia. Un override registra la resolución de dependencias en package.json y package-lock.json para que local y despliegue usen la misma versión.

### Aprendizaje e implementación

Aprendí a leer en qué etapa ocurre el fallo antes de depurar la llamada a SES. Se corrigió la compatibilidad de dependencias y se comprobó la compilación antes de desplegar de nuevo.

[↑ Volver al índice](#índice)

## 8. Separar errores de firma y restricciones de SES

### Prompt técnico reconstruido

> “El endpoint devuelve 500 y los logs muestran primero InvalidSignatureException y luego MessageRejected. Explica qué causa cada uno, qué revisar en Vercel y por qué verificar solo el remitente no garantiza que el envío esté permitido.”

### Problema y diagnóstico

Los dos errores tienen causas distintas:

- **InvalidSignatureException:** AWS no pudo validar la firma de la petición. Se revisan el ID y secreto copiados, espacios sobrantes, región y credenciales vigentes.
- **MessageRejected:** SES recibió la petición, pero rechazó el mensaje por una regla de cuenta, identidad o destinatario. En sandbox, el destinatario también debe estar verificado en la misma región.

### Respuesta de IA — extracto

La configuración debe mantener consistentes la región y la identidad remitente:

~~~env
AWS_REGION=us-east-2
SES_FROM_EMAIL=remitente-verificado@example.com
~~~

En la llamada del SDK, el servidor usa esa región y el remitente configurado:

~~~ts
const ses = new SESv2Client({
  region: requiredEnv('AWS_REGION'),
})
~~~

### Qué estaba fallando y por qué esta solución es mejor

Cambiar la política IAM no corrige una firma inválida; cambiar la clave no saca una cuenta del sandbox. Separar las capas evita cambios al azar: primero se valida la autenticación AWS, después los permisos, luego región e identidad, y finalmente las restricciones de envío de SES.

### Aprendizaje e implementación

Aprendí a leer el error específico en los logs de Vercel y a revisar el estado de SES en CloudShell. Para una aplicación pública, Firebase verifica a los usuarios; SES debe estar autorizado para enviar a sus direcciones según el modo de cuenta aprobado por AWS.

[↑ Volver al índice](#índice)

## 9. Agregar pruebas que validen comportamientos

### Prompt técnico reconstruido

> “Añade pruebas automatizadas para los filtros de tareas, el estado vacío, las acciones de completar, editar y borrar, el resumen por correo en éxito y error, y las operaciones del servicio Firestore. Usa mocks donde la prueba no deba depender de servicios externos.”

### Problema y diagnóstico

Sin pruebas, cambios en filtros o estados de carga pueden romper la interfaz aunque TypeScript compile. Probar contra Firebase o SES reales también vuelve la suite dependiente de credenciales, red y datos de una cuenta.

### Respuesta de IA — extracto

El archivo de configuración selecciona jsdom y un archivo común de preparación para React Testing Library:

~~~ts
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    clearMocks: true,
  },
})
~~~

Un caso de prueba puede validar una acción sin invocar Firestore real:

~~~tsx
it('llama a onToggle al cambiar el estado', async () => {
  const onToggle = vi.fn()
  render(<TaskList tasks={tasks} filter="all" onToggle={onToggle} onDelete={vi.fn()} onUpdate={vi.fn()} />)

  fireEvent.click(screen.getByRole('checkbox', { name: 'Preparar informe' }))
  expect(onToggle).toHaveBeenCalledWith(tasks[0])
})
~~~

### Qué estaba fallando y por qué esta solución es mejor

Las pruebas de componentes deben comprobar interacciones observables, no depender de la consola de Firebase ni de SES. Los mocks aíslan cada unidad y hacen repetible la suite; la limpieza del DOM entre pruebas evita que una renderización afecte a la siguiente.

### Aprendizaje e implementación

Aprendí a cubrir tanto la ruta de éxito como errores esperados. Se añadieron pruebas a TaskList, TaskSummary y el servicio de tareas; npm test ejecuta Vitest en modo no interactivo.

[↑ Volver al índice](#índice)

## 10. Documentar la aplicación para otra persona

### Prompt técnico reconstruido

> “Revisa la estructura real del proyecto y crea una guía breve para una persona que lo recibe: describe la app y cada botón, explica el flujo de Firebase y SES, indica comandos y variables, enlaza un registro detallado de IA y marca claramente cualquier ejemplo reconstruido.”

### Problema y diagnóstico

Una guía que solo enumera tecnologías no explica cómo usar ni ejecutar la app. A la vez, afirmar que los prompts inventados son conversaciones literales sería engañoso, por lo que el registro debe identificarlos como recreaciones.

### Respuesta de IA — resumen

Se organizó README.md como guía de instalación y uso y este archivo como bitácora técnica: prompt, respuesta, causa del error, solución, motivo de la decisión y aprendizaje. También se recomendó mantener los secretos fuera del repositorio.

### Qué estaba fallando y por qué esta solución es mejor

Separar la guía práctica del registro de IA evita un README demasiado extenso y permite que el lector encuentre primero cómo usar la app. La nota de transparencia diferencia el material ilustrativo del historial real.

### Aprendizaje e implementación

Aprendí que una documentación útil debe corresponder a rutas, comandos y variables existentes. El README enlaza a este archivo para ampliar el proceso de apoyo con IA.

[↑ Volver al índice](#índice)

## Nota de autoría

ChatGPT y Gemini se utilizaron como herramientas de apoyo para aprender, planificar, acelerar tareas, investigar errores y mejorar la documentación. Las propuestas de IA fueron revisadas y adaptadas. La autora realizó manualmente las configuraciones, los cambios, las pruebas y la revisión final del proyecto; la IA no sustituyó su participación ni sus decisiones.

[↑ Volver al índice](#índice)

