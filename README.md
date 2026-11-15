# Mis tareas — Proyecto M4

Aplicación web para organizar tareas personales. Cada persona crea una cuenta, verifica su correo y administra su lista privada. También puede consultar un resumen y solicitar que se envíe a su correo.

## Enlaces

| Recurso | Enlace |
| --- | --- |
| Aplicación desplegada | [proyecto-m4-sandy-hurtado.vercel.app](https://proyecto-m4-sandy-hurtado.vercel.app) |
| Registro del uso de IA | [IA.md](./proyrcto-m4-sandy-hurtado/IA.md) |
| Endpoint del resumen | POST /api/send-summary |

## Índice

- [¿Qué es la aplicación?](#qué-es-la-aplicación)
- [¿Cómo funciona?](#cómo-funciona)
- [Botones y controles](#botones-y-controles)
- [Tecnologías y estructura](#tecnologías-y-estructura)
- [Datos y seguridad](#datos-y-seguridad)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Firebase y Amazon SES](#firebase-y-amazon-ses)
- [API de resumen](#api-de-resumen)
- [Comandos y pruebas](#comandos-y-pruebas)
- [Despliegue en Vercel](#despliegue-en-vercel)
- [Uso de inteligencia artificial](#uso-de-inteligencia-artificial)

## ¿Qué es la aplicación?

**Mis tareas** es una aplicación de gestión de tareas creada como proyecto académico. Permite registrarse e iniciar sesión con correo y contraseña, confirmar la dirección de correo y mantener una lista de tareas privada que se guarda en Cloud Firestore.

[↑ Volver al índice](#índice)

## ¿Cómo funciona?

1. La persona crea una cuenta o inicia sesión con Firebase Authentication.
2. Al registrarse, Firebase envía un enlace de verificación. La aplicación permite reenviarlo y comprobar el estado actualizado de la cuenta.
3. Después de verificar el correo, la persona puede crear tareas con título y descripción opcional.
4. Firestore guarda las tareas y sincroniza la lista. Cada tarea puede completarse, editarse o eliminarse.
5. La sección de resumen calcula el total, las tareas pendientes y las completadas; también permite ver una vista previa.
6. Al solicitar el envío, la API valida el token y el correo verificado, consulta solo las tareas de esa cuenta y utiliza Amazon SES para enviar el mensaje.

Flujo técnico del resumen: **React → API de Vercel → Firebase Admin → Firestore → Amazon SES**.

[↑ Volver al índice](#índice)

## Botones y controles

| Control | Acción |
| --- | --- |
| **Iniciar sesión** | Accede con una cuenta existente de Firebase Authentication. |
| **Crear cuenta** | Registra la cuenta y solicita verificar el correo. |
| **¿Olvidaste tu contraseña?** | Envía a la dirección escrita un enlace de recuperación de Firebase. |
| **Ya verifiqué mi correo** | Actualiza el estado de la cuenta después de abrir el enlace de verificación. |
| **Reenviar enlace** | Envía de nuevo el correo de verificación. |
| **Agregar tarea** | Guarda una tarea con título y descripción opcional. |
| **Mostrar: Todas / Pendientes / Completadas** | Filtra la lista por estado. |
| **Casilla de tarea** | Cambia la tarea entre pendiente y completada. |
| **Editar** | Abre el formulario para cambiar título o descripción. **Guardar** aplica los cambios y **Cancelar** cierra la edición. |
| **Eliminar** | Borra la tarea de la cuenta. |
| **Ver vista previa** | Muestra u oculta las tareas que aparecerán en el resumen. |
| **Enviar resumen a mi correo** | Solicita al servidor enviar el resumen a la dirección de la cuenta. |
| **Cerrar sesión** | Finaliza la sesión actual. |

El envío requiere iniciar sesión y tener el correo verificado en Firebase. SES debe tener habilitada la región, el remitente y el nivel de envío adecuados; en sandbox también puede exigir que el destinatario esté verificado.

[↑ Volver al índice](#índice)

## Tecnologías y estructura

La interfaz usa **React**, **TypeScript** y **Vite**. **Firebase Authentication** gestiona las cuentas y **Cloud Firestore** almacena las tareas. La ruta de API de Vercel usa **Firebase Admin** para validar la sesión y **Amazon SES** para enviar el resumen.

El código ejecutable está en la carpeta **proyrcto-m4-sandy-hurtado/**. Las rutas de la tabla son relativas a esa carpeta.

| Ruta | Responsabilidad |
| --- | --- |
| src/App.tsx | Autenticación, formularios y composición de la pantalla principal. |
| src/components/TaskList.tsx | Filtros, cambio de estado, edición y eliminación de tareas. |
| src/components/TaskSummary.tsx | Contadores, vista previa y solicitud de envío. |
| src/services/firebase.ts | Inicialización de Firebase en el navegador. |
| src/services/tasks.ts | Operaciones y suscripción en tiempo real a Firestore. |
| src/types/task.ts | Tipos de datos de las tareas. |
| api/send-summary.ts | Endpoint que valida la cuenta, obtiene tareas y envía el correo. |
| firestore.rules | Reglas de acceso a los documentos de tareas. |
| src/components/*.test.tsx | Pruebas de componentes. |
| src/services/*.test.ts | Pruebas del servicio de tareas. |

[↑ Volver al índice](#índice)

## Datos y seguridad

Los documentos de la colección **tasks** contienen el identificador del propietario, título, descripción, estado de completado y fecha de creación. Las reglas de Firestore permiten leer, editar o eliminar una tarea solo a su propietario. La API también filtra por UID antes de preparar el resumen.

El servidor verifica el token de Firebase y exige que el correo esté confirmado. Las claves de AWS y la cuenta de servicio de Firebase Admin son secretos de servidor: no deben tener el prefijo **VITE_**, exponerse al navegador ni subirse al repositorio. El archivo **.env.example** contiene nombres de variables sin valores secretos.

[↑ Volver al índice](#índice)

## Instalación local

Se necesita Node.js, npm, el repositorio y acceso al proyecto Firebase.

Desde PowerShell, en la carpeta del repositorio:

~~~powershell
cd proyrcto-m4-sandy-hurtado
npm install
Copy-Item .env.example .env.local
npm run dev
~~~

Completa **.env.local** con los valores correspondientes de **.env.example**. No compartas este archivo. El comando **npm run dev** inicia el frontend con Vite; el endpoint de correo es una función de Vercel y no se ejecuta con Vite por sí solo. Para probar la API localmente, configura las variables y utiliza Vercel CLI con **vercel dev**; si no, prueba el botón en el despliegue de Vercel.

[↑ Volver al índice](#índice)

## Variables de entorno

Configura las variables en **.env.local** para el desarrollo local o en **Vercel → Project Settings → Environment Variables** para el despliegue. Las variables con prefijo **VITE_** se incluyen en el frontend. Las demás son solo del servidor.

| Variable | Uso | Tipo |
| --- | --- | --- |
| VITE_FIREBASE_API_KEY | Identifica la aplicación web de Firebase. | Frontend |
| VITE_FIREBASE_AUTH_DOMAIN | Dominio de autenticación de Firebase. | Frontend |
| VITE_FIREBASE_PROJECT_ID | ID del proyecto Firebase. | Frontend |
| VITE_FIREBASE_STORAGE_BUCKET | Bucket configurado para el proyecto. | Frontend |
| VITE_FIREBASE_MESSAGING_SENDER_ID | ID de envío de mensajes de Firebase. | Frontend |
| VITE_FIREBASE_APP_ID | ID de la aplicación web Firebase. | Frontend |
| AWS_REGION | Región de SES; esta app usa us-east-2. | Servidor |
| AWS_ACCESS_KEY_ID | ID de la credencial IAM autorizada para SES. | Secreto del servidor |
| AWS_SECRET_ACCESS_KEY | Secreto de la credencial IAM. | Secreto del servidor |
| SES_FROM_EMAIL | Dirección remitente verificada en SES. | Servidor |
| FIREBASE_ADMIN_SERVICE_ACCOUNT | JSON de la cuenta de servicio para Firebase Admin. | Secreto del servidor |

No compartas las credenciales IAM ni el JSON de Firebase Admin. Si se modifica una variable en Vercel, crea un nuevo despliegue para que el cambio tenga efecto.

[↑ Volver al índice](#índice)

## Firebase y Amazon SES

### Firebase

1. En Firebase Console, habilita **Authentication → Correo electrónico/contraseña**.
2. Crea la base de datos **Cloud Firestore**.
3. Configura las variables **VITE_FIREBASE_...** con los valores de la aplicación web.
4. Publica **firestore.rules** en la sección de reglas de Firestore.
5. Para el endpoint, crea una cuenta de servicio de Firebase Admin y guarda su JSON como **FIREBASE_ADMIN_SERVICE_ACCOUNT** en la configuración privada del servidor.

### Amazon SES

1. Usa la región **us-east-2** en SES y en **AWS_REGION**.
2. Verifica en SES la dirección remitente y asígnala a **SES_FROM_EMAIL**.
3. Crea credenciales IAM con permiso de envío de SES y asígnalas a **AWS_ACCESS_KEY_ID** y **AWS_SECRET_ACCESS_KEY**.
4. Mientras la cuenta esté en sandbox, SES restringe los destinatarios. Para enviar a correos de usuarios sin verificarlos uno por uno, la cuenta debe tener acceso de producción aprobado por AWS.
5. Configura estas variables en Vercel y vuelve a desplegar después de guardarlas.

El remitente verificado de SES y los correos verificados por Firebase cumplen funciones diferentes: SES autoriza desde dónde sale el mensaje; Firebase confirma la cuenta de la persona que lo recibe.

[↑ Volver al índice](#índice)

## API de resumen

**POST /api/send-summary** no requiere cuerpo JSON. El navegador adjunta el token de Firebase en el encabezado **Authorization: Bearer <ID_TOKEN>**.

| Respuesta | Significado |
| --- | --- |
| 200 | El resumen se envió correctamente. |
| 401 | Falta el token o la sesión no es válida. |
| 403 | El correo de la cuenta todavía no está verificado. |
| 500 | Falló la configuración o el envío desde el servidor. |

El servidor obtiene el destinatario desde el token validado, lee únicamente las tareas de ese UID y genera los conteos y el listado para el correo.

[↑ Volver al índice](#índice)

## Comandos y pruebas

Ejecuta los comandos desde **proyrcto-m4-sandy-hurtado/**.

| Comando | Descripción |
| --- | --- |
| npm run dev | Inicia el frontend local con Vite. |
| npm run test | Ejecuta las pruebas con Vitest y Testing Library. |
| npm run lint | Revisa el código con Oxlint. |
| npm run build | Comprueba TypeScript y crea la compilación de producción. |
| npm run preview | Muestra localmente la compilación generada. |

La suite cuenta con **11 pruebas** en tres archivos: verifica filtros, estado vacío, acciones de la lista, contadores, vista previa, envío y manejo de errores del resumen, y operaciones del servicio de tareas.

Antes de desplegar, ejecuta:

~~~powershell
npm test
npm run lint
npm run build
~~~

[↑ Volver al índice](#índice)

## Despliegue en Vercel

1. Conecta el repositorio con Vercel.
2. Configura **proyrcto-m4-sandy-hurtado** como **Root Directory**.
3. Añade las variables de entorno del frontend y del servidor en **Project Settings → Environment Variables**.
4. Comprueba que el comando de compilación use el script **npm run build**.
5. Despliega el proyecto. Tras modificar variables de entorno, genera un nuevo despliegue.

[↑ Volver al índice](#índice)

## Uso de inteligencia artificial

Se utilizaron **ChatGPT** y **Gemini** como apoyo para aprender, planificar funciones, investigar errores y mejorar la documentación. Las respuestas se revisaron y adaptaron manualmente durante el desarrollo.

En [IA.md](./proyrcto-m4-sandy-hurtado/IA.md) se presenta un registro técnico ampliado con prompts reconstruidos, fragmentos de código, causas de errores, soluciones y aprendizajes. Los ejemplos se identifican como reconstrucciones y no como transcripciones literales.

[↑ Volver al índice](#índice)
