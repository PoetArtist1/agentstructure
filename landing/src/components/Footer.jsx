import './Footer.css'

const GITHUB_URL = 'https://github.com/PoetArtist1/agentstructure'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="footer__logo">🔗 AgentStructure</span>
          <p className="footer__tagline">Túnel inverso seguro para bases de datos empresariales.</p>
        </div>
        <div className="footer__links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="footer__link">GitHub</a>
          <a href={`${GITHUB_URL}/blob/main/README.md`} target="_blank" rel="noreferrer" className="footer__link">Documentación</a>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer" className="footer__link">Reportar Bug</a>
        </div>
        <div className="footer__copy">
          &copy; {new Date().getFullYear()} AgentStructure — Proyecto de Tesis
        </div>
      </div>
    </footer>
  )
}
