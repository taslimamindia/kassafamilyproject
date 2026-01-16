import i18n from '../i18n'

// Centralized, i18n-friendly role display labels.
// Add new roles here once, and all components using getRoleLabel() will reflect automatically.
// Keys are normalized to lowercase.
const ROLE_LABELS_RESOURCES = {
    fr: {
        roleLabels: {
            admin: 'Administrateur',
            admingroup: 'Capitaine de famille',
            user: 'Utilisateur',
            treasury: 'Trésorerie',
            board: 'Membre du conseil d\'administration',
            member: 'Membre',
            norole: 'Sans rôle',
            guest: 'Invité',
        },
    },
    en: {
        roleLabels: {
            admin: 'Administrator',
            admingroup: 'Family Captain',
            user: 'User',
            treasury: 'Treasury',
            board: 'Board Member',
            member: 'Member',
            norole: 'No role',
            guest: 'Guest',
        },

    },
    ar: {
        roleLabels: {
            admin: 'مدير',
            admingroup: 'قائد العائلة',
            user: 'مستخدم',
            treasury: 'الخزانة',
            board: 'عضو مجلس الإدارة',
            member: 'عضو',
            norole: 'بدون دور',
            guest: 'ضيف',
        },

    },
}

for (const [lng, res] of Object.entries(ROLE_LABELS_RESOURCES)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

function normalizeRole(role?: string | null): string {
    return (role || '').trim().toLowerCase()
}

function titleCase(s: string): string {
    return s
        .replace(/[_.-]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

export function getRoleLabel(role?: string | null): string {
    const key = normalizeRole(role)
    if (!key) return ''
    const label = i18n.t(`roleLabels.${key}`)
    // If i18n returns the key itself (missing), fallback to title-cased original
    if (!label || label === `roleLabels.${key}`) {
        return titleCase(role!)
    }
    return label
}

export function mapRoleNamesToOptions(roles: Array<{ id: number; role: string }>): Array<{ value: string; label: string }> {
    return roles.map(r => ({ value: r.role, label: getRoleLabel(r.role) }))
}
