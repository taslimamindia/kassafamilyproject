import { useEffect, useState, useRef } from 'react'
import { createUser, type User, createUserWithImage, getUsers } from '../../../services/users'
import { tierOptions } from '../../../constants/contributionTiers'
import { getRoles, type Role } from '../../../services/roles'
import { getRoleLabel } from '../../../constants/roleLabels'
import { assignRoleToUser } from '../../../services/roleAttributions'
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import Select from 'react-select'
import Modal from '../../common/Modal'
import { useTranslation } from 'react-i18next'
import i18n from '../../../i18n'

const userFormResources = {
    fr: {
        userForm: {
            help: {
                firstname: { title: "Prénom", desc: "Entrez le prénom de l'utilisateur tel qu'il doit apparaître." },
                lastname: { title: "Nom", desc: "Entrez le nom de famille de l'utilisateur." },
                username: { title: "Nom d'utilisateur", desc: "Optionnel. Si laissé vide, un nom d'utilisateur sera suggéré à partir des initiales et de l'année de naissance. Vous pouvez saisir votre propre nom d'utilisateur unique." },
                email: { title: "Email", desc: "Adresse email valide (ex: nom@domaine.com). Optionnel." },
                telephone: { title: "Téléphone", desc: "Numéro de téléphone au format international (ex: +224...). Optionnel." },
                birthday: { title: "Date de naissance", desc: "Sélectionnez la date de naissance (AAAA-MM-JJ). Optionnel." },
                image: { title: "Image (optionnel)", desc: "Ajoutez une photo de profil (JPEG/PNG). Optionnel." },
                gender: { title: "Genre", desc: "Sélectionnez le genre de l'utilisateur: Homme ou Femme." },
                contribution_tier: { title: "Niveau de contribution", desc: "Choisissez le niveau de contribution (LEVEL1 à LEVEL4). Optionnel." },
                isactive: { title: "Utilisateur actif", desc: "Activez pour autoriser la connexion de l'utilisateur. Désactivez pour bloquer l'accès." },
                isfirstlogin: { title: "Première connexion", desc: "Activez si l'utilisateur doit changer son mot de passe lors de sa première connexion." },
                father: { title: "Père", desc: "Sélectionnez le parent (père) s'il est déjà enregistré. Optionnel." },
                mother: { title: "Mère", desc: "Sélectionnez le parent (mère) s'il est déjà enregistré. Optionnel." },
                roles: { title: "Rôles", desc: "Cochez les rôles à attribuer à l'utilisateur (ex: admin, user)." },
            },
            title: { create: "Créer un utilisateur", edit: "Modifier le profil" },
            subtitle: { create: "Remplissez les informations ci-dessous pour ajouter un nouveau membre.", edit: "Remplissez les informations ci-dessous pour mettre à jour le compte." },
            labels: {
                profilePhoto: "Photo de profil", changePhoto: "Changer la photo", activeAccount: "Compte Actif", firstLogin: "Première Connexion",
                firstname: "Prénom", lastname: "Nom", birthday: "Date de naissance", email: "Email", phone: "Téléphone",
                username: "Nom d'utilisateur", father: "Père", mother: "Mère", gender: "Genre", contributionTier: "Niveau de contribution"
            },
            descriptions: {
                activeAccount: "Autoriser ce compte à se connecter.", firstLogin: "Forcer le changement de MDP.",
                autoUsername: "Laisser vide pour générer automatiquement via les initiales et année."
            },
            placeholders: {
                firstname: "Ex: Mamadou Taslima", lastname: "Ex: Diallo", email: "nom@exemple.com", username: "Ex: taslimamindia",
                selectFather: "Sélectionner le père...", selectMother: "Sélectionner la mère..."
            },
            sections: {
                personalInfo: "Informations Personnelles", contact: "Coordonnées", login: "Connexion", family: "Filiation (Parents)", roles: "Rôles assignés"
            },
            buttons: { suggest: "Suggérer", cancel: "Annuler", saving: "Enregistrement...", save: "Enregistrer" },
            errors: {
                parentsMustBeDifferent: "Le père et la mère doivent être différents", invalidEmail: "Email invalide",
                invalidPhone: "Numéro de téléphone invalide", saveError: "Erreur lors de la sauvegarde",
                invalidCharacters: "Caractères invalides (Latin uniquement)"
            }
        }
    },
    en: {
        userForm: {
            help: {
                firstname: { title: "First Name", desc: "Enter the user's first name as it should appear." },
                lastname: { title: "Last Name", desc: "Enter the user's last name." },
                username: { title: "Username", desc: "Optional. If left empty, a username will be suggested based on initials and birth year. You can enter your own unique username." },
                email: { title: "Email", desc: "Valid email address (e.g., name@domain.com). Optional." },
                telephone: { title: "Phone", desc: "Phone number in international format (e.g., +224...). Optional." },
                birthday: { title: "Date of Birth", desc: "Select date of birth (YYYY-MM-DD). Optional." },
                image: { title: "Image (optional)", desc: "Add a profile photo (JPEG/PNG). Optional." },
                gender: { title: "Gender", desc: "Select the user's gender: Male or Female." },
                contribution_tier: { title: "Contribution Tier", desc: "Choose the contribution tier (LEVEL1 to LEVEL4). Optional." },
                isactive: { title: "Active User", desc: "Enable to allow user login. Disable to block access." },
                isfirstlogin: { title: "First Login", desc: "Enable if the user must change their password on first login." },
                father: { title: "Father", desc: "Select the parent (father) if already registered. Optional." },
                mother: { title: "Mother", desc: "Select the parent (mother) if already registered. Optional." },
                roles: { title: "Roles", desc: "Check roles to assign to the user (e.g., admin, user)." },
            },
            title: { create: "Create User", edit: "Edit Profile" },
            subtitle: { create: "Fill in the information below to add a new member.", edit: "Fill in the information below to update the account." },
            labels: {
                profilePhoto: "Profile Photo", changePhoto: "Change Photo", activeAccount: "Active Account", firstLogin: "First Login",
                firstname: "First Name", lastname: "Last Name", birthday: "Date of Birth", email: "Email", phone: "Phone",
                username: "Username", father: "Father", mother: "Mother", gender: "Gender", contributionTier: "Contribution Tier"
            },
            descriptions: {
                activeAccount: "Allow this account to log in.", firstLogin: "Force password change.",
                autoUsername: "Leave empty to auto-generate via initials and year."
            },
            placeholders: {
                firstname: "Ex: Mamadou Taslima", lastname: "Ex: Diallo", email: "name@example.com", username: "Ex: taslimamindia",
                selectFather: "Select father...", selectMother: "Select mother..."
            },
            sections: {
                personalInfo: "Personal Information", contact: "Contact Details", login: "Login", family: "Family (Parents)", roles: "Assigned Roles"
            },
            buttons: { suggest: "Suggest", cancel: "Cancel", saving: "Saving...", save: "Save" },
            errors: {
                parentsMustBeDifferent: "Father and mother must be different", invalidEmail: "Invalid email",
                invalidPhone: "Invalid phone number", saveError: "Error saving",
                invalidCharacters: "Invalid characters (Latin only)"
            }
        }
    },
    ar: {
        userForm: {
            help: {
                firstname: { title: "الاسم الأول", desc: "أدخل الاسم الأول للمستخدم كما يجب أن يظهر." },
                lastname: { title: "الاسم الأخير", desc: "أدخل اسم العائلة للمستخدم." },
                username: { title: "اسم المستخدم", desc: "اختياري. إذا ترك فارغاً، سيتم اقتراح اسم مستخدم بناءً على الأحرف الأولى وسنة الميلاد. يمكنك إدخال اسم مستخدم فريد خاص بك." },
                email: { title: "البريد الإلكتروني", desc: "عنوان بريد إلكتروني صالح (مثل: name@domain.com). اختياري." },
                telephone: { title: "الهاتف", desc: "رقم الهاتف بالتنسيق الدولي (مثل: +224...). اختياري." },
                birthday: { title: "تاريخ الميلاد", desc: "اختر تاريخ الميلاد (YYYY-MM-DD). اختياري." },
                image: { title: "صورة (اختياري)", desc: "أضف صورة للملف الشخصي (JPEG/PNG). اختياري." },
                gender: { title: "النوع", desc: "حدد نوع المستخدم: ذكر أو أنثى." },
                contribution_tier: { title: "مستوى المساهمة", desc: "اختر مستوى المساهمة (LEVEL1 إلى LEVEL4). اختياري." },
                isactive: { title: "مستخدم نشط", desc: "قم بالتفعيل للسماح بتسجيل دخول المستخدم. قم بالتعطيل لمنع الوصول." },
                isfirstlogin: { title: "أول تسجيل دخول", desc: "قم بالتفعيل إذا كان يجب على المستخدم تغيير كلمة المرور عند أول تسجيل دخول." },
                father: { title: "الأب", desc: "اختر الوالد (الأب) إذا كان مسجلاً بالفعل. اختياري." },
                mother: { title: "الأم", desc: "اختر والدة (الأم) إذا كانت مسجلة بالفعل. اختياري." },
                roles: { title: "الأدوار", desc: "حدد الأدوار لتعيينها للمستخدم (مثل: admin, user)." },
            },
            title: { create: "إنشاء مستخدم", edit: "تعديل الملف الشخصي" },
            subtitle: { create: "املأ المعلومات أدناه لإضافة عضو جديد.", edit: "املأ المعلومات أدناه لتحديث الحساب." },
            labels: {
                profilePhoto: "صورة الملف الشخصي", changePhoto: "تغيير الصورة", activeAccount: "حساب نشط", firstLogin: "أول تسجيل دخول",
                firstname: "الاسم الأول", lastname: "الاسم الأخير", birthday: "تاريخ الميلاد", email: "البريد الإلكتروني", phone: "الهاتف",
                username: "اسم المستخدم", father: "الأب", mother: "الأم", gender: "النوع", contributionTier: "مستوى المساهمة"
            },
            descriptions: {
                activeAccount: "السماح لهذا الحساب بتسجيل الدخول.", firstLogin: "فرض تغيير كلمة المرور.",
                autoUsername: "اتركه فارغاً للتوليد التلقائي عبر الأحرف الأولى والسنة."
            },
            placeholders: {
                firstname: "Ex: Mamadou Taslima", lastname: "Ex: Diallo", email: "name@example.com", username: "Ex: taslimamindia",
                selectFather: "اختر الأب...", selectMother: "اختر الأم..."
            },
            sections: {
                personalInfo: "المعلومات الشخصية", contact: "بيانات الاتصال", login: "تسجيل الدخول", family: "العائلة (الوالدين)", roles: "الأدوار المعينة"
            },
            buttons: { suggest: "اقتراح", cancel: "إلغاء", saving: "جاري الحفظ...", save: "حفظ" },
            errors: {
                parentsMustBeDifferent: "يجب أن يكون الأب والأم مختلفين", invalidEmail: "بريد إلكتروني غير صالح",
                invalidPhone: "رقم هاتف غير صالح", saveError: "خطأ في الحفظ",
                invalidCharacters: "أحرف غير صالحة (لاتينية فقط)"
            }
        }
    }
}

