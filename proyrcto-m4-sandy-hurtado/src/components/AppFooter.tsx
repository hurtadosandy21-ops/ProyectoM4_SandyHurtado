const currentYear = new Date().getFullYear()

export function AppFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <a className="footer-brand" href="/" aria-label="Mis tareas, inicio">
          Mis tareas<span>.</span>
        </a>
        <nav className="footer-links" aria-label="Redes y contacto">
          <a href="https://github.com/hurtadosandy21-ops" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1 1.69-.76 1.69-.76.09-.71.39-1.2.7-1.48-2.48-.28-5.09-1.24-5.09-5.53 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.62 5.24-5.11 5.52.4.35.75 1.03.75 2.08v3.09c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" />
            </svg>
            <span>GitHub</span>
          </a>
          <a href="https://www.linkedin.com/in/sandy-hurtado-a40aa1421" target="_blank" rel="noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.9H4.98V9.4h2.95v9.5ZM6.46 8.1a1.71 1.71 0 1 1 .02-3.42 1.71 1.71 0 0 1-.02 3.42ZM19 18.9h-2.94v-4.62c0-1.1-.02-2.51-1.53-2.51-1.53 0-1.77 1.2-1.77 2.43v4.7H9.82V9.4h2.82v1.3h.04c.39-.74 1.35-1.52 2.78-1.52 2.97 0 3.53 1.95 3.53 4.48v5.24Z" />
            </svg>
            <span>LinkedIn</span>
          </a>
          <a href="mailto:hurtadosandy21@gmail.com">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.5 5h17A1.5 1.5 0 0 1 22 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 17.5v-11A1.5 1.5 0 0 1 3.5 5Zm8.5 7.1L20 6H4l8 6.1Zm0 2.4L4 8.3v9.2h16V8.3l-8 6.2Z" />
            </svg>
            <span>hurtadosandy21@gmail.com</span>
          </a>
        </nav>
        <p className="footer-copyright">© {currentYear} Sandy Hurtado. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}
