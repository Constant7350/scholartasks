// The team language check page (/check): shared names and the screen-by-screen tour.

/** Set on a reviewer's browser so their screens report to the check page. */
export const CHECK_COOKIE = "st-check";

export interface CheckScreen { route: string; title: string; open?: string; how?: string }
export interface CheckStep { id: string; title: string; todo: string; screens: CheckScreen[] }

/**
 * The tour, in the order a family meets the app. Every screen the word list knows about
 * belongs to one step; a screen added later that isn't listed here shows up in
 * "Pantallas nuevas" on its own, so nothing is missed.
 */
export const CHECK_STEPS: CheckStep[] = [
  {
    id: "start",
    title: "Paso 1: Empezar, familia, ayuda financiera y becas",
    todo: "Inicia sesión con tu cuenta de prueba y recorre estas pantallas en orden. Lee cada texto en voz baja: ¿suena natural para una familia latina? ¿Es claro?",
    screens: [
      { route: "/signin", title: "Iniciar sesión", how: "Cierra sesión primero para verla." },
      { route: "/reset", title: "Olvidé mi contraseña" },
      { route: "/join", title: "Unirse con un código (estudiante)" },
      { route: "/home", title: "Inicio" },
      { route: "/family", title: "Familia y permisos" },
      { route: "/aid", title: "FAFSA y formularios de ayuda", how: "Revisa con cuidado: aquí hay dinero y reglas. Abre cada paso." },
      { route: "/scholarships", title: "Becas", how: "Abre las preguntas, mira las pestañas y abre una beca guardada." },
      { route: "/tools/hope", title: "Revisión de becas estatales (sin cuenta)" },
    ],
  },
  {
    id: "plan",
    title: "Paso 2: Universidades, notas y tareas",
    todo: "Usa la familia de prueba (Emma). Abre cada lista, cada pestaña y cada botón de Agregar para ver todos los textos.",
    screens: [
      { route: "/plan", title: "Lista de universidades y fechas límite" },
      { route: "/plan/offers", title: "Comparar ofertas de ayuda" },
      { route: "/colleges", title: "Buscar universidades" },
      { route: "/colleges/compare", title: "Comparar universidades" },
      { route: "/majors", title: "Buscar por carrera" },
      { route: "/majors/quiz", title: "Test de carreras" },
      { route: "/grades", title: "Notas y becas estatales" },
      { route: "/grades/plan", title: "Plan de clases de 4 años" },
      { route: "/grades/record", title: "Historial académico para imprimir" },
      { route: "/todo", title: "Lista de tareas" },
    ],
  },
  {
    id: "rest",
    title: "Paso 3: Estudio, solicitudes y lo demás",
    todo: "Sigue con el resto de la aplicación. En las páginas largas, baja hasta el final.",
    screens: [
      { route: "/counselor", title: "Consejero de IA", how: "Las respuestas de la IA no están en esta lista; solo revisa los botones y textos fijos." },
      { route: "/homework", title: "Ayuda con la tarea" },
      { route: "/study", title: "Biblioteca de estudio" },
      { route: "/study/:id", title: "Una lección", open: "/study" },
      { route: "/practice", title: "Preguntas de práctica" },
      { route: "/test-prep", title: "Preparación para el SAT y ACT" },
      { route: "/activities", title: "Actividades y currículum" },
      { route: "/activities/common-app", title: "Listo para la Common App" },
      { route: "/activities/profile", title: "Perfil para solicitudes" },
      { route: "/activities/resume", title: "Currículum" },
      { route: "/essays", title: "Ensayos universitarios" },
      { route: "/trades", title: "Oficios y escuelas técnicas" },
      { route: "/trades/:slug", title: "Un oficio", open: "/trades" },
      { route: "/trades/quiz", title: "Test de oficios" },
      { route: "/trades/openings", title: "Aprendices y puestos locales" },
      { route: "/trades/post", title: "Publicar un puesto (empresas)" },
      { route: "/military", title: "Caminos militares" },
      { route: "/my-school", title: "Mi escuela" },
      { route: "/school", title: "Portal para consejeros" },
      { route: "/billing", title: "Plan y facturación" },
      { route: "/security", title: "Face ID, inicio de sesión y cuenta" },
      { route: "/delete-account", title: "Borrar la cuenta" },
      { route: "/invite", title: "Invitar a un amigo" },
      { route: "/rate", title: "Calificar ScholarTasks" },
      { route: "/help", title: "Ayuda", how: "Es larga: revisa la búsqueda y abre algunos temas." },
      { route: "/unsubscribe", title: "Dejar de recibir correos" },
    ],
  },
  {
    id: "site",
    title: "Paso 4: Sitio público y páginas legales",
    todo: "Estas son las páginas que ven las familias antes de crear una cuenta. Cierra sesión para verlas como un visitante.",
    screens: [
      { route: "/", title: "Página principal" },
      { route: "/features", title: "Funciones" },
      { route: "/compare", title: "Comparar aplicaciones" },
      { route: "/schools", title: "Para escuelas" },
      { route: "/about", title: "Quiénes somos" },
      { route: "/contact", title: "Contacto" },
      { route: "/privacy", title: "Política de privacidad", how: "Texto legal: marca lo que no se entienda, aunque sea correcto." },
      { route: "/terms", title: "Términos del servicio" },
      { route: "/accessibility", title: "Accesibilidad" },
    ],
  },
  {
    id: "mail",
    title: "Paso 5: Correos, textos y mensajes",
    todo: "Estos textos no están en una sola pantalla: son correos de recordatorio, textos y mensajes de error. Léelos aquí.",
    screens: [
      { route: "Emails and texts", title: "Correos y textos de recordatorio" },
      { route: "/messages", title: "Mensajes del servidor (errores y avisos)" },
      { route: "Shared pieces", title: "Piezas que se repiten en muchas pantallas", how: "Botones, avisos y ventanas que aparecen en varias páginas." },
    ],
  },
];
