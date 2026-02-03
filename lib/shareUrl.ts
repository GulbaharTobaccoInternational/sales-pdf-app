const ORDER_HUB_BASE_URL =
  process.env.NEXT_PUBLIC_GTI_ORDER_HUB_BASE_URL ||
  process.env.ORDER_HUB_BASE_URL ||
  ''

const normalizeBaseUrl = (base: string) => base.replace(/\/+$/, '')

export const buildSharePath = (slug: string) => `/${slug}`

export const buildShareUrl = (slug: string) => {
  const base = normalizeBaseUrl(ORDER_HUB_BASE_URL)
  return base ? `${base}/${slug}` : buildSharePath(slug)
}
