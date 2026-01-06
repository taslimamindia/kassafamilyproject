import './Errors.css'

function Errors() {
  return (
    <section className="py-5">
      <div className="container d-flex align-items-center justify-content-center">
        <div className="text-center errors-card p-4 p-md-5">
          <div className="display-5 mb-2">😕</div>
          <h2 className="h4 fw-semibold mb-2">Quelque chose s'est mal passé</h2>
          <p className="text-muted mb-4">
            La page demandée est introuvable ou temporairement indisponible.
          </p>
          <a href="/" className="btn btn-primary">Retour à l'accueil</a>
        </div>
      </div>
    </section>
  )
}

export default Errors
