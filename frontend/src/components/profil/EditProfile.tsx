import { useEffect, useState } from 'react'
import { getCurrentUser, updateUserById, updateUserByIdWithImage, type User } from '../../services/users'
import { getRolesForUser } from '../../services/roleAttributions'

export default function EditProfile() {
    const [form, setForm] = useState<Partial<User>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [myId, setMyId] = useState<number | null>(null)
    const [isAdmin, setIsAdmin] = useState<boolean>(false)

    useEffect(() => {
        async function load() {
            setLoading(true)
            setError(null)
            try {
                const me = await getCurrentUser()
                setForm({
                    username: me.username,
                    firstname: me.firstname,
                    lastname: me.lastname,
                    email: me.email,
                    telephone: me.telephone,
                    birthday: me.birthday,
                    image_url: me.image_url,
                })
                setMyId(me.id)
                try {
                    const roles = await getRolesForUser(me.id)
                    setIsAdmin(roles.some(r => (r.role || '').toLowerCase() === 'admin'))
                } catch {
                    setIsAdmin(false)
                }
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
            if (myId !== null) {
                const payload = {
                    username: isAdmin ? form.username : undefined,
                    firstname: form.firstname,
                    lastname: form.lastname,
                    email: form.email,
                    telephone: form.telephone,
                    birthday: form.birthday,
                }

                let updatedUser: User;
                if (imageFile) {
                    updatedUser = await updateUserByIdWithImage(myId, payload, imageFile)
                } else {
                    updatedUser = await updateUserById(myId, {
                        ...payload,
                        image_url: form.image_url
                    })
                }
                
                // Mettre à jour le formulaire avec les nouvelles données du serveur (incluant la nouvelle image)
                setForm({
                    username: updatedUser.username,
                    firstname: updatedUser.firstname,
                    lastname: updatedUser.lastname,
                    email: updatedUser.email,
                    telephone: updatedUser.telephone,
                    birthday: updatedUser.birthday,
                    image_url: updatedUser.image_url,
                })
                setImageFile(null) // Reset du fichier sélectionné
            }
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
                        <label className="form-label">Nom d'utilisateur</label>
                        <input
                            className="form-control"
                            value={form.username ?? ''}
                            onChange={(e) => updateField('username', e.target.value as any)}
                            disabled={!isAdmin}
                            required={isAdmin}
                        />
                        {!isAdmin && (
                            <div className="form-text">Vous ne pouvez pas modifier le nom d'utilisateur.</div>
                        )}
                    </div>
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
                    <div className="col-md-6">
                        <label className="form-label">Photo de profil</label>
                        <input type="file" accept="image/*" className="form-control" onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
                        {form.image_url && (
                            <div className="mt-2">
                                <img src={form.image_url} alt="Aperçu" style={{ maxWidth: '120px', borderRadius: '8px' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="card-footer text-end">
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
        </form>
    )
}
