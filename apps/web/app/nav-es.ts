import type { NavItem } from "./nav";

/**
 * Spanish names for the menu. Keyed by English label so a new page that
 * isn't translated yet simply shows in English. Pages themselves are being
 * translated step by step; the AI features already answer in Spanish.
 */
const ES: Record<string, [label: string, short?: string]> = {
  "Home": ["Inicio"],
  "To-do list": ["Lista de tareas", "Tareas"],
  "College list and deadlines": ["Universidades y fechas límite", "Plan"],
  "Find colleges": ["Buscar universidades", "Universidades"],
  "Search colleges by major": ["Buscar por carrera", "Por carrera"],
  "Career quiz": ["¿Qué carrera me queda?", "Test de carreras"],
  "Trades and trade schools": ["Oficios y escuelas técnicas", "Oficios"],
  "Grades and scholarships": ["Calificaciones y becas", "Notas"],
  "Four-year course plan": ["Plan de clases de 4 años", "Plan de clases"],
  "Academic record (print)": ["Historial académico (imprimir)", "Historial"],
  "College essays": ["Ensayos universitarios", "Ensayos"],
  "Activities and resume": ["Actividades y currículum", "Actividades"],
  "Application profile (copy and paste)": ["Perfil para solicitudes (copiar y pegar)", "Perfil"],
  "Common App ready": ["Listo para el Common App", "Common App"],
  "Scholarships and grants": ["Becas y ayudas", "Becas"],
  "FAFSA and aid forms": ["FAFSA y formularios de ayuda", "Ayuda"],
  "Compare aid offers": ["Comparar ofertas de ayuda", "Ofertas"],
  "Homework Helper": ["Ayuda con la tarea", "Tarea"],
  "AI counselor": ["Consejero con IA", "Consejero"],
  "Study skills library": ["Técnicas de estudio", "Estudio"],
  "Practice questions": ["Preguntas de práctica", "Práctica"],
  "SAT and ACT prep": ["Preparación SAT y ACT", "SAT/ACT"],
  "Family, students and permissions": ["Familia, estudiantes y permisos"],
  "Set up my family (parents)": ["Crear mi familia (padres)"],
  "I'm a student: join with a code": ["Soy estudiante: unirme con un código"],
  "My school (connect to your counselor)": ["Mi escuela (conectar con su consejero)", "Mi escuela"],
  "School counselor portal (free)": ["Portal para consejeros escolares (gratis)"],
  "Face ID, sign-in and account": ["Face ID, inicio de sesión y cuenta", "Cuenta"],
  "Plan and billing": ["Plan y pagos", "Pagos"],
  "Help and how-to": ["Ayuda y guías"],
};

export function navLabel(i: NavItem, lang: "en" | "es"): string {
  return lang === "es" ? ES[i.label]?.[0] ?? i.label : i.label;
}
export function navShort(i: NavItem, lang: "en" | "es"): string {
  if (lang !== "es") return i.short ?? i.label;
  const e = ES[i.label];
  return e?.[1] ?? e?.[0] ?? i.short ?? i.label;
}

/** Words in the top bar and menu. */
export const UI = {
  en: { menu: "Menu", openMenu: "Open menu", signIn: "Sign in", signOut: "Sign out", more: "More", viewing: "Viewing", myPages: "My pages", pages: "Pages", pagesOf: (n: string) => `${n}'s pages`, family: "Family", connected: "Get connected", help: "Help", team: "ScholarTasks team" },
  es: { menu: "Menú", openMenu: "Abrir menú", signIn: "Iniciar sesión", signOut: "Cerrar sesión", more: "Más", viewing: "Viendo", myPages: "Mis páginas", pages: "Páginas", pagesOf: (n: string) => `Páginas de ${n}`, family: "Familia", connected: "Conectarse", help: "Ayuda", team: "Equipo de ScholarTasks" },
} as const;
