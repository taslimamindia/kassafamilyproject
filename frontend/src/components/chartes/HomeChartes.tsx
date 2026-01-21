import React from 'react';
import './HomeChartes.css';

const HomeChartes: React.FC = () => {
    return (
        <div className="chartes-container">
            <header className="chartes-header">
                <h1>STATUTS DU GROUPE Les Cousins Solidaires et Unis</h1>
                <p className="intro-text">
                    Le groupe s’appelle <strong>« Les Cousins Solidaires et Unis »</strong>. Il est une initiative familiale à but non lucratif fondée sur l’entraide, l’unité, et le développement collectif.
                </p>
            </header>

            <section className="charte-section">
                <h2>Article 1 : Objectifs</h2>
                <ul>
                    <li>Renforcer les liens familiaux.</li>
                    <li>S'entraider lors des événements heureux ou difficiles (mariage, décès, maladie, etc.).</li>
                    <li>Réaliser des projets communs (ex. : sacrifice pour notre grand-mère, reconstruction de sa maison à Kassa).</li>
                    <li>Créer une caisse de solidarité mensuelle.</li>
                </ul>
            </section>

            <section className="charte-section">
                <h2>Article 2 : Membres</h2>
                <p>
                    Tout membre de la famille désirant s’impliquer activement peut rejoindre le groupe, à condition de respecter les présents statuts.
                </p>
            </section>

            <section className="charte-section">
                <h2>Article 3 : Organisation</h2>
                <p>Le groupe est dirigé par un bureau composé de :</p>
                <ul>
                    <li>1 Président(e)</li>
                    <li>1 Vice-président(e)</li>
                    <li>1 Secrétaire</li>
                    <li>1 Trésorier(e)</li>
                </ul>
            </section>

            <div className="divider"></div>

            <header className="chartes-header secondary-header">
                <h1>RÈGLEMENT INTÉRIEUR</h1>
            </header>

            <section className="charte-section">
                <h2>Article 4 : Cotisations</h2>
                <p>
                    Chaque membre s’engage à verser <strong>une cotisation mensuelle</strong> dont le montant sera défini en commun. Cet argent sera utilisé pour :
                </p>
                <ul>
                    <li>les urgences familiales,</li>
                    <li>les soutiens lors de cérémonies,</li>
                    <li>les projets familiaux à long terme.</li>
                </ul>

                <div className="cotisation-details">
                    <h3>1. Prix de versement / Montant de la cotisation</h3>
                    <div className="pricing-cards">
                        <div className="pricing-card">
                            <h4>Résidant en Guinée (moins de 18 ans)</h4>
                            <p className="price">20.000 FG / an</p>
                        </div>
                        <div className="pricing-card">
                            <h4>Résidant en Guinée (18 ans et plus, sans activité)</h4>
                            <p className="price">20.000 FG / mois</p>
                        </div>
                        <div className="pricing-card">
                            <h4>Résidant en Guinée (Autres)</h4>
                            <p className="price">50.000 FG / mois</p>
                            <p className="note">(Minimum obligatoire, possibilité de donner plus)</p>
                        </div>
                        <div className="pricing-card">
                            <h4>Extérieur de la Guinée</h4>
                            <p className="price">1.000.000 FG / an</p>
                            <p className="note">(Minimum obligatoire, possibilité de donner plus)</p>
                        </div>
                    </div>

                    <h3>2. Délais de paiement</h3>
                    <p>Fréquence : <strong>Par mois</strong> (ou annuel pour les résidents extérieurs).</p>
                    <p>Pour les cotisations annuelles, elles sont dues en début d'exercice (ou selon accord).</p>

                    <h3>3. Amendes et sanctions</h3>
                    <p><strong>Pour non-paiement ou retard de paiement :</strong> <em>Définition à venir</em></p>
                    <p><strong>Pour non-respect des règles :</strong> <em>Définition à venir</em></p>
                </div>
            </section>
        </div>
    );
};

export default HomeChartes;
