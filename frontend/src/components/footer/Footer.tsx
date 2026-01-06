import './Footer.css'

function Footer() {
    return (
        <footer className="mt-auto border-top bg-light">
            <div className="container py-3 d-flex flex-column flex-sm-row align-items-center justify-content-between gap-2">
                <div className="text-muted small">
                    © {new Date().getFullYear()} Association Familiale
                </div>
                <div className="d-flex align-items-center gap-3">
                    <a className="text-muted" href="#" aria-label="Email">
                        <i className="bi bi-envelope fs-5"></i>
                    </a>
                </div>
            </div>
        </footer>
    )
}

export default Footer
