import { useEffect, useState, useRef } from 'react'
import { getCurrentUser, updateUserById, updateUserByIdWithImage, type User } from '../../services/users'
import { getRolesForUser } from '../../services/roleAttributions'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n'
// Localized dictionary for this component
const editProfileResources = {
    fr: {
        profileEdit: {
            loadError: 'Impossible de charger le profil',
            updatedSuccess: 'Profil mis à jour avec succès',
            updateFailed: 'Échec de la mise à jour',
            loadingForm: 'Chargement du formulaire...',
            username: "Nom d'utilisateur",
            usernameHelp: "Vous ne pouvez pas modifier le nom d'utilisateur.",
            firstname: 'Prénom',
            lastname: 'Nom',
            email: 'Email',
            telephone: 'Téléphone',
            birthday: 'Date de naissance',
            profilePhoto: 'Photo de profil',
            preview: 'Aperçu',
            saving: 'Enregistrement...',
        },
        common: { save: 'Enregistrer' },
    },
    en: {
        profileEdit: {
            loadError: 'Unable to load profile',
            updatedSuccess: 'Profile updated successfully',
            updateFailed: 'Update failed',
            loadingForm: 'Loading form...',
            username: 'Username',
            usernameHelp: "You can't change the username.",
            firstname: 'First name',
            lastname: 'Last name',
            email: 'Email',
            telephone: 'Phone',
            birthday: 'Birth date',
            profilePhoto: 'Profile photo',
            preview: 'Preview',
            saving: 'Saving...',
        },
        common: { save: 'Save' },
    },
    ar: {
        profileEdit: {
            loadError: 'تعذّر تحميل الملف',
            updatedSuccess: 'تم تحديث الملف بنجاح',
            updateFailed: 'فشلت عملية التحديث',
            loadingForm: 'جارٍ تحميل النموذج...',
            username: 'اسم المستخدم',
            usernameHelp: 'لا يمكنك تغيير اسم المستخدم.',
            firstname: 'الاسم الأول',
            lastname: 'الاسم الأخير',
            email: 'البريد الإلكتروني',
            telephone: 'رقم الهاتف',
            birthday: 'تاريخ الميلاد',
            profilePhoto: 'صورة الملف',
            preview: 'معاينة',
            saving: 'جارٍ الحفظ...',
        },
        common: { save: 'حفظ' },
    },
}

for (const [lng, res] of Object.entries(editProfileResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function EditProfile() {
    const { t } = useTranslation()
    const [form, setForm] = useState<Partial<User>>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [myId, setMyId] = useState<number | null>(null)
    const [isAdmin, setIsAdmin] = useState<boolean>(false)

    // Local preview URL for selected file
    const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)

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
                setError(t('profileEdit.loadError'))
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile)
            setLocalPreviewUrl(url)
            return () => URL.revokeObjectURL(url)
        } else {
            setLocalPreviewUrl(null)
        }
    }, [imageFile])

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
                        // if image_url is explicitly null, request deletion
                        image_url: form.image_url ?? undefined,
                        remove_image: form.image_url === null ? true : undefined,
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
            setSuccess(t('profileEdit.updatedSuccess'))
        } catch (e) {
            setError(t('profileEdit.updateFailed'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <div className="text-muted">{t('profileEdit.loadingForm')}</div>
    }

    const previewSrc = localPreviewUrl ?? form.image_url ?? ''
    const avatarStyle: React.CSSProperties = { width: 140, height: 140, objectFit: 'cover', borderRadius: '50%', border: '1px solid #e6e6e6' }

    function triggerFileChoose() {
        fileInputRef.current?.click()
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        setImageFile(e.target.files?.[0] ?? null)
    }

    function removeImage() {
        setImageFile(null)
        // remove existing image url from preview and mark for deletion
        setForm(prev => ({ ...prev, image_url: null }))
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    return (
        <form onSubmit={onSubmit} className="card">
            <div className="card-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <div className="row">
                    <div className="col-md-4 d-flex flex-column align-items-center text-center mb-3">
                        <div className="mb-3">
                            {previewSrc ? (
                                <img src={previewSrc} alt={t('profileEdit.preview')} style={avatarStyle} />
                            ) : (
                                <div style={{ ...avatarStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#777' }}>{(form.firstname || form.username || 'U').charAt(0).toUpperCase()}</div>
                            )}
                        </div>
                        <div className="d-grid gap-2 w-100">
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={triggerFileChoose}>{t('profileEdit.profilePhoto')}</button>
                            <button type="button" className="btn btn-outline-danger btn-sm" onClick={removeImage} disabled={!previewSrc && !imageFile}>Remove</button>
                        </div>
                    </div>

                    <div className="col-md-8">
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.username')}</label>
                                <input
                                    className="form-control"
                                    value={form.username ?? ''}
                                    onChange={(e) => updateField('username', e.target.value as any)}
                                    disabled={!isAdmin}
                                    required={isAdmin}
                                />
                                {!isAdmin && (
                                    <div className="form-text">{t('profileEdit.usernameHelp')}</div>
                                )}
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.firstname')}</label>
                                <input className="form-control" value={form.firstname ?? ''} onChange={(e) => updateField('firstname', e.target.value as any)} required />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.lastname')}</label>
                                <input className="form-control" value={form.lastname ?? ''} onChange={(e) => updateField('lastname', e.target.value as any)} required />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.email')}</label>
                                <input type="email" className="form-control" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value as any)} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.telephone')}</label>
                                <input className="form-control" value={form.telephone ?? ''} onChange={(e) => updateField('telephone', e.target.value as any)} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">{t('profileEdit.birthday')}</label>
                                <input type="date" className="form-control" value={form.birthday ?? ''} onChange={(e) => updateField('birthday', e.target.value as any)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="card-footer text-end">
                <button type="submit" className="btn btn-primary me-2" disabled={saving}>{saving ? t('profileEdit.saving') : t('common.save')}</button>
                <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>Cancel</button>
            </div>
        </form>
    )
}
