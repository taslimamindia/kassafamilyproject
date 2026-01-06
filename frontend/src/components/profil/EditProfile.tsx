import { useEffect, useState } from 'react'
import { getCurrentUser, updateCurrentUser, type User } from '../../services/users'

export default function EditProfile() {
    const [form, setForm] = useState<Partial<User>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            setError(null)
            try {
                const me = await getCurrentUser()
                setForm({
                    firstname: me.firstname,
                    lastname: me.lastname,
                    email: me.email,
                    telephone: me.telephone,
                    birthday: me.birthday,
                })
            } catch (e) {
                setError("Impossible de charger le profil")
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    function updateField<K extends keyof User>(key: K, value: User[K]) {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            await updateCurrentUser({
                firstname: form.firstname,
                lastname: form.lastname,
                email: form.email,
                telephone: form.telephone,
                birthday: form.birthday,
            })
            setSuccess('Profil mis à jour avec succès')
        } catch (e) {
            setError("Échec de la mise à jour")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="text-muted">Chargement du formulaire...</div>
    }

    return (
        <form onSubmit={onSubmit} className="card">
            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                <div className="row g-3">
                    <div className="col-md-6">
                        <label className="form-label">Prénom</label>
                        <input className="form-control" value={form.firstname ?? ''} onChange={(e) => updateField('firstname', e.target.value as any)} required />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Nom</label>
                        <input className="form-control" value={form.lastname ?? ''} onChange={(e) => updateField('lastname', e.target.value as any)} required />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value as any)} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Téléphone</label>
                        <input className="form-control" value={form.telephone ?? ''} onChange={(e) => updateField('telephone', e.target.value as any)} />
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Date de naissance</label>
                        <input type="date" className="form-control" value={form.birthday ?? ''} onChange={(e) => updateField('birthday', e.target.value as any)} />
                    </div>
                </div>
            </div>
            <div className="card-footer text-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
        </form>
    )
}
