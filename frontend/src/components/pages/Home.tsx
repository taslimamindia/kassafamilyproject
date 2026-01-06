import './Home.css'

function Home() {
	return (
		<section className="py-4 py-md-5">
			<div className="container">
				<div className="row align-items-center g-4">
					<div className="col-12 col-md-6">
						<h1 className="display-6 fw-semibold mb-3">Bienvenue à l'Association Familiale</h1>
						<p className="lead mb-4">
							Renforcer les liens, soutenir les familles et bâtir une communauté solidaire.
						</p>
						<div className="d-flex gap-2">
							<a href="#" className="btn btn-primary">
								Nous rejoindre
							</a>
							<a href="#" className="btn btn-outline-primary">
								En savoir plus
							</a>
						</div>
					</div>
					<div className="col-12 col-md-6">
						<div className="home-illustration rounded-3"></div>
					</div>
				</div>
			</div>
		</section>
	)
}

export default Home
