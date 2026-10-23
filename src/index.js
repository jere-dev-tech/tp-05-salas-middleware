const express = require("express");
const path = require("node:path");
const expressLayouts = require("express-ejs-layouts");
const morgan = require("morgan");

const app = express();

const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.set("layout", "layouts/main");

let contadorSolicitudes = 0;

function identificarSolicitud(req, res, next) {
  contadorSolicitudes += 1;
  const numeroFormateado = String(contadorSolicitudes).padStart(4, "0");

  res.locals.solicitudId = `BIB-${numeroFormateado}`;
  next();
}

function medirDuracion(req, res, next) {
  const tiempoInicial = Date.now();

  res.on("finish", () => {
    const duracion = Date.now() - tiempoInicial;

    console.log(
      `${res.locals.solicitudId} ${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ${duracion} ms`
    );
  });

  next();
}

app.use(morgan("dev"));
app.use(identificarSolicitud);
app.use(medirDuracion);
app.use(expressLayouts);
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const salasPermitidas = [
  "Sala Norte",
  "Sala Sur",
  "Sala Multimedia"
];

const reservas = [
  {
    id: 1,
    estudiante: "Lucía Fernández",
    email: "lucia.fernandez@universidad.edu.ar",
    sala: "Sala Norte",
    fecha: "2026-10-13",
    turno: "Mañana",
    personas: 3
  },
  {
    id: 2,
    estudiante: "Mateo Ramírez",
    email: "mateo.ramirez@universidad.edu.ar",
    sala: "Sala Multimedia",
    fecha: "2026-10-14",
    turno: "Tarde",
    personas: 5
  },
  {
    id: 3,
    estudiante: "Sofía Benítez",
    email: "sofia.benitez@universidad.edu.ar",
    sala: "Sala Sur",
    fecha: "2026-10-16",
    turno: "Noche",
    personas: 2
  },
  {
    id: 4,
    estudiante: "Tomás Acosta",
    email: "tomas.acosta@universidad.edu.ar",
    sala: "Sala Norte",
    fecha: "2026-10-19",
    turno: "Tarde",
    personas: 4
  }
];

app.get("/", (req, res) => {
  res.render("inicio", {
    titulo: "Reservas de salas de estudio",
    cantidadReservas: reservas.length
  });
});

app.get("/estado", (req, res) => {
  res.json({
    servicio: "activo",
    reservas: reservas.length,
    solicitudId: res.locals.solicitudId
  });
});

const reservasRouter = express.Router();

function prepararAreaReservas(req, res, next) {
  res.locals.seccion = "Reservas de salas";
  next();
}

function validarReserva(req, res, next) {
  const cuerpo = req.body ?? {};
  const estudiante = String(cuerpo.estudiante ?? "").trim();
  const email = String(cuerpo.email ?? "").trim();
  const sala = String(cuerpo.sala ?? "").trim();
  const fecha = String(cuerpo.fecha ?? "").trim();
  const turno = String(cuerpo.turno ?? "").trim();
  const personasTexto = String(cuerpo.personas ?? "").trim();
  const personas = Number(personasTexto);
  const valores = {
    estudiante,
    email,
    sala,
    fecha,
    turno,
    personas: personasTexto
  };

  let error = null;

  if (!estudiante || !email || !sala || !fecha || !turno || !personasTexto) {
    error = "Todos los campos son obligatorios.";
  } else if (!salasPermitidas.includes(sala)) {
    error = "La sala seleccionada no está permitida.";
  } else if (!["Mañana", "Tarde", "Noche"].includes(turno)) {
    error = "El turno seleccionado no está permitido.";
  } else if (!Number.isInteger(personas) || personas < 1 || personas > 6) {
    error = "La cantidad de personas debe ser un número entero entre 1 y 6.";
  } else if (!email.includes("@")) {
    error = "El email debe contener @.";
  }

  if (error) {
    return res.status(400).render("reservas/nueva", {
      titulo: "Nueva reserva",
      salasPermitidas,
      error,
      valores
    });
  }

  req.reservaValidada = {
    estudiante,
    email,
    sala,
    fecha,
    turno,
    personas
  };

  next();
}

function crearReserva(req, res) {
  const nuevoId = reservas.length > 0
    ? Math.max(...reservas.map((reserva) => reserva.id)) + 1
    : 1;

  reservas.push({
    id: nuevoId,
    ...req.reservaValidada
  });

  res.redirect("/reservas");
}

reservasRouter.use(prepararAreaReservas);

reservasRouter.get("/", (req, res) => {
  res.render("reservas/lista", {
    titulo: "Reservas",
    reservas
  });
});

reservasRouter.get("/nueva", (req, res) => {
  res.render("reservas/nueva", {
    titulo: "Nueva reserva",
    salasPermitidas,
    error: null,
    valores: {}
  });
});

reservasRouter.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  const reserva = reservas.find((reservaActual) => reservaActual.id === id);

  if (!reserva) {
    return res.status(404).render("no-encontrado", {
      titulo: "Reserva no encontrada",
      mensaje: "La reserva solicitada no existe."
    });
  }

  res.render("reservas/detalle", {
    titulo: `Reserva de ${reserva.estudiante}`,
    reserva
  });
});

reservasRouter.post("/", validarReserva, crearReserva);

app.use("/reservas", reservasRouter);

app.use((req, res) => {
  res.status(404).render("no-encontrado", {
    titulo: "Página no encontrada",
    mensaje: "La dirección solicitada no existe."
  });
});

app.listen(PORT, () => {
  console.log(`Servidor disponible en http://localhost:${PORT}`);
});
