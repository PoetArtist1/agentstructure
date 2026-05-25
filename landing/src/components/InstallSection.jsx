import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import './InstallSection.css'

const DOWNLOAD_URL = 'https://github.com/PoetArtist1/agentstructure/archive/refs/heads/main.zip'

const STEPS = [
  {
    title: 'Descarga',
    desc: 'Descarga el proyecto desde GitHub o clona el repositorio.',
    code: 'git clone https://github.com/PoetArtist1/agentstructure.git',
  },
  {
    title: 'Configura',
    desc: 'Ejecuta el instalador interactivo y responde las preguntas.',
    code: 'node install.js',
  },
  {
    title: 'Arranca',
    desc: 'Inicia el servidor o el agente con un solo comando.',
    code: 'npm start',
  },
]

export default function InstallSection() {
  const ref = useIntersectionObserver()

  return (
    <section className="install" id="install" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Instalación</span>
          <h2 className="section-title">Listo en 3 pasos</h2>
          <p className="section-subtitle">
            El instalador interactivo te guía en la configuración completa.
          </p>
        </div>

        <div className="install__steps">
          {STEPS.map((step, i) => (
            <div
              className="install-step fade-target"
              key={i}
              style={{ transitionDelay: `${i * 0.15}s` }}
            >
              <div className="install-step__number">{i + 1}</div>
              <div className="install-step__content">
                <h3 className="install-step__title">{step.title}</h3>
                <p className="install-step__desc">{step.desc}</p>
                <div className="install-step__code">
                  <code>{step.code}</code>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="install__cta">
          <a href={DOWNLOAD_URL} className="btn btn--primary btn--large">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar AgentStructure
          </a>
        </div>
      </div>
    </section>
  )
}
