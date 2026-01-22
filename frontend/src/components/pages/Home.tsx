import { useState, useEffect } from 'react'
import './Home.css'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'

const homeResources = {
    fr: {
        home: {
            title: "Bienvenue à l'Association Familiale",
            lead: 'Renforcer les liens, soutenir les familles et bâtir une communauté solidaire.',
            join: 'Nous rejoindre',
            learnMore: 'En savoir plus',
            altParents: 'Photo des parents',
        },
    },
    en: {
        home: {
            title: 'Welcome to the Family Association',
            lead: 'Strengthen bonds, support families, and build a caring community.',
            join: 'Join us',
            learnMore: 'Learn more',
            altParents: 'Parents photo',
        },
    },
    ar: {
        home: {
            title: 'مرحبًا بكم في الجمعية العائلية',
            lead: 'تعزيز الروابط، دعم الأسر، وبناء مجتمع متكافل.',
            join: 'انضم إلينا',
            learnMore: 'اعرف المزيد',
            altParents: 'صورة الوالدين',
        },
    },
}

for (const [lng, res] of Object.entries(homeResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function Home() {
    const { t } = useTranslation()
    const [images, setImages] = useState<string[]>([])
    
    useEffect(() => {
        const checkImages = async () => {
            const baseUrl = "public/images";
			const extensions = ['jpg', 'jpeg', 'png'];
            const promises = [];

            for (let i = 1; i <= 15; i++) {
                for (const ext of extensions) {
                    promises.push(
                        new Promise<string | null>((resolve) => {
                            const url = `${baseUrl}/img${i}.${ext}`;
                            const img = new Image();
                            img.onload = () => resolve(url);
                            img.onerror = () => resolve(null);
                            img.src = url;
                        })
                    );
                }
            }

            const results = await Promise.all(promises);
            setImages(results.filter((url): url is string => url !== null));
        };

        checkImages();
    }, []);

    // Calcul des keyframes uniquement si des images sont trouvées
    const count = images.length;
    const totalDuration = count * 10;
    let keyframes = '';

    if (count > 0) {
        for (let i = 0; i < count; i++) {
            const slot = 100 / count;
            const start = i * slot;
            const end = (i + 1) * slot;
            const fade = Math.min(2, slot / 5);

            keyframes += `
                @keyframes homeSlide-${i} {
                0% { opacity: 0; }
                ${start.toFixed(4)}% { opacity: 0; }
                ${(start + fade).toFixed(4)}% { opacity: 1; }
                ${(end - fade).toFixed(4)}% { opacity: 1; }
                ${end.toFixed(4)}% { opacity: 0; }
                100% { opacity: 0; }
                }
            `;
        }
    }

    return (
        <section className="py-4 py-md-5">
            <div className="container">
                <div className="row align-items-center g-4">
                    <div className="col-12 col-md-6 d-flex flex-column justify-content-center h-100">
                        <h1 className="display-6 fw-semibold mb-3">{t('home.title')}</h1>
                        <p className="lead mb-4">
                            {t('home.lead')}
                        </p>
                        <div className="d-flex gap-2">
                            <a href="/user" className="btn btn-outline-primary">
                                {t('home.learnMore')}
                            </a>
                        </div>
                    </div>
                    <div className="col-12 col-md-6 d-flex justify-content-center align-items-center h-100">
                        {count > 0 && (
                            <>
                                <style>{keyframes}</style>
                                <div
                                    className="home-illustration rounded-3 overflow-hidden position-relative"
                                    style={{ width: '100%', aspectRatio: '16 / 9' }}
                                >
                                    {images.map((src, i) => (
                                        <img
                                            key={src}
                                            src={src}
                                            alt={t('home.altParents')}
                                            className="w-100 h-100 position-absolute top-0 start-0"
                                            style={{
                                                objectFit: 'cover',
                                                opacity: 0,
                                                animationName: `homeSlide-${i}`,
                                                animationDuration: `${totalDuration}s`,
                                                animationTimingFunction: 'linear',
                                                animationIterationCount: 'infinite',
                                                willChange: 'opacity',
                                            }}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Home