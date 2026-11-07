import { FaqList } from "../parts";
import { LangPicker } from "../../lang-picker";

export const metadata = {
  title: "ScholarTasks en español · Universidad, becas y ayuda de Georgia en un solo plan",
  description:
    "ScholarTasks ayuda a las familias a planear, pagar y prepararse para la universidad o un oficio, desde el 6.º grado hasta la graduación: consejero con IA, becas, HOPE y Zell, calificaciones, SAT/ACT y todas las fechas límite.",
  alternates: { languages: { en: "/", es: "/es" } },
};

const FEATURES = [
  { icon: "💬", title: "Consejero con IA en español", text: "Responde sobre su estudiante, no con consejos generales. Conoce sus calificaciones, su lista de universidades, sus fechas y las reglas de Georgia. Orienta, pero nunca hace la tarea ni escribe ensayos." },
  { icon: "🎓", title: "Becas y ayudas", text: "Cientos de becas de Georgia y de todo el país, ordenadas en Califica, Tal vez y No aplica. Revisadas por nuestro equipo y actualizadas cada semana." },
  { icon: "📈", title: "Calificaciones y promedio HOPE", text: "Vea el promedio HOPE junto al promedio de la escuela desde el 8.º grado. Un plan de clases de 4 años suma los créditos para graduarse y las clases avanzadas que pide HOPE." },
  { icon: "🦉", title: "Ayuda con la tarea", text: "Un tutor seguro para todas las materias. Da una pista a la vez, revisa el trabajo del estudiante y nunca le da las respuestas." },
  { icon: "🧾", title: "FAFSA y ayuda de Georgia", text: "La FAFSA y el formulario de Georgia en pasos pequeños, con quién hace cada parte. Nunca pedimos el FSA ID ni el número de Seguro Social." },
  { icon: "✅", title: "Recordatorios", text: "Todas las fechas en una lista, con recordatorios por correo, mensaje de texto, calendario y teléfono." },
];

const FAQ = [
  { q: "¿Está todo en español?", a: "Sí. Toda la aplicación, los recordatorios y todas las respuestas de la IA (consejero, ayuda con la tarea, comentarios de ensayos y consejos de clases) están en español. Una persona bilingüe revisa cada traducción." },
  { q: "¿Cuánto cuesta?", a: "Las familias pueden empezar gratis, sin tarjeta de crédito. El plan Familiar tiene precio según el grado de su estudiante mayor, con 2 estudiantes incluidos y $2.99 al mes por cada estudiante adicional: grados 6 a 8 (Explorar) $6.99 al mes o $59 al año, grados 9 y 10 (Construir) $9.99 al mes o $79 al año, grados 11 y 12 (Solicitar) $12.99 al mes o $99 al año. Le avisamos unos 30 días antes de que cambie su nivel." },
  { q: "¿Es solo para Georgia?", a: "ScholarTasks se hizo en Georgia y conoce las reglas de HOPE, Zell Miller y la ayuda de Georgia. Las búsquedas siempre incluyen universidades, carreras y oficios de todo el país, y ya funciona en más estados del sureste." },
  { q: "¿Necesito número de Seguro Social o estatus migratorio para usarlo?", a: "No. ScholarTasks nunca pide el número de Seguro Social ni datos migratorios. Para la FAFSA y algunas becas sí hay reglas de ciudadanía; la app le explica cuáles aplican a su familia y muestra becas abiertas a todos." },
  { q: "¿La IA hará la tarea o escribirá los ensayos?", a: "No. Explica, hace preguntas y revisa el trabajo del propio estudiante. Nunca entrega respuestas ni escribe ensayos." },
  { q: "¿Mis datos están seguros?", a: "Nunca vendemos datos. Los padres controlan la cuenta y deciden lo que cada estudiante puede ver y cambiar. Puede borrar todo desde la app." },
];

/** The public website in Spanish. */
export default function Espanol() {
  return (
    <div lang="es">
      <section className="s-hero">
        <div className="site-wrap">
          <p className="s-kicker">Hecho en Georgia, para familias</p>
          <h1>La universidad y las becas, <em>por fin en un solo plan</em></h1>
          <p className="s-lede">
            ScholarTasks ayuda a su familia a planear, pagar y prepararse para la universidad o un oficio, desde el 6.º grado hasta la graduación. Un consejero con IA que conoce a su estudiante, becas, el promedio HOPE, preparación para el SAT y el ACT, y todas las fechas límite, en el teléfono y en la web.
          </p>
          <div className="s-cta">
            <a className="btn" href="/signin">Empezar gratis</a>
            <a className="btn btn-ghost" href="/contact">Hacer una pregunta</a>
          </div>
          <p className="s-fine">Gratis para empezar. Sin tarjeta de crédito. Después de entrar, elija <b>Español</b> en el menú.</p>
          <div style={{ maxWidth: 320, marginTop: 16 }}><LangPicker /></div>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Todo en un lugar</p>
          <h2 className="s-title">Una aplicación en lugar de diez</h2>
          <div className="s-grid">
            {FEATURES.map((f) => (
              <div className="s-card" key={f.title}>
                <span className="s-icon" aria-hidden="true">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section tint">
        <div className="site-wrap">
          <p className="s-kicker">Cómo funciona</p>
          <h2 className="s-title">Listo en pocos minutos</h2>
          <ol className="s-steps">
            <li><b>Un padre o madre se registra</b><span>Con contraseña, un enlace por correo o Google. Agregue a cada estudiante de la casa.</span></li>
            <li><b>Envíe el código</b><span>Toque Texto o Correo para enviarle a su estudiante un código corto. Lo escribe en su propio teléfono.</span></li>
            <li><b>Trabajen con un solo plan</b><span>Todo lo que agrega la familia queda en un plan compartido, con recordatorios antes de cada fecha.</span></li>
          </ol>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Preguntas frecuentes</p>
          <h2 className="s-title">Lo que preguntan las familias</h2>
          <FaqList items={FAQ} />
        </div>
      </section>

      <section className="s-section navy">
        <div className="site-wrap s-center">
          <h2 className="s-title">Empiece hoy el plan de su familia</h2>
          <p className="s-lede">Gratis para empezar, sin tarjeta de crédito. Se configura en pocos minutos.</p>
          <div className="s-cta" style={{ justifyContent: "center" }}>
            <a className="btn" href="/signin">Empezar gratis</a>
            <a className="btn btn-ghost" href="/contact">Hacer una pregunta</a>
          </div>
        </div>
      </section>
    </div>
  );
}
