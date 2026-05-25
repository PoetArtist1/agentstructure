import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import './Features.css'

const FEATURES = [
  {
    icon: '🛡️',
    title: 'Soberanía del Dato',
    desc: 'Las queries SQL viven en el agente, no en el servidor. Un breach al servidor <strong>no expone</strong> el esquema de ningún cliente.',
  },
  {
    icon: '🔗',
    title: 'Túnel Inverso',
    desc: 'Conexión outbound desde el cliente. <strong>Sin abrir puertos</strong> en el router. Sin VPN. Sin túneles SSH.',
  },
  {
    icon: '🗄️',
    title: 'Multi-Motor de BD',
    desc: 'Soporta <strong>SQL Server</strong>, <strong>PostgreSQL</strong> y <strong>MySQL/MariaDB</strong>. El motor se elige con un solo campo en la configuración.',
  },
  {
    icon: '🔒',
    title: 'Modo Solo-Lectura',
    desc: 'Bloquea INSERT, UPDATE, DELETE, DROP y más. <strong>Garantía contractual</strong> de que solo se leen datos.',
  },
  {
    icon: '📝',
    title: 'Auditoría Completa',
    desc: 'Cada acción se registra con fecha, parámetros, resultado y tiempo. <strong>Trazabilidad total</strong> para la empresa.',
  },
  {
    icon: '🔐',
    title: 'Doble Autenticación',
    desc: '<strong>API Key</strong> para las Apps + <strong>Secret por agente</strong> para las conexiones WS. Dos capas independientes.',
  },
]

export default function Features() {
  const ref = useIntersectionObserver()

  return (
    <section className="features" id="features" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Características</span>
          <h2 className="section-title">
            Seguridad por diseño,<br />no por configuración
          </h2>
          <p className="section-subtitle">
            Cada decisión arquitectónica fue tomada pensando en la seguridad y soberanía del dato empresarial.
          </p>
        </div>

        <div className="features__grid">
          {FEATURES.map((feat, i) => (
            <div
              className="feature-card fade-target"
              key={i}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <div className="feature-card__icon">{feat.icon}</div>
              <h3 className="feature-card__title">{feat.title}</h3>
              <p
                className="feature-card__desc"
                dangerouslySetInnerHTML={{ __html: feat.desc }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
