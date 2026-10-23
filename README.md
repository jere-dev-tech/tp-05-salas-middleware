# Trabajo práctico 05

## Descripción

Aplicación web para consultar salas de estudio y reservar temporalmente un turno. Está desarrollada con Express, EJS y `express-ejs-layouts`, y mantiene las reservas únicamente en memoria durante la ejecución.

El trabajo se concentra en el orden y el alcance del pipeline de middleware: Morgan registra las solicitudes, dos middleware globales las identifican y miden, un middleware de router prepara el área de reservas y un middleware de ruta valida cada alta antes del handler final.

## Instalación

Con Node.js instalado, ejecutar desde la raíz del proyecto:

```bash
npm install
```

Las dependencias utilizadas son `express`, `ejs`, `express-ejs-layouts` y `morgan`.

## Ejecución

Para iniciar la aplicación:

```bash
npm start
```

El servidor queda disponible en `http://localhost:3000`.

Para comprobar la sintaxis de `src/index.js`:

```bash
npm run check
```

## Rutas

| Método | Ruta | Resultado esperado |
| --- | --- | --- |
| GET | `/` | Renderiza la página de inicio |
| GET | `/estado` | Devuelve el estado, la cantidad de reservas y el ID de solicitud |
| GET | `/reservas` | Muestra el listado de reservas |
| GET | `/reservas/nueva` | Muestra el formulario de alta |
| GET | `/reservas/:id` | Muestra una reserva o responde 404 si no existe |
| POST | `/reservas` | Valida, crea una reserva en memoria y redirige al listado |

Cualquier otra URL llega al middleware 404 global.

## Pipeline de middleware

El pipeline global respeta este orden:

```text
morgan("dev")
→ identificarSolicitud
→ medirDuracion
→ expressLayouts
→ express.static
→ express.urlencoded
→ express.json
→ rutas globales
→ reservasRouter
→ middleware 404 global
```

Morgan es middleware de terceros. `express.static`, `express.urlencoded` y `express.json` son middleware incorporados en Express. `identificarSolicitud`, `medirDuracion`, `prepararAreaReservas` y `validarReserva` son middleware personalizados.

Se utiliza `next()` cuando un middleware terminó su tarea y debe permitir que la solicitud continúe hacia la siguiente etapa. No se llama a `next()` después de enviar una respuesta final, como un error 400 o una página 404.

Los parsers aparecen antes de la validación porque deben interpretar el cuerpo de la solicitud y preparar `req.body`. `express.urlencoded` procesa formularios HTML y `express.json` procesa cuerpos JSON.

El alcance global afecta a todas las solicitudes posteriores al registro del middleware. El alcance de router se limita a las solicitudes montadas bajo `/reservas`. El alcance de ruta se aplica solamente al método y camino donde se registra, como `validarReserva` en `POST /reservas`.

`medirDuracion` usa el evento `finish` para calcular el tiempo cuando la respuesta terminó realmente. Así registra el estado HTTP definitivo y no una duración parcial.

Al montar `reservasRouter` en `/reservas`, sus rutas internas son relativas: `/` se convierte en `/reservas`, `/nueva` en `/reservas/nueva` y `/:id` en `/reservas/:id`.

### POST válido

```text
POST /reservas
↓ morgan("dev")
↓ identificarSolicitud
↓ medirDuracion
↓ expressLayouts
↓ express.urlencoded
↓ reservasRouter
↓ prepararAreaReservas
↓ validarReserva
↓ crearReserva
↓ 302 /reservas
↓ finish: ID + estado + duración
```

### POST inválido

```text
POST /reservas
↓ morgan("dev")
↓ identificarSolicitud
↓ medirDuracion
↓ expressLayouts
↓ express.urlencoded
↓ reservasRouter
↓ prepararAreaReservas
↓ validarReserva
↓ 400 + render formulario
↓ FIN
```

En el camino inválido, `validarReserva` envía la respuesta y `crearReserva` no se ejecuta.

## Alcance de cada función

- `identificarSolicitud`: middleware global que genera un ID consecutivo y lo guarda en `res.locals.solicitudId`.
- `medirDuracion`: middleware global que mide hasta `finish` y registra ID, método, URL, estado y milisegundos.
- `prepararAreaReservas`: middleware de router que define `res.locals.seccion` solamente dentro de `/reservas`.
- `validarReserva`: middleware de ruta que normaliza y valida el cuerpo del POST. Ante éxito prepara `req.reservaValidada` y llama a `next()`.
- `crearReserva`: handler final del POST; genera el ID, agrega la reserva en memoria y redirige.

## Validación

El servidor normaliza los textos con `trim()`, convierte `personas` con `Number()` y comprueba:

- campos obligatorios;
- sala incluida en `salasPermitidas`;
- turno igual a `Mañana`, `Tarde` o `Noche`;
- cantidad de personas entera entre 1 y 6;
- email con `@`.

Ante un dato inválido se responde con estado 400, se vuelve a renderizar el formulario, se conservan los valores y se muestra un mensaje con `role="alert"`. Ante un dato válido, `req.reservaValidada` pasa al handler `crearReserva`.

El POST válido responde primero con un 302 hacia `/reservas`. El navegador realiza después un GET separado al listado, que responde 200 y muestra la nueva reserva.

## Pruebas manuales

| Caso | Estado esperado | Evidencia a revisar |
| --- | --- | --- |
| Inicio | 200 | Navegación, cantidad e ID de solicitud |
| Estado | 200 | JSON con servicio, cantidad e ID |
| Listado | 200 | Cuatro o más reservas y enlaces |
| Estado vacío | 200 | Mensaje alternativo |
| Formulario | 200 | Controles con `label`, `id` y `name` |
| Detalle válido | 200 | Todos los datos de la reserva |
| Detalle inexistente | 404 | Página HTML de error |
| Campos vacíos | 400 | Error y valores conservados |
| Sala no permitida | 400 | No se crea la reserva |
| Turno no permitido | 400 | No se crea la reserva |
| Email sin `@` | 400 | No se crea la reserva |
| Personas igual a 0 | 400 | No se crea la reserva |
| Personas igual a 7 | 400 | No se crea la reserva |
| Reserva válida | 302 y luego 200 | Nueva tarjeta en el listado |
| URL inexistente | 404 | Middleware final |
| Reinicio | 200 | Regreso a las reservas iniciales |

En cada caso también se revisan la línea de Morgan y la medición personalizada con ID, estado y duración.

## Persistencia temporal

Las reservas iniciales y las altas se guardan en el arreglo `reservas` del proceso de Node.js. No se escriben archivos ni se utiliza una base de datos. Por eso, las reservas creadas durante una ejecución desaparecen al detener y reiniciar el servidor, y vuelven a quedar únicamente los datos iniciales definidos en `src/index.js`.
