import { useEffect, useState } from 'react'
import { createUser, updateUserById, type User, createUserWithImage, updateUserByIdWithImage, getUsers } from '../../../services/users'
import { getRoles, type Role } from '../../../services/roles'
import { assignRoleToUser, getRolesForUser, removeRoleFromUser } from '../../../services/roleAttributions'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import Select from 'react-select'

export default function UserForm({
    mode,
    initial,
    onSaved,
    onCancel,
    allowedRoleNames,
}: {
    mode: 'create' | 'edit'
    initial?: Partial<User>
    onSaved: (user: User) => void
    onCancel: () => void
    allowedRoleNames?: string[]
}) {
    const [form, setForm] = useState<Partial<User>>({
        username: initial?.username ?? '',
        firstname: initial?.firstname ?? '',
        lastname: initial?.lastname ?? '',
        email: initial?.email ?? '',
        telephone: initial?.telephone ?? '',
        birthday: initial?.birthday ?? '',
        image_url: initial?.image_url ?? '',
    })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [allRoles, setAllRoles] = useState<Role[]>([])
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [fatherId, setFatherId] = useState<number | null>(initial?.id_father ?? null)
    const [motherId, setMotherId] = useState<number | null>(initial?.id_mother ?? null)
    // react-select provides built-in search for parents
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string | null>(null)
    const [phone, setPhone] = useState<string | undefined>(initial?.telephone ? String(initial.telephone) : undefined)
    // Activation & first-login flags (booleans for UI, mapped to 1/0 for API)
    const [isActive, setIsActive] = useState<boolean>(mode === 'create' ? true : (
        typeof (initial as any)?.isactive !== 'undefined'
            ? (Number((initial as any).isactive) === 1 || (initial as any).isactive === true)
            : true
    ))
    const [isFirstLogin, setIsFirstLogin] = useState<boolean>(mode === 'create' ? true : false)

    useEffect(() => {
        async function loadRoles() {
            try {
                const roles = await getRoles()
                setAllRoles(roles)
                if (mode === 'edit' && initial?.id) {
                    const current = await getRolesForUser(initial.id)
                    // If restricted, pre-select only allowed ones
                    const currentIds = current.map(r => r.id)
                    if (allowedRoleNames && allowedRoleNames.length > 0) {
                        const allowedIds = new Set(
                            roles
                                .filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                                .map(r => r.id)
                        )
                        setSelectedRoleIds(currentIds.filter(id => allowedIds.has(id)))
                    } else {
                        setSelectedRoleIds(currentIds)
                    }
                }
            } catch {
                // ignore errors for roles loading
            }
        }
        async function loadUsers() {
            try {
                const users = await getUsers()
                setAllUsers(users)
            } catch {
                // ignore
            }
        }
        loadRoles()
        loadUsers()
    }, [mode, initial?.id])

    // Keep phone state in sync when `initial.telephone` changes
    useEffect(() => {
        setPhone(initial?.telephone ? String(initial.telephone) : undefined)
    }, [initial?.telephone])

    // Update activation and first-login defaults when mode/initial change
    useEffect(() => {
        if (mode === 'create') {
            setIsActive(true)
            setIsFirstLogin(true)
        } else {
            const rawActive = (initial as any)?.isactive
            const activeVal = typeof rawActive !== 'undefined'
                ? (Number(rawActive) === 1 || rawActive === true)
                : true
            setIsActive(activeVal)
            // For update page, default first login to false
            setIsFirstLogin(false)
        }
    }, [mode, initial])

    function isValidEmail(val?: string | null): boolean {
        if (!val) return true
        // basic email pattern
        return /\S+@\S+\.\S+/.test(val)
    }

    async function submitForm() {
        setError(null)
        setEmailError(null)
        setPhoneError(null)
        // Validate parents differ
        if (fatherId !== null && motherId !== null && fatherId === motherId) {
            setError('Le père et la mère doivent être différents')
            return
        }
        if (!isValidEmail(form.email || null)) {
            setEmailError("Email invalide")
            return
        }
        if (phone && !isValidPhoneNumber(phone)) {
            setPhoneError("Numéro de téléphone invalide")
            return
        }
        setSaving(true)
        try {
            if (mode === 'create') {
                let created: User
                if (imageFile) {
                    created = await createUserWithImage({
                        firstname: form.firstname || '',
                        lastname: form.lastname || '',
                        email: form.email || undefined,
                        telephone: phone || undefined,
                        birthday: form.birthday || undefined,
                        id_father: fatherId ?? null,
                        id_mother: motherId ?? null,
                        isactive: isActive ? 1 : 0,
                        isfirstlogin: isFirstLogin ? 1 : 0,
                    }, imageFile)
                } else {
                    created = await createUser({
                        firstname: form.firstname || '',
                        lastname: form.lastname || '',
                        email: form.email || undefined,
                        telephone: phone || undefined,
                        birthday: form.birthday || undefined,
                        id_father: fatherId ?? null,
                        id_mother: motherId ?? null,
                        isactive: isActive ? 1 : 0,
                        isfirstlogin: isFirstLogin ? 1 : 0,
                    })
                }
                // Assign selected roles (filter out any stale/invalid role ids)
                let validRoleIds = selectedRoleIds.filter(rid => allRoles.some(r => r.id === rid))
                if (allowedRoleNames && allowedRoleNames.length > 0) {
                    const allowedIds = new Set(
                        allRoles
                            .filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                            .map(r => r.id)
                    )
                    validRoleIds = validRoleIds.filter(id => allowedIds.has(id))
                }
                await Promise.all(validRoleIds.map(rid => assignRoleToUser(created.id, rid)))
                onSaved(created)
            } else {
                const id = (initial as User).id
                let updated: User
                if (imageFile) {
                    updated = await updateUserByIdWithImage(id, {
                        username: form.username ? String(form.username) : undefined,
                        firstname: form.firstname,
                        lastname: form.lastname,
                        email: form.email || undefined,
                        telephone: phone || undefined,
                        birthday: form.birthday || undefined,
                        id_father: fatherId ?? undefined,
                        id_mother: motherId ?? undefined,
                        isactive: isActive ? 1 : 0,
                        isfirstlogin: isFirstLogin ? 1 : 0,
                    }, imageFile)
                } else {
                    updated = await updateUserById(id, {
                        username: form.username ? String(form.username) : undefined,
                        firstname: form.firstname,
                        lastname: form.lastname,
                        email: form.email || undefined,
                        telephone: phone || undefined,
                        birthday: form.birthday || undefined,
                        image_url: form.image_url || undefined,
                        id_father: fatherId ?? undefined,
                        id_mother: motherId ?? undefined,
                        isactive: isActive ? 1 : 0,
                        isfirstlogin: isFirstLogin ? 1 : 0,
                    })
                }
                // Update role assignments (diff) – operate only on allowed roles if restricted
                const current = await getRolesForUser(id)
                let currentIds = new Set(current.map(r => r.id))
                let desiredIds = new Set(selectedRoleIds)
                if (allowedRoleNames && allowedRoleNames.length > 0) {
                    const allowedIds = new Set(
                        allRoles
                            .filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                            .map(r => r.id)
                    )
                    currentIds = new Set([...currentIds].filter(id2 => allowedIds.has(id2)))
                    desiredIds = new Set([...desiredIds].filter(id2 => allowedIds.has(id2)))
                }
                // Remove roles not desired
                await Promise.all([...currentIds].filter(rid => !desiredIds.has(rid)).map(rid => removeRoleFromUser(id, rid)))
                // Add roles newly desired
                await Promise.all([...desiredIds].filter(rid => !currentIds.has(rid)).map(rid => assignRoleToUser(id, rid)))
                onSaved(updated)
            }
        } catch (e) {
            setError('Erreur lors de la sauvegarde')
        } finally {
            setSaving(false)
        }
    }

    // Options for react-select
    const userOptions = allUsers.map(u => ({
        value: u.id,
        label: `${u.firstname || ''} ${u.lastname || ''} (${u.username || ''})`.trim(),
    }))

    return (
        <div className="card mb-3">
            <div className="card-body">
                <h5 className="card-title mb-3">{mode === 'create' ? 'Créer un utilisateur' : 'Modifier un utilisateur'}</h5>
                {error && <div className="alert alert-danger" role="alert">{error}</div>}
                <div className="row g-3">
                    <div className="col-sm-6">
                        <label className="form-label">Nom d'utilisateur</label>
                        <input className="form-control" value={form.username || ''} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                    <div className="col-sm-6">
                        <label className="form-label">Prénom</label>
                        <input className="form-control" value={form.firstname || ''} onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))} />
                    </div>
                    <div className="col-sm-6">
                        <label className="form-label">Nom</label>
                        <input className="form-control" value={form.lastname || ''} onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))} />
                    </div>
                    <div className="col-sm-4">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-control" value={form.email || ''} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setEmailError(null) }} />
                        {emailError && <div className="text-danger small mt-1">{emailError}</div>}
                    </div>
                    <div className="col-sm-4">
                        <label className="form-label">Téléphone</label>
                        <PhoneInput
                            international
                            defaultCountry="GN"
                            value={phone}
                            onChange={(val) => { setPhone(val); setPhoneError(null) }}
                            className="w-100"
                            inputClassName="form-control bg-white"
                        />
                        {phoneError && <div className="text-danger small mt-1">{phoneError}</div>}
                    </div>
                    <div className="col-sm-4">
                        <label className="form-label">Date de naissance</label>
                        <input type="date" className="form-control" value={form.birthday || ''} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
                    </div>
                    <div className="col-sm-8">
                        <label className="form-label">Image (optionnel)</label>
                        <input type="file" accept="image/*" className="form-control" onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <div className="col-sm-6">
                        <div className="form-check form-switch mt-4">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="is-active"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="is-active">Utilisateur actif</label>
                        </div>
                    </div>
                    <div className="col-sm-6">
                        <div className="form-check form-switch mt-4">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="is-first-login"
                                checked={isFirstLogin}
                                onChange={e => setIsFirstLogin(e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="is-first-login">Première connexion</label>
                        </div>
                    </div>
                    <div className="col-sm-6">
                        <label className="form-label">Père</label>
                        <Select
                            isClearable
                            classNamePrefix="select"
                            options={userOptions}
                            placeholder="Rechercher un père..."
                            value={userOptions.find(o => o.value === fatherId) ?? null}
                            onChange={(opt) => setFatherId(opt ? (opt as { value: number; label: string }).value : null)}
                        />
                    </div>
                    <div className="col-sm-6">
                        <label className="form-label">Mère</label>
                        <Select
                            isClearable
                            classNamePrefix="select"
                            options={userOptions}
                            placeholder="Rechercher une mère..."
                            value={userOptions.find(o => o.value === motherId) ?? null}
                            onChange={(opt) => setMotherId(opt ? (opt as { value: number; label: string }).value : null)}
                        />
                    </div>
                    <div className="col-12">
                        <label className="form-label">Rôles</label>
                        <div className="d-flex flex-wrap gap-3">
                            {(allowedRoleNames && allowedRoleNames.length > 0
                                ? allRoles.filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                                : allRoles
                            ).map(role => (
                                <div key={role.id} className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`role-${role.id}`}
                                        checked={selectedRoleIds.includes(role.id)}
                                        onChange={e => {
                                            const checked = e.target.checked
                                            setSelectedRoleIds(prev => checked ? [...prev, role.id] : prev.filter(id => id !== role.id))
                                        }}
                                    />
                                    <label className="form-check-label" htmlFor={`role-${role.id}`}>{role.role}</label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-success" onClick={submitForm} disabled={saving}>
                        <i className="bi bi-check2 me-1" aria-hidden="true"></i>
                        Enregistrer
                    </button>
                    <button className="btn btn-outline-secondary" onClick={onCancel} disabled={saving}>
                        Annuler
                    </button>
                </div>
            </div>
            {/* Modal supprimé: création de parents désactivée */}
        </div>
    )
}
