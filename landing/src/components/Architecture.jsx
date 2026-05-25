import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import './Architecture.css'

const NODES = [
  {
    id: 'app',
    icon: '📱',
    label: 'App / Web',
    detail: <>POST /query/empresa_abc<br /><code>{`{ action: "get_clientes" }`}</code></>,
  },
  {
    id: 'server',
    icon: '🌐',
    label: 'Servidor Central',
    detail: <>Valida API Key<br />Reenvía acción + params<br /><strong>NO conoce el SQL</strong></>,
  },
  {
    id: 'agent',
    icon: '🤖',
    label: 'Agente On-Premise',
    detail: <>Resuelve acción → SQL<br />Valida params + read-only<br />Ejecuta query + auditoría</>,
  },
  {
    id: 'db',
    icon: '🗄️',
    label: 'Base de Datos',
    detail: <>SQL Server / PostgreSQL / MySQL</>,
  },
]

const ARROWS = [
  { label: 'HTTPS + API Key', type: '' },
  { label: 'WebSocket (outbound)', type: 'ws' },
  { label: 'Red Local', type: 'db' },
]

export default function Architecture() {
  const ref = useIntersectionObserver()

  return (
    <section className="architecture" id="architecture" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Arquitectura</span>
          <h2 className="section-title">Cómo funciona el túnel</h2>
          <p className="section-subtitle">
            La App envía un nombre de acción. El servidor la reenvía al agente.
            El agente resuelve el SQL localmente y devuelve los datos.
          </p>
        </div>

        <div className="arch-diagram">
          {NODES.map((node, i) => (
            <div key={node.id} className="arch-diagram__item">
              <div
                className={`arch-node arch-node--${node.id} fade-target`}
                style={{ transitionDelay: `${i * 0.15}s` }}
              >
                <div className="arch-node__icon">{node.icon}</div>
                <div className="arch-node__label">{node.label}</div>
                <div className="arch-node__detail">{node.detail}</div>
              </div>

              {i < ARROWS.length && (
                <div
                  className="arch-arrow fade-target"
                  style={{ transitionDelay: `${i * 0.15 + 0.08}s` }}
                >
                  <div className={`arch-arrow__line ${ARROWS[i].type ? `arch-arrow__line--${ARROWS[i].type}` : ''}`} />
                  <div className="arch-arrow__label">{ARROWS[i].label}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="arch-callout fade-target" style={{ transitionDelay: '0.6s' }}>
          <div className="arch-callout__icon">⚡</div>
          <div className="arch-callout__content">
            <strong>Punto clave:</strong> El servidor central es un broker puro.
            No almacena SQL, no conoce tablas, no tiene credenciales de bases de datos.
            Un ataque al servidor <strong>no compromete los datos de ningún cliente</strong>.
          </div>
        </div>
      </div>
    </section>
  )
}