for (const [lng, res] of Object.entries(userFormResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export default function AddUserForm({
    initial,
    onSaved,
    onCancel,
    allowedRoleNames,
}: {
    initial?: Partial<User>
    onSaved: (user: User) => void
    onCancel: () => void
    allowedRoleNames?: string[]
}) {
    const { t } = useTranslation()
    const [form, setForm] = useState<Partial<User>>({
        username: initial?.username ?? '',
        firstname: initial?.firstname ?? '',
        lastname: initial?.lastname ?? '',
        email: initial?.email ?? '',
        telephone: initial?.telephone ?? '',
        birthday: initial?.birthday ?? '',
        image_url: initial?.image_url ?? '',
        gender: (initial as any)?.gender ?? undefined,
        contribution_tier: (initial as any)?.contribution_tier ?? null,
    })
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [allRoles, setAllRoles] = useState<Role[]>([])
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([])
    
    // Split users into potential fathers/mothers for efficiency
    const [potentialFathers, setPotentialFathers] = useState<User[]>([])
    const [potentialMothers, setPotentialMothers] = useState<User[]>([])

    const [fatherId, setFatherId] = useState<number | null>(initial?.id_father ?? null)
    const [motherId, setMotherId] = useState<number | null>(initial?.id_mother ?? null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string | null>(null)
    const [phone, setPhone] = useState<string | undefined>(initial?.telephone ? String(initial.telephone) : undefined)
    const [isActive, setIsActive] = useState<boolean>(true)
    const [isFirstLogin, setIsFirstLogin] = useState<boolean>(true)
    const [isMinor, setIsMinor] = useState<boolean>(false)

    useEffect(() => {
        async function loadRoles() {
            try {
                const roles = await getRoles()
                setAllRoles(roles)
                // In create mode, do not pre-select roles
            } catch {
                // ignore errors for roles loading
            }
        }
        async function loadUsers() {
            try {
                // Fetch potential parents separately using backend filtering
                const [fathers, mothers] = await Promise.all([
                    getUsers({ status: 'all', gender: 'male' }),
                    getUsers({ status: 'all', gender: 'female' })
                ])
                setPotentialFathers(fathers)
                setPotentialMothers(mothers)
            } catch {
                // ignore
            }
        }
        loadRoles()
        loadUsers()
    }, [])

    useEffect(() => {
        setPhone(initial?.telephone ? String(initial.telephone) : undefined)
    }, [initial?.telephone])

    useEffect(() => {
        // create mode: no default parents
        setFatherId(null)
        setMotherId(null)
    }, [])

    useEffect(() => {
        setIsActive(true)
        setIsFirstLogin(true)
    }, [])

    function isValidEmail(val?: string | null): boolean {
        if (!val) return true
        return /\S+@\S+\.\S+/.test(val)
    }

    function computeSuggestedUsername(firstname?: string, lastname?: string, birthday?: string): string {
        const parts: string[] = []
        if (firstname) parts.push(...firstname.trim().split(/\s+/).filter(Boolean))
        if (lastname) parts.push(...lastname.trim().split(/\s+/).filter(Boolean))
        const initials = parts.map(p => p[0].toLowerCase()).join('')
        let year = ''
        if (birthday && birthday.length >= 4) {
            year = birthday.substring(0, 4)
        }
        return (initials + year).trim()
    }

    const suggestedUsername = computeSuggestedUsername(form.firstname, form.lastname, form.birthday)

    const [isTypingUsername, setIsTypingUsername] = useState(false)
    const typingTimer = useRef<number | null>(null)

    function animateFillUsername(target: string) {
        if (!target) return
        if (typingTimer.current) {
            window.clearInterval(typingTimer.current)
            typingTimer.current = null
        }
        setIsTypingUsername(true)
        let i = 0
        setForm(f => ({ ...f, username: '' }))
        typingTimer.current = window.setInterval(() => {
            i += 1
            const next = target.slice(0, i)
            setForm(f => ({ ...f, username: next }))
            if (i >= target.length) {
                if (typingTimer.current) {
                    window.clearInterval(typingTimer.current)
                    typingTimer.current = null
                }
                setIsTypingUsername(false)
            }
        }, 40)
    }

    useEffect(() => {
        return () => {
            if (typingTimer.current) {
                window.clearInterval(typingTimer.current)
                typingTimer.current = null
            }
        }
    }, [])

    useEffect(() => {
        // compute minor status from birthday
        const bd = form.birthday ? new Date(String(form.birthday)) : null
        if (bd && !isNaN(bd.getTime())) {
            const age = Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            if (age < 18) {
                setIsMinor(true)
                setIsActive(false)
                setIsFirstLogin(true)
            } else {
                setIsMinor(false)
            }
        } else {
            setIsMinor(false)
        }
    }, [form.birthday])

    type HelpKey = 'firstname' | 'lastname' | 'username' | 'email' | 'telephone' | 'birthday' | 'image' | 'gender' | 'contribution_tier' | 'isactive' | 'isfirstlogin' | 'father' | 'mother' | 'roles'
    const [helpKey, setHelpKey] = useState<HelpKey | null>(null)
    const helpText: Record<HelpKey, { title: string; desc: string }> = {
        firstname: { title: t('userForm.help.firstname.title'), desc: t('userForm.help.firstname.desc') },
        lastname: { title: t('userForm.help.lastname.title'), desc: t('userForm.help.lastname.desc') },
        username: { title: t('userForm.help.username.title'), desc: t('userForm.help.username.desc') },
        email: { title: t('userForm.help.email.title'), desc: t('userForm.help.email.desc') },
        telephone: { title: t('userForm.help.telephone.title'), desc: t('userForm.help.telephone.desc') },
        birthday: { title: t('userForm.help.birthday.title'), desc: t('userForm.help.birthday.desc') },
        image: { title: t('userForm.help.image.title'), desc: t('userForm.help.image.desc') },
        gender: { title: t('userForm.help.gender.title'), desc: t('userForm.help.gender.desc') },
        contribution_tier: { title: t('userForm.help.contribution_tier.title'), desc: t('userForm.help.contribution_tier.desc') },
        isactive: { title: t('userForm.help.isactive.title'), desc: t('userForm.help.isactive.desc') },
        isfirstlogin: { title: t('userForm.help.isfirstlogin.title'), desc: t('userForm.help.isfirstlogin.desc') },
        father: { title: t('userForm.help.father.title'), desc: t('userForm.help.father.desc') },
        mother: { title: t('userForm.help.mother.title'), desc: t('userForm.help.mother.desc') },
        roles: { title: t('userForm.help.roles.title'), desc: t('userForm.help.roles.desc') },
    }

    async function submitForm() {
        setError(null)
        setEmailError(null)
        setPhoneError(null)
        if (fatherId !== null && motherId !== null && fatherId === motherId) {
            setError(t('userForm.errors.parentsMustBeDifferent'))
            return
        }
        const latinRegex = /^[a-zA-Z0-9\s\-_@.,'éàèùâêîôûëïüÿçÉÀÈÙÂÊÎÔÛËÏÜŸÇ]*$/
        if (
            !latinRegex.test(form.firstname || '') || 
            !latinRegex.test(form.lastname || '') || 
            !latinRegex.test(form.username ? String(form.username) : '')
        ) {
            setError(t('userForm.errors.invalidCharacters'))
            return
        }
        if (!isValidEmail(form.email || null)) {
            setEmailError(t('userForm.errors.invalidEmail'))
            return
        }
        if (phone && !isValidPhoneNumber(phone)) {
            setPhoneError(t('userForm.errors.invalidPhone'))
            return
        }
        setSaving(true)
        try {
            let created: User
            if (imageFile) {
                const isActiveForPayload = isMinor ? false : isActive
                created = await createUserWithImage({
                    firstname: form.firstname || '',
                    lastname: form.lastname || '',
                    username: form.username ? String(form.username) : undefined,
                    email: form.email || undefined,
                    telephone: phone || undefined,
                    birthday: form.birthday || undefined,
                    gender: (form as any).gender || undefined,
                    contribution_tier: (form as any).contribution_tier ?? undefined,
                    id_father: fatherId ?? null,
                    id_mother: motherId ?? null,
                    isactive: isActiveForPayload ? 1 : 0,
                    isfirstlogin: isFirstLogin ? 1 : 0,
                }, imageFile)
            } else {
                const isActiveForPayload = isMinor ? false : isActive
                created = await createUser({
                    firstname: form.firstname || '',
                    lastname: form.lastname || '',
                    username: form.username ? String(form.username) : undefined,
                    email: form.email || undefined,
                    telephone: phone || undefined,
                    birthday: form.birthday || undefined,
                    gender: (form as any).gender || undefined,
                    contribution_tier: (form as any).contribution_tier ?? undefined,
                    id_father: fatherId ?? null,
                    id_mother: motherId ?? null,
                    isactive: isActiveForPayload ? 1 : 0,
                    isfirstlogin: isFirstLogin ? 1 : 0,
                })
            }
            let validRoleIds = selectedRoleIds.filter(rid => allRoles.some(r => r.id === rid))
            if (allowedRoleNames && allowedRoleNames.length > 0) {
                const allowedIds = new Set(
                    allRoles
                        .filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                        .map(r => r.id)
                )
                validRoleIds = validRoleIds.filter(id => allowedIds.has(id))
            }
            // Always ensure the backend 'user' role is assigned even if hidden from UI
            const userRole = allRoles.find(r => String(r.role).toLowerCase() === 'user')
            if (userRole && !validRoleIds.includes(userRole.id)) {
                validRoleIds.push(userRole.id)
            }
            await Promise.all(validRoleIds.map(rid => assignRoleToUser(created.id, rid)))
            onSaved(created)
        } catch (e) {
            setError(t('userForm.errors.saveError'))
        } finally {
            setSaving(false)
        }
    }

    const currentBirthDate = form.birthday ? new Date(String(form.birthday)) : null
    const hasValidDate = (d: Date | null) => !!d && !isNaN(d.getTime())
    
    const filterByBirthday = (list: User[]) => list.filter(u => {
        if (hasValidDate(currentBirthDate)) {
            const ub = u.birthday ? new Date(String(u.birthday)) : null
            if (!hasValidDate(ub)) return false
            return (ub as Date).getTime() < (currentBirthDate as Date).getTime()
        }
        return false // If current user has no birthday, cannot enforce age check? Or allow all? 
        // Logic change: If form has no birthday, maybe we can't filter. 
        // But original logic returned false if no valid date. This means if I'm creating a user without birthday, I see NO parents.
        // Preserving original logic: return false.
    })

    const filteredFathers = filterByBirthday(potentialFathers)
    const filteredMothers = filterByBirthday(potentialMothers)

    const toOption = (u: User) => ({
        value: u.id,
        label: `${u.firstname || ''} ${u.lastname || ''} (${u.username || ''})`.trim(),
    })

    let fatherOptions = filteredFathers.map(toOption)
    let motherOptions = filteredMothers.map(toOption)

    const previewUrl = imageFile ? URL.createObjectURL(imageFile) : (form.image_url ? (form.image_url.startsWith('http') ? form.image_url : form.image_url) : null)

    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-header bg-light bg-gradient border-bottom py-3 px-4">
                <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 text-primary rounded-circle p-2 me-3 d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                        <i className={`bi bi-person-plus-fill fs-4`}></i>
                    </div>
                    <div>
                        <h5 className="card-title fw-bold text-dark mb-0">{t('userForm.title.create')}</h5>
                        <p className="text-muted small mb-0">{t('userForm.subtitle.create')}</p>
                    </div>
                </div>
            </div>

            <div className="card-body p-4">
                {error && (
                    <div className="alert alert-danger d-flex align-items-center rounded-3 shadow-sm mb-4" role="alert">
                        <i className="bi bi-exclamation-triangle-fill fs-4 me-3"></i>
                        <div>{error}</div>
                    </div>
                )}

                <div className="row g-4">
                    <div className="col-lg-4">
                        <div className="text-center mb-4">
                            <div className="position-relative d-inline-block mb-3">
                                <div className="rounded-circle overflow-hidden border border-3 border-white shadow-sm bg-light d-flex align-items-center justify-content-center"
                                    style={{ width: '150px', height: '150px' }}>
                                    {previewUrl ? (
                                        <img src={previewUrl} alt="Preview" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                                    ) : (
                                        <i className="bi bi-person text-secondary" style={{ fontSize: '4rem' }}></i>
                                    )}
                                </div>
                                <label className="position-absolute bottom-0 end-0 btn btn-sm btn-primary rounded-circle shadow-sm d-flex align-items-center justify-content-center"
                                    style={{ width: '36px', height: '36px', cursor: 'pointer' }}
                                    title={t('userForm.labels.changePhoto')}>
                                    <i className="bi bi-camera-fill"></i>
                                    <input type="file" accept="image/*" className="d-none" onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
                                </label>
                            </div>
                            <h6 className="text-secondary small fw-bold">{t('userForm.labels.profilePhoto')}</h6>
                        </div>

                        <div className="card bg-light border-0 rounded-3 p-3 mb-3">
                            <div className="form-check form-switch mb-2">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="is-active"
                                                checked={isActive}
                                                onChange={e => setIsActive(e.target.checked)}
                                                disabled={isMinor}
                                />
                                <div className="d-flex justify-content-between align-items-center">
                                    <label className="form-check-label fw-semibold" htmlFor="is-active">{t('userForm.labels.activeAccount')}</label>
                                    <i className="bi bi-info-circle text-muted" onClick={() => setHelpKey('isactive')} style={{ cursor: 'pointer' }}></i>
                                </div>
                                <small className="d-block text-muted">{t('userForm.descriptions.activeAccount')}</small>
                            </div>
                            <hr className="my-2" />
                            <div className="form-check form-switch">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id="is-first-login"
                                    checked={isFirstLogin}
                                    onChange={e => setIsFirstLogin(e.target.checked)}
                                    disabled={isMinor}
                                />
                                <div className="d-flex justify-content-between align-items-center">
                                    <label className="form-check-label fw-semibold" htmlFor="is-first-login">{t('userForm.labels.firstLogin')}</label>
                                    <i className="bi bi-info-circle text-muted" onClick={() => setHelpKey('isfirstlogin')} style={{ cursor: 'pointer' }}></i>
                                </div>
                                <small className="d-block text-muted">{t('userForm.descriptions.firstLogin')}</small>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-8">
                        <div className="mb-4">
                            <h6 className="text-uppercase text-secondary fw-bold fs-7 mb-3 border-bottom pb-2 d-flex justify-content-between align-items-center">
                                <span><i className="bi bi-person-badge me-2 text-primary"></i>{t('userForm.sections.personalInfo')}</span>
                            </h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.firstname')} <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0"><i className="bi bi-person"></i></span>
                                        <input className="form-control border-start-0 ps-0" placeholder={t('userForm.placeholders.firstname')} value={form.firstname || ''} onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.lastname')} <span className="text-danger">*</span></label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0"><i className="bi bi-person-fill"></i></span>
                                        <input className="form-control border-start-0 ps-0" placeholder={t('userForm.placeholders.lastname')} value={form.lastname || ''} onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.birthday')}</label>
                                    <input type="date" className="form-control" value={form.birthday || ''} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
                                </div>
                                <div className="col-md-6">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <label className="form-label small text-muted mb-1">{t('userForm.labels.gender')}</label>
                                        <i className="bi bi-info-circle text-muted" onClick={() => setHelpKey('gender')} style={{ cursor: 'pointer' }}></i>
                                    </div>
                                    <div className="d-flex gap-3 align-items-center">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="gender"
                                                id="gender-male"
                                                checked={(form as any).gender === 'male'}
                                                onChange={() => setForm(f => ({ ...f, gender: 'male' as any }))}
                                            />
                                            <label className="form-check-label" htmlFor="gender-male">{i18n.language === 'fr' ? 'Homme' : i18n.language === 'ar' ? 'ذكر' : 'Male'}</label>
                                        </div>
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="gender"
                                                id="gender-female"
                                                checked={(form as any).gender === 'female'}
                                                onChange={() => setForm(f => ({ ...f, gender: 'female' as any }))}
                                            />
                                            <label className="form-check-label" htmlFor="gender-female">{i18n.language === 'fr' ? 'Femme' : i18n.language === 'ar' ? 'أنثى' : 'Female'}</label>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <label className="form-label small text-muted mb-1">{t('userForm.labels.contributionTier')}</label>
                                        <i className="bi bi-info-circle text-muted" onClick={() => setHelpKey('contribution_tier')} style={{ cursor: 'pointer' }}></i>
                                    </div>
                                    <select
                                        className="form-select"
                                        value={(form as any).contribution_tier ?? ''}
                                        onChange={e => setForm(f => ({ ...f, contribution_tier: e.target.value ? (e.target.value as any) : null }))}
                                    >
                                        <option value="">--</option>
                                        {tierOptions().map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h6 className="text-uppercase text-secondary fw-bold fs-7 mb-3 border-bottom pb-2">
                                <i className="bi bi-envelope-at me-2 text-primary"></i>{t('userForm.sections.contact')}
                            </h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.email')}</label>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white border-end-0"><i className="bi bi-envelope"></i></span>
                                        <input type="email" className={`form-control border-start-0 ps-0 ${emailError ? 'is-invalid' : ''}`} placeholder={t('userForm.placeholders.email')} value={form.email || ''} onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setEmailError(null) }} />
                                    </div>
                                    {emailError && <div className="text-danger small mt-1">{emailError}</div>}
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.phone')}</label>
                                    <div className={`input-group ${phoneError ? 'is-invalid' : ''}`}>
                                        <PhoneInput
                                            international
                                            defaultCountry="GN"
                                            value={phone}
                                            onChange={(val) => { setPhone(val); setPhoneError(null) }}
                                            className="form-control d-flex"
                                            inputClassName="form-control border-0 shadow-none bg-transparent"
                                        />
                                    </div>
                                    {phoneError && <div className="text-danger small mt-1">{phoneError}</div>}
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h6 className="text-uppercase text-secondary fw-bold fs-7 mb-3 border-bottom pb-2">
                                <i className="bi bi-shield-lock me-2 text-primary"></i>{t('userForm.sections.login')}
                            </h6>
                            <div className="col-12">
                                <label className="form-label small text-muted">{t('userForm.labels.username')}</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-white border-end-0"><i className="bi bi-person-circle"></i></span>
                                    <input
                                        className="form-control border-start-0 ps-0"
                                        placeholder={suggestedUsername || t('userForm.placeholders.username')}
                                        value={form.username || ''}
                                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                        style={{ transition: 'background-color 300ms', backgroundColor: isTypingUsername ? '#eaf4ff' : undefined }}
                                    />
                                    {(!form.username && suggestedUsername) && (
                                        <button className="btn btn-outline-primary" type="button" onClick={() => animateFillUsername(suggestedUsername)}>
                                            <i className="bi bi-magic me-1"></i> {t('userForm.buttons.suggest')}
                                        </button>
                                    )}
                                </div>
                                <div className="form-text small">{t('userForm.descriptions.autoUsername')}</div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h6 className="text-uppercase text-secondary fw-bold fs-7 mb-3 border-bottom pb-2">
                                <i className="bi bi-people me-2 text-primary"></i>{t('userForm.sections.family')}
                            </h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.father')}</label>
                                    <Select
                                        isClearable
                                        classNamePrefix="select"
                                        options={fatherOptions}
                                        placeholder={t('userForm.placeholders.selectFather')}
                                        value={fatherOptions.find(o => o.value === fatherId) ?? null}
                                        onChange={(opt) => setFatherId(opt ? (opt as { value: number; label: string }).value : null)}
                                        styles={{ control: (base) => ({ ...base, borderColor: '#dee2e6', boxShadow: 'none' }) }}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label small text-muted">{t('userForm.labels.mother')}</label>
                                    <Select
                                        isClearable
                                        classNamePrefix="select"
                                        options={motherOptions}
                                        placeholder={t('userForm.placeholders.selectMother')}
                                        value={motherOptions.find(o => o.value === motherId) ?? null}
                                        onChange={(opt) => setMotherId(opt ? (opt as { value: number; label: string }).value : null)}
                                        styles={{ control: (base) => ({ ...base, borderColor: '#dee2e6', boxShadow: 'none' }) }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                                <h6 className="text-uppercase text-secondary fw-bold fs-7 mb-0">
                                    <i className="bi bi-diagram-3 me-2 text-primary"></i>{t('userForm.sections.roles')}
                                </h6>
                                <i className="bi bi-info-circle text-muted" onClick={() => setHelpKey('roles')} style={{ cursor: 'pointer' }}></i>
                            </div>

                            <div className="d-flex flex-wrap gap-2">
                                {(
                                    (allowedRoleNames && allowedRoleNames.length > 0
                                        ? allRoles.filter(r => allowedRoleNames.map(n => n.toLowerCase()).includes(String(r.role).toLowerCase()))
                                        : allRoles
                                    )
                                    .filter(r => String(r.role).toLowerCase() !== 'user')
                                ).map(role => {
                                    const isSelected = selectedRoleIds.includes(role.id);
                                    return (
                                        <div key={role.id}
                                            className={`card border ${isSelected ? 'border-primary bg-primary bg-opacity-10' : 'border-light bg-light'} px-3 py-2 cursor-pointer transition-all`}
                                            style={{ cursor: 'pointer', minWidth: '120px' }}
                                            onClick={() => setSelectedRoleIds(prev => isSelected ? prev.filter(id => id !== role.id) : [...prev, role.id])}
                                        >
                                            <div className="form-check pointer-events-none">
                                                <input
                                                    className="form-check-input"
                                                    type="checkbox"
                                                    id={`role-${role.id}`}
                                                    checked={isSelected}
                                                    readOnly
                                                />
                                                <label className={`form-check-label user-select-none fw-medium ${isSelected ? 'text-primary' : 'text-secondary'}`} style={{ cursor: 'pointer' }} htmlFor={`role-${role.id}`}>
                                                    {getRoleLabel(role.role)}
                                                </label>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                    </div>
                </div>

                <Modal isOpen={helpKey !== null} onClose={() => setHelpKey(null)}>
                    <div className="p-2">
                        <h5 className="mb-3 text-primary">{helpKey ? helpText[helpKey].title : ''}</h5>
                        <p className="mb-0 text-muted">{helpKey ? helpText[helpKey].desc : ''}</p>
                    </div>
                </Modal>

            </div>
            <div className="card-footer bg-white border-top-0 p-4 d-flex justify-content-end gap-3 rounded-bottom-4">
                <button className="btn btn-light border px-4" onClick={onCancel} disabled={saving}>
                    {t('userForm.buttons.cancel')}
                </button>
                <button className="btn btn-success px-5 shadow-sm" onClick={submitForm} disabled={saving}>
                    {saving ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            {t('userForm.buttons.saving')}
                        </>
                    ) : (
                        <>
                            <i className="bi bi-check-lg me-2"></i>
                            {t('userForm.buttons.save')}
                        </>
                    )}
                </button>
            </div>
        </div>

    )
}
