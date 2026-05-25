import { useState } from 'react'
import { useIntersectionObserver } from '../hooks/useIntersectionObserver'
import './InstallSection.css'

const WINDOWS_INSTALLER_URL = 'https://github.com/PoetArtist1/agentstructure/releases/latest/download/AgentStructureInstaller.exe'
const SOURCE_ZIP_URL = 'https://github.com/PoetArtist1/agentstructure/archive/refs/heads/main.zip'

const CLI_STEPS = [
  {
    title: 'Descarga',
    desc: 'Descarga el código fuente o clona el repositorio en tu VPS/Servidor.',
    code: 'git clone https://github.com/PoetArtist1/agentstructure.git',
  },
  {
    title: 'Configura',
    desc: 'Ejecuta el instalador interactivo por consola y responde el asistente.',
    code: 'node install.js',
  },
  {
    title: 'Arranca',
    desc: 'Inicia el servidor o el agente. Se mantendrán activos en la consola actual.',
    code: 'npm start',
  },
]

export default function InstallSection() {
  const ref = useIntersectionObserver()
  const [activeTab, setActiveTab] = useState('gui')

  return (
    <section className="install" id="install" ref={ref}>
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Instalación</span>
          <h2 className="section-title">Elige tu método de instalación</h2>
          <p className="section-subtitle">
            Elige el asistente visual para Windows o despliega manualmente por consola para servidores VPS.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="install__tabs">
          <button
            className={`install__tab-btn ${activeTab === 'gui' ? 'active' : ''}`}
            onClick={() => setActiveTab('gui')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
            Asistente de Escritorio (Windows)
          </button>
          <button
            className={`install__tab-btn ${activeTab === 'cli' ? 'active' : ''}`}
            onClick={() => setActiveTab('cli')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            Terminal / VPS (Multiplataforma)
          </button>
        </div>

        {activeTab === 'gui' ? (
          /* GUI Tab Content */
          <div className="install__gui-content fade-target active">
            <div className="gui-feature-grid">
              <div className="gui-feature-card">
                <span className="gui-feature-icon">🖥️</span>
                <h4>Interfaz Gráfica limpia</h4>
                <p>Configura tu base de datos, puertos, credenciales e IDs mediante formularios interactivos sin usar comandos.</p>
              </div>
              <div className="gui-feature-card">
                <span className="gui-feature-icon">⚙️</span>
                <h4>Servicio de Windows Integrado</h4>
                <p>El instalador crea y registra un servicio del sistema. El agente o servidor correrá en segundo plano y nunca se apagará.</p>
              </div>
              <div className="gui-feature-card">
                <span className="gui-feature-icon">🔄</span>
                <h4>Reinicio Automático</h4>
                <p>El servicio se iniciará automáticamente junto con Windows tras cualquier reinicio del equipo o del servidor.</p>
              </div>
            </div>

            <div className="install__cta" style={{ marginTop: '2rem' }}>
              <a href={WINDOWS_INSTALLER_URL} className="btn btn--primary btn--large">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Descargar Instalador de Windows (.exe)
              </a>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                Compatible con Windows 10, 11 y Windows Server (requiere ejecutar como Administrador).
              </p>
            </div>
          </div>
        ) : (
          /* CLI Tab Content */
          <div className="install__cli-content fade-target active">
            <div className="install__steps">
              {CLI_STEPS.map((step, i) => (
                <div
                  className="install-step"
                  key={i}
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
              <a href={SOURCE_ZIP_URL} className="btn btn--secondary btn--large" style={{ border: '1px solid var(--border-card)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Descargar Código Fuente (.zip)
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
