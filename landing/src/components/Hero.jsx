import './Hero.css'

const DOWNLOAD_URL = 'https://github.com/PoetArtist1/agentstructure/archive/refs/heads/main.zip'
const GITHUB_URL = 'https://github.com/PoetArtist1/agentstructure'

export default function Hero() {
  return (
    <section className="hero" id="hero">
      <div className="container hero__inner">
        <div className="hero__badge">
          <span className="hero__badge-dot" />
          Open Source — Tesis de Grado
        </div>

        <h1 className="hero__title">
          Expón tus datos<br />
          <span className="hero__title--gradient">sin exponer tu red</span>
        </h1>

        <p className="hero__subtitle">
          AgentStructure es un túnel inverso que permite a las empresas compartir datos
          de sus bases de datos internas de forma segura, sin abrir puertos,
          sin compartir credenciales y con control total sobre lo que se expone.
        </p>

        <div className="hero__actions">
          <a href={DOWNLOAD_URL} className="btn btn--primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar Instalador
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn btn--secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            Ver en GitHub
          </a>
        </div>

        <div className="hero__terminal">
          <div className="terminal">
            <div className="terminal__bar">
              <div className="terminal__dots">
                <span className="terminal__dot terminal__dot--red" />
                <span className="terminal__dot terminal__dot--yellow" />
                <span className="terminal__dot terminal__dot--green" />
              </div>
              <span className="terminal__title">Terminal</span>
            </div>
            <div className="terminal__body">
              <div className="terminal__line">
                <span className="terminal__prompt">$</span>
                <span className="terminal__text terminal__text--typing">node install.js</span>
              </div>
              <div className="terminal__line terminal__line--output">
                <span className="terminal__text terminal__text--dim">🔗 AgentStructure — Instalador Interactivo</span>
              </div>
              <div className="terminal__line terminal__line--output terminal__line--delayed-1">
                <span className="terminal__text terminal__text--cyan">→</span>
                <span className="terminal__text"> ¿Qué desea instalar? </span>
                <span className="terminal__text terminal__text--green">[1] Agente  [2] Servidor</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
