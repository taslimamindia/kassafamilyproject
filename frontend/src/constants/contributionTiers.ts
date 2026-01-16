import i18n from '../i18n'

export type ContributionTier = 'LEVEL1' | 'LEVEL2' | 'LEVEL3' | 'LEVEL4'

export const ALL_TIERS: ContributionTier[] = ['LEVEL1', 'LEVEL2', 'LEVEL3', 'LEVEL4']

// Register labels for tiers in i18n once centrally
const tierLabelsResources = {
    fr: {
        tiers: {
            LEVEL1: '1 Millions GNF par ans',
            LEVEL2: '600 Milles GNF par ans',
            LEVEL3: '20 milles par mois',
            LEVEL4: '20 milles par ans',
        },
    },
    en: {
        tiers: {
            LEVEL1: '1 million GNF per year',
            LEVEL2: '600 thousand GNF per year',
            LEVEL3: '20 thousand per month',
            LEVEL4: '20 thousand per year',
        },
    },
    ar: {
        tiers: {
            LEVEL1: '1 مليون فرنك غيني سنوياً',
            LEVEL2: '600 ألف فرنك غيني سنوياً',
            LEVEL3: '20 ألف شهرياً',
            LEVEL4: '20 ألف سنوياً',
        },
    },
}

for (const [lng, res] of Object.entries(tierLabelsResources)) {
    i18n.addResourceBundle(lng, 'translation', res as any, true, false)
}

export function getTierLabel(tier?: ContributionTier | null): string {
    if (!tier) return ''
    return i18n.t(`tiers.${tier}`)
}

export function tierOptions(): Array<{ value: ContributionTier; label: string }> {
    return ALL_TIERS.map(t => ({ value: t, label: i18n.t(`tiers.${t}`) }))
}
