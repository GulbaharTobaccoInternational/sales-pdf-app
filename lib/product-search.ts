export type ProductSearchItem = {
    id: string
    name?: string | null
    size?: string | null
    tar?: string | number | null
    nicotine?: string | number | null
    co?: string | number | null
    flavor?: string | null
    packetStyle?: string | null
    fsp?: string | boolean | number | null
    capsules?: string | number | null
    color?: string | null
    brand?: {
        name?: string | null
    } | null
    updatedAt?: Date | string | null
}

type SearchField<T extends ProductSearchItem> = {
    weight: number
    getValue: (item: T) => string
}

const STOP_WORDS = new Set([
    'a',
    'an',
    'and',
    'by',
    'for',
    'format',
    'flavour',
    'flavours',
    'flavor',
    'flavors',
    'mg',
    'mgs',
    'of',
    'pack',
    'product',
    'products',
    'stick',
    'the',
])

const normalize = (value: unknown) =>
    String(value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/([a-z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([a-z])/g, '$1 $2')
        .replace(/[^a-z0-9.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const unique = <T>(values: T[]) => Array.from(new Set(values))

export const getProductSearchTerms = (query: string) => {
    const normalized = normalize(query)
    if (!normalized) return []

    const terms = unique(
        normalized
            .split(' ')
            .map((term) => term.trim())
            .filter(Boolean)
            .filter((term) => !STOP_WORDS.has(term)),
    )

    return terms.length ? terms : unique(normalized.split(' ').filter(Boolean))
}

const numberAliases = (label: string, value: unknown) => {
    const raw = String(value ?? '').trim()
    if (!raw) return ''

    const withoutTrailingZero = raw.replace(/\.0$/, '')
    return unique([
        raw,
        withoutTrailingZero,
        `${label} ${raw}`,
        `${raw} ${label}`,
        `${raw} mg`,
        `${withoutTrailingZero} mg`,
    ]).join(' ')
}

const fspAliases = (value: ProductSearchItem['fsp']) => {
    const normalized = normalize(value)
    const isEnabled =
        value === true ||
        value === 1 ||
        ['true', 'yes', '1'].includes(normalized)

    return isEnabled
        ? 'fsp yes true full flavor filter'
        : 'fsp no false filter'
}

const searchFields = <T extends ProductSearchItem>(): SearchField<T>[] => [
    { weight: 12, getValue: (item) => item.name ?? '' },
    { weight: 11, getValue: (item) => item.brand?.name ?? '' },
    { weight: 9, getValue: (item) => item.flavor ?? '' },
    { weight: 8, getValue: (item) => item.size ?? '' },
    { weight: 7, getValue: (item) => item.packetStyle ?? '' },
    { weight: 5, getValue: (item) => item.color ?? '' },
    { weight: 4, getValue: (item) => numberAliases('capsules', item.capsules) },
    { weight: 4, getValue: (item) => fspAliases(item.fsp) },
    { weight: 3, getValue: (item) => numberAliases('tar', item.tar) },
    { weight: 3, getValue: (item) => numberAliases('nicotine', item.nicotine) },
    { weight: 3, getValue: (item) => numberAliases('co', item.co) },
]

const editDistanceWithin = (left: string, right: string, maxDistance: number) => {
    if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1

    let previous = Array.from({ length: right.length + 1 }, (_, index) => index)

    for (let i = 1; i <= left.length; i += 1) {
        const current = [i]
        let rowMinimum = current[0]

        for (let j = 1; j <= right.length; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1
            const value = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + cost,
            )
            current[j] = value
            rowMinimum = Math.min(rowMinimum, value)
        }

        if (rowMinimum > maxDistance) return maxDistance + 1
        previous = current
    }

    return previous[right.length]
}

const isCloseTokenMatch = (term: string, candidate: string) => {
    if (term.length < 4 || candidate.length < 4) return false
    const maxDistance = term.length >= 7 ? 2 : 1

    return editDistanceWithin(term, candidate, maxDistance) <= maxDistance
}

const scoreTermInText = (normalizedText: string, term: string) => {
    if (!normalizedText || !term) return 0
    if (normalizedText === term) return 10
    if (normalizedText.startsWith(term)) return 8

    const words = normalizedText.split(' ')
    if (words.some((word) => word === term)) return 7
    if (words.some((word) => word.startsWith(term))) return 6
    if (normalizedText.includes(term)) return 4
    if (words.some((word) => isCloseTokenMatch(term, word))) return 2

    return 0
}

const scorePhraseInText = (normalizedText: string, normalizedQuery: string) => {
    if (!normalizedText || !normalizedQuery || normalizedQuery.length < 2) return 0
    if (normalizedText === normalizedQuery) return 16
    if (normalizedText.startsWith(normalizedQuery)) return 12
    if (normalizedText.includes(normalizedQuery)) return 9

    return 0
}

const updatedAtValue = (item: ProductSearchItem) =>
    item.updatedAt ? new Date(item.updatedAt).getTime() : 0

export const getProductSearchScore = <T extends ProductSearchItem>(
    item: T,
    query: string,
) => {
    const normalizedQuery = normalize(query)
    const terms = getProductSearchTerms(query)
    if (!normalizedQuery || terms.length === 0) return 0

    const matchedTerms = new Set<string>()
    let score = 0

    searchFields<T>().forEach((field) => {
        const normalizedText = normalize(field.getValue(item))
        if (!normalizedText) return

        score += scorePhraseInText(normalizedText, normalizedQuery) * field.weight

        terms.forEach((term) => {
            const termScore = scoreTermInText(normalizedText, term)
            if (termScore > 0) {
                matchedTerms.add(term)
                score += termScore * field.weight
            }
        })
    })

    return terms.every((term) => matchedTerms.has(term)) ? score : 0
}

export const rankProductsForSearch = <T extends ProductSearchItem>(
    products: T[],
    query: string,
) =>
    products
        .map((product, index) => ({
            product,
            index,
            score: getProductSearchScore(product, query),
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => {
            if (right.score !== left.score) return right.score - left.score

            const leftName = normalize(`${left.product.brand?.name ?? ''} ${left.product.name ?? ''}`)
            const rightName = normalize(`${right.product.brand?.name ?? ''} ${right.product.name ?? ''}`)
            const nameCompare = leftName.localeCompare(rightName)
            if (nameCompare !== 0) return nameCompare

            const dateCompare =
                updatedAtValue(right.product) - updatedAtValue(left.product)
            if (dateCompare !== 0) return dateCompare

            return left.index - right.index
        })
        .map((item) => item.product)
