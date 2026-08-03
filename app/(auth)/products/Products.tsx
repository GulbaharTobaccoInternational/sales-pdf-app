'use client'
export const dynamic = 'force-dynamic'

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react'
import { columns, ITable } from '@/components/custom/table/products/columns'
import { DataTable } from '@/components/custom/table/data-table'
import ProductsFilters from '@/components/products/filters/products-filters'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import routes from '@/lib/routes'
import toast from 'react-hot-toast'
import { Plus, ShoppingCart, Trash } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import PageHeading from '@/components/layout/page-heading'
import { FloatingLabelInput } from '@/components/ui/floating-label-input'
import { useUserRole } from '@/hooks/useUserRole'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import 'react-quill/dist/quill.snow.css'
import { useSearchParams } from 'next/navigation'
import { PaginationBar } from '@/components/ui/pagination'
import { Controller, useForm } from 'react-hook-form'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { countryData } from '@/lib/country-data'
import { isValidPhoneNumber } from 'react-phone-number-input'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/* -------------------- types -------------------- */
interface IBrand {
  id: string
  name: string
  position?: number
}

export type INonProductPageItem = {
  id: string
  title: string
  type: 'banner' | 'banner_front' | 'banner_back' | 'advertisement' | 'promotion'
  filePath: string
}

interface AdditionalPage {
  id: string
  position: number
}

type NonProductPageItem = {
  id: string
  filePath: string
  title: string
  type: 'banner' | 'banner_front' | 'banner_back' | 'advertisement' | 'promotion'
}

type Client = {
  id: string
  email: string
  firstName: string
  lastName: string
}

type QuickClientForm = {
  firstName: string
  lastName: string
  company: string
  primaryNumber: string
  secondaryNumber?: string
  country: string
  email: string
}

const clientSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  company: yup.string().required('Company is required'),
  email: yup
    .string()
    .email('Enter a valid email address')
    .required('Email is required'),
  primaryNumber: yup
    .string()
    .required('Primary number is required')
    .test('is-valid', 'Enter a valid phone number', (value) =>
      value ? isValidPhoneNumber(value) : false,
    ),
  secondaryNumber: yup
    .string()
    .optional()
    .test('is-valid', 'Enter a valid phone number', (value) =>
      !value || isValidPhoneNumber(value),
    ),
  country: yup.string().required(),
})

/* ----------------- presentational ---------------- */
const GlassPanel = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={[
      'rounded-2xl border border-white/20 bg-white/80 backdrop-blur-xl',
      'shadow-[0_18px_60px_rgba(15,23,42,0.14)]',
      className,
    ].join(' ')}
  >
    {children}
  </div>
)

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-semibold tracking-tight text-zinc-900">
    {children}
  </h3>
)

/* ------------------ product form ----------------- */
type ProductFormValues = {
  name: string
  brandId: string
  size: string
  flavor: string
  tar: string
  nicotine: string
  co?: string
  packetStyle: string
  fsp: string
  capsules: string
  color: string
  image?: FileList
  pdf?: FileList
}

const EMPTY_DEFAULTS: ProductFormValues = {
  name: '',
  brandId: '',
  size: '',
  flavor: '',
  tar: '',
  nicotine: '',
  co: '',
  packetStyle: '',
  fsp: '',
  capsules: '',
  color: '',
}

/* ---------- PDF preview & card helpers (TOP-LEVEL) ---------- */

// clean preview, remove browser blue outline
const PdfPreview = ({
  src,
  className,
  stopClickPropagation = false, // still used in edit dialog
  disableInteractions = false, // when true, PDF won't capture scroll/click
}: {
  src?: string
  className?: string
  stopClickPropagation?: boolean
  disableInteractions?: boolean
}) => {
  if (!src) return null
  const url = `${src}${src.includes('#') ? '' : '#'}toolbar=0&navpanes=0&scrollbar=0&zoom=page-fit`

  // For tiles: render PDF with pointer-events: none so the button click works
  if (disableInteractions) {
    const wrapperClass =
      className ??
      'w-full aspect-square rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden relative'

    return (
      <div className={wrapperClass} style={{ outline: 'none' }}>
        <embed
          src={url}
          type="application/pdf"
          className="h-full w-full"
          style={{ pointerEvents: 'none', border: 'none' }}
        />
      </div>
    )
  }

  // For edit dialog etc. – keep interactive behaviour
  return (
    <embed
      src={url}
      type="application/pdf"
      onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
      className={
        className ??
        'w-full aspect-square rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden'
      }
      style={{ outline: 'none' }}
    />
  )
}

// Single card for corporate/adverts/promotions
const PdfChoiceCard = React.memo(
  ({
    item,
    isSelected,
    onClick,
  }: {
    item: INonProductPageItem
    isSelected: boolean
    onClick: () => void
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        'relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-3 text-left shadow-sm transition-all',
        'hover:-translate-y-[1px] hover:shadow-md',
        isSelected
          ? 'border-zinc-900 ring-2 ring-zinc-900/60'
          : 'border-zinc-200 hover:border-zinc-400',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="line-clamp-2 text-xs font-semibold tracking-tight text-zinc-900">
          {item.title}
        </p>
      </div>

      {/* whole PDF is now static thumbnail; click handled by parent button */}
      <PdfPreview src={item.filePath} disableInteractions />
    </button>
  ),
  (prev, next) =>
    prev.item.id === next.item.id && prev.isSelected === next.isSelected,
)

/* ===================== PAGE ===================== */
const Products = () => {
  const [products, setProducts] = useState<ITable[]>([])
  const [brands, setBrands] = useState<IBrand[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [buttonLoading, setButtonLoading] = useState(false)

  // this is still the list of selected IDs used for PDF generation
  const [selectedRows, setSelectedRows] = useState<string[]>([])

  // cart preview items (full product objects)
  const [cartItems, setCartItems] = useState<ITable[]>([])
  const [isCartDialogOpen, setIsCartDialogOpen] = useState(false)

  const [isPdfDialogOpen, setIsPdfDialogOpen] = useState(false)
  const [pdfStep, setPdfStep] = useState(1)
  const [pdfStepError, setPdfStepError] = useState<string | null>(null)

  const [corporateFronts, setCorporateFronts] = useState<INonProductPageItem[]>([])
  const [corporateBacks, setCorporateBacks] = useState<INonProductPageItem[]>([])
  const [selectedCorporateFront, setSelectedCorporateFront] = useState<string | null>(null)
  const [selectedCorporateBack, setSelectedCorporateBack] = useState<string | null>(null)
  const [selectedBanner, setSelectedBanner] = useState<string | null>(null)

  const [advertisements, setAdvertisements] = useState<INonProductPageItem[]>([])
  const [promotions, setPromotions] = useState<INonProductPageItem[]>([])

  const [selectedAdverts, setSelectedAdverts] = useState<AdditionalPage[]>([])
  const [selectedPromotions, setSelectedPromotions] = useState<AdditionalPage[]>([])

  const [selectedProduct, setSelectedProduct] = useState<ITable | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false)
  const [shareableUrl, setShareableUrl] = useState('')
  const role = useUserRole()

  const [nonProductItems, setNonProductItems] = useState<NonProductPageItem[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedCorporateInfo, setSelectedCorporateInfo] =
    useState<string | undefined>(undefined)
  const [addedPromotions, setAddedPromotions] = useState<
    { id: string; position: number }[]
  >([])
  const [selectedClient, setSelectedClient] = useState<string | undefined>(undefined)

  const searchParams = useSearchParams()
  const initialBrandId = searchParams.get('brandId')

  const initialFilters = useMemo<Record<string, string> | undefined>(
    () => (initialBrandId ? { brandId: initialBrandId } : undefined),
    [initialBrandId],
  )

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false)
  const [isClientSubmitting, setIsClientSubmitting] = useState(false)

  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [total, setTotal] = useState(0)

  const totalPages = React.useMemo(
    () => (total > 0 ? Math.ceil(total / pageSize) : 1),
    [total, pageSize],
  )

  const [mediaMap, setMediaMap] = useState<
    Record<string, { image?: string; pdfUrl?: string }>
  >({})
  const [mediaLoading, setMediaLoading] = useState(false)

  const [hasLoadedNonProductItems, setHasLoadedNonProductItems] = useState(false)
  const [hasLoadedClients, setHasLoadedClients] = useState(false)

  const [nonProductLoading, setNonProductLoading] = useState(false)
  const [clientsLoading, setClientsLoading] = useState(false)

  const isPWA = () => window.matchMedia('(display-mode: standalone)').matches
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  const CART_KEY = 'gti-products-cart'

  /* -------- client form (quick add) -------- */
  const {
    control: clientControl,
    register: clientRegister,
    handleSubmit: handleClientSubmit,
    reset: resetClientForm,
    formState: { errors: clientErrors },
  } = useForm<QuickClientForm>({
    resolver: yupResolver(clientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      company: '',
      primaryNumber: '',
      secondaryNumber: '',
      country: 'United Arab Emirates',
      email: '',
    },
  })

  const openClientDialog = () => {
    resetClientForm()
    setIsClientDialogOpen(true)
  }

  const submitQuickClient = async (data: QuickClientForm) => {
    setIsClientSubmitting(true)
    try {
      const res = await api.post('/api/clients', data)
      const newClient: Client = res.data
      setClients((prev) => [newClient, ...prev])
      setSelectedClient(newClient.id)
      toast.success('Client added')
      setIsClientDialogOpen(false)
    } catch {
      toast.error('Failed to add client')
    } finally {
      setIsClientSubmitting(false)
    }
  }

  /* -------------- Product form -------------- */
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control: productControl,
    clearErrors,
    formState: { errors },
  } = useForm<ProductFormValues>({
    defaultValues: EMPTY_DEFAULTS,
    shouldUnregister: true,
    mode: 'onChange',
    reValidateMode: 'onChange',
  })

  const [fileKey, setFileKey] = useState(0)

  const tarOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(i + 1)),
    [],
  )

  const nicotineOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ((i + 1) / 10).toFixed(1)),
    [],
  )

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        ...filters,
        page: String(page),
        pageSize: String(pageSize),
      }).toString()

      const response = await fetch(`/api/products?${queryParams}`)
      const result = await response.json()

      const baseProducts: ITable[] = result.products
      setProducts(baseProducts)
      setTotal(result.total)

      if (baseProducts.length) {
        setMediaLoading(true)
        try {
          const ids = baseProducts.map((p) => p.id).join(',')
          const mediaRes = await fetch(
            `/api/products/media?ids=${encodeURIComponent(ids)}`,
          )
          const mediaJson = await mediaRes.json()
          const map: Record<string, { image?: string; pdfUrl?: string }> = {}

            ; (mediaJson.items || []).forEach((item: any) => {
              map[item.id] = {
                image: item.image ?? '',
                pdfUrl: item.pdfUrl ?? '',
              }
            })

          setMediaMap(map)
        } catch (mediaErr) {
          console.error('Failed to fetch product media:', mediaErr)
          setMediaMap({})
        } finally {
          setMediaLoading(false)
        }
      } else {
        setMediaMap({})
      }
    } catch (e) {
      console.error('Failed to fetch products:', e)
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize])

  const fetchBrands = useCallback(async () => {
    try {
      const response = await fetch('/api/brands')
      const data = await response.json()
      setBrands(data)
    } catch (e) {
      console.error('Failed to fetch brands:', e)
    }
  }, [])

  const fetchNonProductItems = useCallback(async () => {
    try {
      setNonProductLoading(true)
      const response = await api.get('/api/non-product-pages')
      const data: INonProductPageItem[] = response.data

      setNonProductItems(data)
      setCorporateFronts(
        data.filter((i) => i.type === 'banner_front' || i.type === 'banner'),
      )
      setCorporateBacks(data.filter((i) => i.type === 'banner_back'))
      setAdvertisements(data.filter((i) => i.type === 'advertisement'))
      setPromotions(data.filter((i) => i.type === 'promotion'))
    } catch (e) {
      console.error('Failed to fetch non-product items', e)
      toast.error('Failed to fetch non-product items.')
    } finally {
      setNonProductLoading(false)
    }
  }, [])

  const fetchClients = useCallback(async () => {
    try {
      setClientsLoading(true)
      const response = await api.get('/api/clients')
      setClients(response.data)
    } catch (e) {
      console.error('Failed to fetch clients', e)
      toast.error('Failed to fetch clients.')
    } finally {
      setClientsLoading(false)
    }
  }, [])

  const ensureNonProductItemsLoaded = useCallback(async () => {
    if (hasLoadedNonProductItems) return
    await fetchNonProductItems()
    setHasLoadedNonProductItems(true)
  }, [hasLoadedNonProductItems, fetchNonProductItems])

  const ensureClientsLoaded = useCallback(async () => {
    if (hasLoadedClients) return
    await fetchClients()
    setHasLoadedClients(true)
  }, [hasLoadedClients, fetchClients])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  // 🧺 Load cart from localStorage on first render
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = window.localStorage.getItem(CART_KEY)
      if (!stored) return

      const parsed: ITable[] = JSON.parse(stored)
      if (!Array.isArray(parsed) || !parsed.length) return

      setCartItems(parsed)
      setSelectedRows(parsed.map((p) => p.id))
    } catch (e) {
      console.error('Failed to load cart from localStorage', e)
    }
  }, [])

  // 🧺 Persist cart whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!cartItems.length) {
      window.localStorage.removeItem(CART_KEY)
      return
    }

    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cartItems))
    } catch (e) {
      console.error('Failed to save cart to localStorage', e)
    }
  }, [cartItems])

  const handleFilterChange = (newFilters: { [key: string]: string }) => {
    setFilters(newFilters)
    setPage(1)
  }

  const handleEdit = (item: ITable) => {
    setSelectedProduct(item)
    setIsDialogOpen(true)

    const fspNormalized: 'true' | 'false' =
      typeof item.fsp === 'boolean'
        ? item.fsp
          ? 'true'
          : 'false'
        : /^(true|yes|1)$/i.test(String(item.fsp))
          ? 'true'
          : 'false'

    reset({
      name: (item as any).name ?? '',
      brandId: (item as any).brandId ?? '',
      size: String((item as any).size ?? ''),
      flavor: (item as any).flavor ?? '',
      tar: String((item as any).tar ?? ''),
      nicotine: String((item as any).nicotine ?? ''),
      co: String((item as any).co ?? ''),
      packetStyle: (item as any).packetStyle ?? '',
      fsp: fspNormalized,
      capsules: String((item as any).capsules ?? ''),
      color: (item as any).color ?? '',
    })

    clearErrors(['tar', 'nicotine', 'brandId', 'name', 'size', 'flavor'])
  }

  const handleDelete = (id: string) => {
    setDeleteProductId(id)
    setIsDeleteDialogOpen(true)
  }

  // 🔹 Toggle product in cart (add on first click, remove on second)
  const handleAddToCart = (product: ITable) => {
    // Toggle in selectedRows
    setSelectedRows((prev) =>
      prev.includes(product.id)
        ? prev.filter((id) => id !== product.id)
        : [...prev, product.id],
    )

    // Toggle in cartItems
    setCartItems((prev) => {
      const exists = prev.some((p) => p.id === product.id)
      if (exists) {
        // remove from cart
        return prev.filter((p) => p.id !== product.id)
      }
      // add to cart
      return [...prev, product]
    })
  }

  // 🔹 Remove from cart
  const handleRemoveFromCart = (id: string) => {
    setSelectedRows((prev) => prev.filter((pid) => pid !== id))
    setCartItems((prev) => prev.filter((p) => p.id !== id))
  }

  // merge base text products + media
  const tableData: ITable[] = useMemo(
    () =>
      products.map((p) => {
        const media = mediaMap[p.id] || {}
        return {
          ...p,
          image: media.image ?? (p as any).image,
          pdfUrl: media.pdfUrl ?? (p as any).pdfUrl,
        }
      }),
    [products, mediaMap],
  )

  const _columns = useMemo(
    () =>
      columns(
        role,
        handleEdit,
        handleDelete,
        mediaLoading,
        handleAddToCart,
        (id) => selectedRows.includes(id),
      ),
    [role, handleEdit, handleDelete, mediaLoading, handleAddToCart, selectedRows],
  )

  const handleGeneratePDF = async () => {
    if (!selectedCorporateFront || !selectedCorporateBack) {
      toast.error('Please select both Corporate Info (Front and Back) before generating the PDF.')
      setPdfStep(1)
      toast.error('Please select both Corporate Info (Front and Back) before generating the PDF.')
      return
    }

    // 🔴 NEW: client is mandatory
    if (!selectedClient) {
      setPdfStep(3)
      toast.error('Please select or add a client before generating the PDF.')
      return
    }

    setButtonLoading(true)
    try {
      const additionalPages = [
        ...selectedAdverts.map((a) => ({ id: a.id, position: a.position })),
        ...selectedPromotions.map((p) => ({ id: p.id, position: p.position })),
      ]

      // 1) Generate merged PDF content
      const response = await api.post('/api/pdf/generate', {
        frontCorporateId: selectedCorporateFront,
        backCorporateId: selectedCorporateBack,
        productIds: selectedRows,
        additionalPages,
        clientId: selectedClient,
      })

      if (response.status !== 200) {
        toast.error(`Error: ${response.data?.error || 'Failed to generate PDF'}`)
        return
      }

      const pdfUrl: string = response.data.url

      // 2) Create SharedPDF record → get proposalNumber + fileName
      const expirationDate = new Date()
      expirationDate.setDate(expirationDate.getDate() + 30)

      const shared = await api
        .post('/api/shared-pdf', {
          productIds: selectedRows.join(','),
          expiresAt: expirationDate.toISOString(),
          clientId: selectedClient,
        })
        .then((res) => res.data as { slug: string; proposalNumber: number; fileName?: string })

      const shareSlug = shared.slug
      const proposalNumber = shared.proposalNumber
      const fileName =
        shared.fileName ||
        `GTI_PROPOSAL_${String(proposalNumber ?? 250001)}.pdf`

      const shareableUrl = `${process.env.NEXT_PUBLIC_GTI_ORDER_HUB_BASE_URL}/${shareSlug}`

      toast.success('PDF generated successfully!')

      // 3) Download PDF with final GTI_PROPOSAL_XXXXXX.pdf name
      try {
        const blob = await fetch(pdfUrl).then((res) => res.blob())
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to auto-download PDF:', err)
      }

      // 4) Reset state
      setIsPdfDialogOpen(false)
      setPdfStep(1)
      setPdfStepError(null)
      setSelectedBanner(null)
      setSelectedAdverts([])
      setSelectedPromotions([])
      reset()
      setSelectedRows([])
      setCartItems([])
      setSelectedClient(undefined)
      setSelectedCorporateFront(null)
      setSelectedCorporateBack(null)

      // 5) Mobile / PWA share
      if ((isPWA() || isMobile()) && navigator.share) {
        try {
          const blob = await fetch(pdfUrl).then((res) => res.blob())
          const file = new File([blob], fileName, { type: 'application/pdf' })
          await navigator.share({
            title: 'Shared PDF',
            text: `View the products here: ${shareableUrl}`,
            files: [file],
          })
        } catch (err) {
          console.error('Error sharing:', err)
        }
      } else {
        setShareableUrl(shareableUrl)
        setIsShareDialogOpen(true)
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error)
      toast.error('Failed to generate PDF.')
    } finally {
      setButtonLoading(false)
    }
  }


  const handleAddOrUpdateProduct = async (data: ProductFormValues) => {
    if (role !== 'ADMIN') {
      toast.error('You are not authorized to perform this action.')
      return
    }
    setButtonLoading(true)

    const formData = new FormData()
    formData.append('name', data.name ?? '')
    formData.append('brandId', data.brandId ?? '')
    formData.append('size', data.size ?? '')
    formData.append('flavor', data.flavor ?? '')
    formData.append('tar', data.tar ?? '')
    formData.append('nicotine', data.nicotine ?? '')
    formData.append('co', data.co ?? '')
    formData.append('packetStyle', data.packetStyle ?? '')
    formData.append('fsp', data.fsp ?? '')
    formData.append('capsules', data.capsules ?? '')
    formData.append('color', data.color ?? '')

    if (data.image?.length) formData.append('image', data.image[0])
    if (data.pdf?.length) formData.append('pdf', data.pdf[0])

    try {
      const url = selectedProduct
        ? `/api/products/${selectedProduct.id}/pdf`
        : routes.addProduct
      const method = selectedProduct ? 'PUT' : 'POST'

      const response = await api({
        method,
        url,
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (response.status === 200 || response.status === 201) {
        toast.success(
          `Product ${selectedProduct ? 'updated' : 'added'} successfully`,
        )
        fetchProducts()
        reset()
        setSelectedProduct(null)
        setIsDialogOpen(false)
      } else {
        toast.error(
          `Failed to ${selectedProduct ? 'update' : 'add'} product`,
        )
      }
    } catch (error: any) {
      console.error(error)
      toast.error(
        error?.response?.data?.error
          ? `Error: ${error.response.data.error}`
          : `Error ${selectedProduct ? 'updating' : 'adding'} product`,
      )
    } finally {
      setButtonLoading(false)
    }
  }

  const handleDeleteProduct = async () => {
    if (role !== 'ADMIN') {
      toast.error('You are not authorized to perform this action.')
      return
    }
    if (!deleteProductId) return
    try {
      const response = await api.delete(
        `/api/products/${deleteProductId}/pdf`,
      )
      if (response.status === 200) {
        toast.success('Product deleted successfully')
        fetchProducts()
        setIsDeleteDialogOpen(false)
      } else {
        toast.error('Failed to delete product')
      }
    } catch (error) {
      toast.error('Error deleting product')
      console.error(error)
    }
  }

  const handleRefresh = () => fetchProducts()
  const handleClearSelection = () => {
    // filters clear, cart stays
  }

  const handleRemoveAll = () => {
    setCartItems([])          // empty cart list
    setSelectedRows([])       // unselect all icons
    window.localStorage.removeItem(CART_KEY)  // clear saved cart
  }

  const addAdditionalPage = (type: 'advert' | 'promotion', id: string) => {
    if (!id) return
    if (type === 'advert') {
      if (selectedAdverts.some((a) => a.id === id)) return
      setSelectedAdverts((prev) => [...prev, { id, position: 2 }])
    } else {
      if (selectedPromotions.some((p) => p.id === id)) return
      setSelectedPromotions((prev) => [...prev, { id, position: 2 }])
    }
  }

  const removeAdditionalPage = (type: 'advert' | 'promotion', id: string) => {
    if (type === 'advert')
      setSelectedAdverts((prev) => prev.filter((p) => p.id !== id))
    else setSelectedPromotions((prev) => prev.filter((p) => p.id !== id))
  }

  const updateAdditionalPagePosition = (
    type: 'advert' | 'promotion',
    id: string,
    position: number,
  ) => {
    const updater = (pages: AdditionalPage[]) =>
      pages.map((p) => (p.id === id ? { ...p, position } : p))
    if (type === 'advert') setSelectedAdverts(updater)
    else setSelectedPromotions(updater)
  }

  const renderPositionDropdown = (
    type: 'advert' | 'promotion',
    page: AdditionalPage,
  ) => {
    const totalProductPages = selectedRows.length
    const options = []
    options.push(
      <option key="pos-2" value={2}>
        After Corporate Info
      </option>,
    )
    for (let i = 0; i < totalProductPages; i++) {
      options.push(
        <option key={`pos-${i + 3}`} value={i + 3}>
          {`After Product ${i + 1}`}
        </option>,
      )
    }
    options.push(
      <option key={`pos-end`} value={totalProductPages + 2}>
        At the end
      </option>,
    )
    return (
      <select
        value={page.position}
        onChange={(e) =>
          updateAdditionalPagePosition(
            type,
            page.id,
            parseInt(e.target.value, 10),
          )
        }
        className="rounded-lg border border-zinc-200 bg-white/80 px-2 py-1 text-xs font-medium text-zinc-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-zinc-800"
      >
        {options}
      </select>
    )
  }

  const tableLoading = loading

  const openPdfDialog = async () => {
    setIsPdfDialogOpen(true)
    setPdfStep(1)
    setPdfStepError(null)
    await Promise.all([
      ensureNonProductItemsLoaded(),
      ensureClientsLoaded(),
    ])
  }

  const handlePdfNext = () => {
    if (pdfStep === 1) {
      if (!selectedCorporateFront || !selectedCorporateBack) {
        toast.error(
          'Please select both Corporate Info (Front) and Corporate Info (Back) before continuing.',
        )
        return
      }
    }

    if (pdfStep === 2) {
      const hasAdvert = selectedAdverts.length > 0
      const hasPromo = selectedPromotions.length > 0
      // if (!hasAdvert || !hasPromo) {
      //   toast.error(
      //     'Please select at least one Advert and one Promotion before continuing.',
      //   )
      //   return
      // }
    }

    setPdfStepError(null)
    setPdfStep((s) => s + 1)
  }

  /* ----------------------- JSX ----------------------- */

  return (
    <div className="relative">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-100" />
        <div className="absolute left-1/2 top-[-120px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(15,23,42,0.16),rgba(255,255,255,0)_60%)]" />
      </div>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <PageHeading heading="Products" />
          <GlassPanel className="flex items-center gap-2 p-2">
            {role === 'ADMIN' && (
              <Button
                variant="black"
                onClick={() => {
                  setSelectedProduct(null)
                  reset(EMPTY_DEFAULTS)
                  setFileKey((k) => k + 1)
                  reset()
                  setIsDialogOpen(true)
                }}
                className="gap-2 rounded-xl px-3 py-2 text-sm font-medium"
              >
                <Plus size={18} />
                New Product
              </Button>
            )}

            {/* Cart button */}
            <Button
              variant="outline-black"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              disabled={cartItems.length === 0}
              onClick={() => setIsCartDialogOpen(true)}
            >
              <ShoppingCart className="h-4 w-4" />
              <span>Cart ({cartItems.length})</span>
            </Button>

            {/* Next step */}
            <Button
              variant="outline-black"
              disabled={selectedRows.length === 0}
              onClick={openPdfDialog}
              className="rounded-xl px-3 py-2 text-sm font-medium"
            >
              Next Step
            </Button>
          </GlassPanel>
        </div>

        {/* Filters */}
        <GlassPanel className="p-3">
          <ProductsFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onRefresh={handleRefresh}
            onClearSelection={handleClearSelection}
            initialFilters={initialFilters}
          />
        </GlassPanel>

        {/* Table */}
        <GlassPanel className="p-3">
          <DataTable<ITable>
            columns={_columns}
            data={tableData}
            filterField="name"
            loading={tableLoading}
            isRemovePagination={false}
          />
          <div className="border-t border-white/30 pt-3">
            <PaginationBar
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        </GlassPanel>

        {/* Add/Edit Dialog */}
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => {
            reset()
            setSelectedProduct(null)
            setIsDialogOpen(false)
          }}
          title={selectedProduct ? 'Edit Product' : 'Add New Product'}
          onSubmit={handleSubmit(handleAddOrUpdateProduct)}
          buttonLoading={buttonLoading}
        >
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-2">
            <SectionTitle>Details</SectionTitle>
            <GlassPanel className="space-y-4 p-4">
              {/* Name */}
              <div>
                <FloatingLabelInput
                  label="Enter product name"
                  name="name"
                  value={watch('name') || ''}
                  onChange={(val) => setValue('name', val, { shouldValidate: true })}
                  error={String(errors.name?.message || '')}
                />
                <input
                  type="hidden"
                  {...register('name', { required: 'Name is required' })}
                />
              </div>

              {/* Brand */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Brand
                </label>
                <select
                  {...register('brandId', { required: 'Brand is required' })}
                  className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  defaultValue={watch('brandId') || ''}
                >
                  <option value="">Select a brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {errors.brandId?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {String(errors.brandId.message)}
                  </p>
                )}
              </div>

              {/* Size */}
              <div>
                <FloatingLabelInput
                  label="Enter Stick Format"
                  name="size"
                  value={watch('size') || ''}
                  onChange={(val) => setValue('size', val, { shouldValidate: true })}
                  error={String(errors.size?.message || '')}
                />
                <input
                  type="hidden"
                  {...register('size', { required: 'Stick format is required' })}
                />
              </div>

              {/* Flavor */}
              <div>
                <FloatingLabelInput
                  label="Flavour"
                  name="flavor"
                  value={watch('flavor') || ''}
                  onChange={(val) => setValue('flavor', val, { shouldValidate: true })}
                  error={String(errors.flavor?.message || '')}
                />
                <input
                  type="hidden"
                  {...register('flavor', { required: 'Flavour is required' })}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Tar (mg)
                </label>
                <select
                  {...register('tar', { required: 'Tar is required' })}
                  value={watch('tar') ?? ''}
                  onChange={(e) =>
                    setValue('tar', e.target.value, { shouldValidate: true })
                  }
                  className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="">Select Tar</option>
                  {tarOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {errors.tar?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {String(errors.tar.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Nicotine (mg)
                </label>
                <select
                  {...register('nicotine', { required: 'Nicotine is required' })}
                  value={watch('nicotine') ?? ''}
                  onChange={(e) =>
                    setValue('nicotine', e.target.value, { shouldValidate: true })
                  }
                  className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                >
                  <option value="">Select Nicotine</option>
                  {nicotineOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {errors.nicotine?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {String(errors.nicotine.message)}
                  </p>
                )}
              </div>

              {/* CO */}
              <div>
                <FloatingLabelInput
                  type="number"
                  label="Enter CO (mg)"
                  name="co"
                  value={watch('co') || ''}
                  onChange={(val) => setValue('co', val, { shouldValidate: true })}
                  error={String(errors.co?.message || '')}
                />
                <input type="hidden" {...register('co')} />
              </div>

              {/* Packet style */}
              <div>
                <FloatingLabelInput
                  label="Pack Format (e.g., Fan Pack, Slide Pack, Regular)"
                  name="packetStyle"
                  value={watch('packetStyle') || ''}
                  onChange={(val) =>
                    setValue('packetStyle', val, { shouldValidate: true })
                  }
                  error={String(errors.packetStyle?.message || '')}
                />
                <input
                  type="hidden"
                  {...register('packetStyle', {
                    required: 'Pack format is required',
                  })}
                />
              </div>

              {/* FSP */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  FSP
                </label>
                <select
                  {...register('fsp', { required: 'FSP selection is required' })}
                  className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  value={watch('fsp') ?? ''}
                  onChange={(e) =>
                    setValue('fsp', e.target.value, { shouldValidate: true })
                  }
                >
                  <option value="">Select FSP</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
                {errors.fsp?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {String(errors.fsp.message)}
                  </p>
                )}
              </div>

              {/* Capsules */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Capsules
                </label>
                <select
                  {...register('capsules', { required: 'Select number of capsules' })}
                  className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                  value={watch('capsules') ?? ''}
                  onChange={(e) =>
                    setValue('capsules', e.target.value, { shouldValidate: true })
                  }
                >
                  <option value="">Select Capsules</option>
                  <option value="0">0</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </select>
                {errors.capsules?.message && (
                  <p className="mt-1 text-xs text-red-500">
                    {String(errors.capsules.message)}
                  </p>
                )}
              </div>

              {/* Color */}
              <div>
                <FloatingLabelInput
                  label="Enter Packet Color"
                  name="color"
                  value={watch('color') || ''}
                  onChange={(val) => setValue('color', val, { shouldValidate: true })}
                  error={String(errors.color?.message || '')}
                />
                <input
                  type="hidden"
                  {...register('color', { required: 'Packet color is required' })}
                />
              </div>

              {/* Existing previews on EDIT */}
              {selectedProduct?.image && (
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-zinc-600">
                    Current Image Preview
                  </p>
                  <img
                    src={selectedProduct.image}
                    alt="Product Image"
                    className="h-40 w-full rounded-xl border border-zinc-200 bg-zinc-50 object-contain"
                  />
                </div>
              )}

              {selectedProduct && (selectedProduct as any).pdfUrl && (
                <div className="mb-2">
                  <p className="mb-1 text-xs font-medium text-zinc-600">
                    Current PDF Preview
                  </p>
                  <PdfPreview
                    src={(selectedProduct as any).pdfUrl}
                    className="h-64 w-full rounded-xl border border-zinc-200 bg-zinc-50"
                    stopClickPropagation
                  />
                </div>
              )}

              {/* New file inputs (optional on edit) */}
              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Upload Product Image
                </label>
                <Input
                  key={`image-${fileKey}`}
                  type="file"
                  accept="image/*"
                  {...register('image', {
                    required: !selectedProduct ? 'Product image is required' : false,
                  })}
                  className="rounded-xl border-zinc-300 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:uppercase file:tracking-wide file:text-white hover:file:bg-black"
                />
                {errors.image && (
                  <p className="mt-1 text-xs text-red-500">
                    {String((errors as any).image?.message)}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">
                  Upload Product PDF
                </label>
                <Input
                  key={`pdf-${fileKey}`}
                  type="file"
                  accept="application/pdf"
                  {...register('pdf', {
                    required: !selectedProduct ? 'Product PDF is required' : false,
                  })}
                  className="rounded-xl border-zinc-300 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:uppercase file:tracking-wide file:text-white hover:file:bg-black"
                />
                {errors.pdf && (
                  <p className="mt-1 text-xs text-red-500">
                    {String((errors as any).pdf?.message)}
                  </p>
                )}
              </div>
            </GlassPanel>
          </div>
        </Dialog>

        {/* Generate PDF flow */}
        <Dialog
          isOpen={isPdfDialogOpen}
          onClose={() => {
            setIsPdfDialogOpen(false)
            setPdfStep(1)
            setPdfStepError(null)
            setSelectedBanner(null)
            setSelectedAdverts([])
            setSelectedPromotions([])
            setSelectedCorporateFront(null)
            setSelectedCorporateBack(null)
          }}
          title={`Step ${pdfStep}: ${pdfStep === 1
            ? 'Select Corporate Info'
            : pdfStep === 2
              ? 'Add Adverts & Promotions'
              : 'Review'
            }`}
        >
          <div className="flex max-h-[85vh] flex-col rounded-2xl bg-gradient-to-b from-white to-zinc-50/80">
            {/* --- STEP PILLS --- */}
            <div className="flex items-center justify-center gap-3 border-b border-white/60 px-4 py-3">
              {[
                { step: 1, label: 'Corporate Info' },
                { step: 2, label: 'Adverts & Promotions' },
                { step: 3, label: 'Review' },
              ].map(({ step, label }) => {
                const active = pdfStep === step
                const done = pdfStep > step

                const pillBase =
                  'flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide'
                const pillState = active
                  ? 'border-zinc-900 bg-white text-zinc-900 shadow-sm'
                  : done
                    ? 'border-zinc-900 bg-white text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-500'

                const circleBase =
                  'flex h-4 w-4 items-center justify-center rounded-full text-[10px]'
                const circleState = active
                  ? 'border border-zinc-900 bg-white text-zinc-900'
                  : done
                    ? 'border border-zinc-900 bg-white text-zinc-900'
                    : 'border border-zinc-300 bg-white text-zinc-600'

                return (
                  <div key={step} className={`${pillBase} ${pillState}`}>
                    <span className={`${circleBase} ${circleState}`}>
                      {done ? '✓' : step}
                    </span>
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3 pr-4">
              {pdfStep === 1 && (
                <GlassPanel className="space-y-6 p-4">
                  {/* CORPORATE INFO (FRONT) */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                        Corporate Info
                      </p>
                      <p className="text-[15px] text-zinc-500">Tap a card to select</p>
                    </div>
                    <SectionTitle>
                      Corporate Info (Front) <span className="text-red-500">*</span>
                    </SectionTitle>

                    <div className="mt-3 max-h-[420px] overflow-y-auto pr-1 p-[5px]">
                      {nonProductLoading && corporateFronts.length === 0 ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm"
                            >
                              <div className="mb-2 h-4 w-2/3 rounded-full bg-zinc-200/70" />
                              <Skeleton className="w-full aspect-square rounded-xl" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {corporateFronts.map((item) => {
                            const isSelected = selectedCorporateFront === item.id
                            return (
                              <PdfChoiceCard
                                key={item.id}
                                item={item}
                                isSelected={isSelected}
                                onClick={() =>
                                  setSelectedCorporateFront((prev) =>
                                    prev === item.id ? null : item.id,
                                  )
                                }
                              />
                            )
                          })}
                          {!nonProductLoading && corporateFronts.length === 0 && (
                            <p className="col-span-full py-4 text-center text-xs text-zinc-500">
                              No corporate info (front) found.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CORPORATE INFO (BACK) */}
                  <div>
                    <SectionTitle>
                      Corporate Info (Back) <span className="text-red-500">*</span>
                    </SectionTitle>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      Pick the closing page for your catalogue.
                    </p>

                    <div className="mt-3 max-h-[420px] overflow-y-auto pr-1 p-[5px]">
                      {nonProductLoading && corporateBacks.length === 0 ? (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-zinc-200/80 bg-white/60 p-3 shadow-sm"
                            >
                              <div className="mb-2 h-4 w-2/3 rounded-full bg-zinc-200/70" />
                              {/* BACK skeletons */}
                              <Skeleton className="w-full aspect-square rounded-xl" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {corporateBacks.map((item) => {
                            const isSelected = selectedCorporateBack === item.id
                            return (
                              <PdfChoiceCard
                                key={item.id}
                                item={item}
                                isSelected={isSelected}
                                onClick={() =>
                                  setSelectedCorporateBack((prev) =>
                                    prev === item.id ? null : item.id,
                                  )
                                }
                              />
                            )
                          })}
                          {!nonProductLoading && corporateBacks.length === 0 && (
                            <p className="col-span-full py-4 text-center text-xs text-zinc-500">
                              No corporate info (back) found.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </GlassPanel>
              )}

              {/* STEP 2 ---------------------------------------------------- */}
              {pdfStep === 2 && (
                <GlassPanel className="space-y-6 p-4">
                  {/* Adverts */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <SectionTitle>Adverts</SectionTitle>
                      <p className="text-xs text-zinc-500">
                        Tap cards to select / unselect
                      </p>
                    </div>

                    <div className="mt-3 max-h-[420px] overflow-y-auto pr-1 p-[5px]">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {advertisements.map((advert) => {
                          const isSelected = selectedAdverts.some((a) => a.id === advert.id)
                          return (
                            <PdfChoiceCard
                              key={advert.id}
                              item={advert}
                              isSelected={isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  removeAdditionalPage('advert', advert.id)
                                } else {
                                  addAdditionalPage('advert', advert.id)
                                }
                                setPdfStepError(null)
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Promotions */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <SectionTitle>Promotions</SectionTitle>
                      <p className="text-xs text-zinc-500">
                        Tap cards to select / unselect
                      </p>
                    </div>

                    <div className="mt-3 max-h-[420px] overflow-y-auto pr-1 p-[5px]">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {promotions.map((promo) => {
                          const isSelected = selectedPromotions.some((p) => p.id === promo.id)
                          return (
                            <PdfChoiceCard
                              key={promo.id}
                              item={promo}
                              isSelected={isSelected}
                              onClick={() => {
                                if (isSelected) {
                                  removeAdditionalPage('promotion', promo.id)
                                } else {
                                  addAdditionalPage('promotion', promo.id)
                                }
                                setPdfStepError(null)
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              )}

              {/* STEP 3 – unchanged */}
              {pdfStep === 3 && (
                <GlassPanel className="space-y-4 p-4">
                  <div className="rounded-xl border border-zinc-200/60 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 p-3 shadow-sm">
                    <h4 className="mb-1 text-sm font-semibold text-zinc-900">
                      Arrange your catalogue flow
                    </h4>
                    <p className="text-xs text-zinc-700">
                      Corporate Info appears first, followed by your selected products.
                      Use the positions below to decide where Adverts and Promotions
                      should appear in between.
                    </p>
                  </div>

                  {selectedAdverts.length > 0 && (
                    <div className="space-y-2">
                      <SectionTitle>Selected Adverts</SectionTitle>
                      <div className="space-y-2 rounded-xl border border-zinc-100 bg-white/80 p-2">
                        {selectedAdverts.map((advert) => (
                          <div
                            key={advert.id}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs text-zinc-800"
                          >
                            <p className="truncate">
                              {advertisements.find((a) => a.id === advert.id)?.title}
                            </p>
                            {renderPositionDropdown('advert', advert)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPromotions.length > 0 && (
                    <div className="space-y-2">
                      <SectionTitle>Selected Promotions</SectionTitle>
                      <div className="space-y-2 rounded-xl border border-zinc-100 bg-white/80 p-2">
                        {selectedPromotions.map((promo) => (
                          <div
                            key={promo.id}
                            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-xs text-zinc-800"
                          >
                            <p className="truncate">
                              {promotions.find((p) => p.id === promo.id)?.title}
                            </p>
                            {renderPositionDropdown('promotion', promo)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Client selection */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <SectionTitle>
                        Select Client <span className="text-red-500">*</span>
                      </SectionTitle>

                      <Button
                        variant="outline"
                        onClick={openClientDialog}
                        className="rounded-lg border-zinc-300 px-3 py-1 text-xs font-medium"
                      >
                        Add Client
                      </Button>
                    </div>

                    {clientsLoading && clients.length === 0 ? (
                      <div className="space-y-2">
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-4 w-1/3 rounded-full" />
                      </div>
                    ) : clients.length > 0 ? (
                      <Select
                        value={selectedClient ?? undefined}
                        onValueChange={(v) =>
                          setSelectedClient(v === 'none' ? undefined : v)
                        }
                      >
                        <SelectTrigger className="w-full rounded-xl border-zinc-300 text-sm">
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>

                        <SelectContent
                          className="z-[9999] max-h-[300px] overflow-y-auto rounded-xl bg-white shadow-lg"
                          sideOffset={4}
                        >
                          <SelectItem value="none">No Client</SelectItem>
                          {clients.map((c) => (
                            <SelectItem key={String(c.id)} value={String(c.id)}>
                              {`${c.firstName} ${c.lastName}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-zinc-600">
                        No clients yet. Click &quot;Add Client&quot; to save one for this
                        PDF.
                      </p>
                    )}
                  </div>
                </GlassPanel>
              )}
            </div>

            <div className="mt-2 flex shrink-0 items-center justify-end gap-3 border-t border-white/60 bg-white/80 px-4 py-3">
              {pdfStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setPdfStep((s) => Math.max(1, s - 1))
                    setPdfStepError(null)
                  }}
                  className="rounded-xl border-zinc-300 px-4 py-2 text-xs font-medium"
                >
                  Back
                </Button>
              )}
              <Button
                variant="black"
                onClick={pdfStep < 3 ? handlePdfNext : handleGeneratePDF}
                disabled={pdfStep === 3 && buttonLoading}
                className="rounded-xl px-4 py-2 text-xs font-semibold tracking-wide"
              >
                {pdfStep < 3 ? 'Next' : buttonLoading ? 'Generating…' : 'Generate PDF'}
              </Button>
            </div>
          </div>
        </Dialog>

        {/* QUICK ADD CLIENT DIALOG, Delete dialog, Share dialog, Cart dialog */}
        <Dialog
          isOpen={isClientDialogOpen}
          onClose={() => setIsClientDialogOpen(false)}
          title="Add Client"
          onSubmit={handleClientSubmit(submitQuickClient)}
          buttonLoading={isClientSubmitting}
        >
          <div className="max-h-[70vh] space-y-4 overflow-visible p-2">
            <GlassPanel className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Controller
                    control={clientControl}
                    name="firstName"
                    render={({ field }) => (
                      <FloatingLabelInput
                        label="First name"
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={clientErrors.firstName?.message as string | undefined}
                      />
                    )}
                  />
                </div>

                <div>
                  <Controller
                    control={clientControl}
                    name="lastName"
                    render={({ field }) => (
                      <FloatingLabelInput
                        label="Last name"
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={clientErrors.lastName?.message as string | undefined}
                      />
                    )}
                  />
                </div>

                <div>
                  <Controller
                    control={clientControl}
                    name="company"
                    render={({ field }) => (
                      <FloatingLabelInput
                        label="Company"
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={clientErrors.company?.message as string | undefined}
                      />
                    )}
                  />
                </div>

                <div>
                  <Controller
                    control={clientControl}
                    name="email"
                    render={({ field }) => (
                      <FloatingLabelInput
                        label="Email"
                        name={field.name}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={clientErrors.email?.message as string | undefined}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Primary Number
                  </label>
                  <Controller
                    control={clientControl}
                    name="primaryNumber"
                    render={({ field }) => (
                      <PhoneInput
                        {...field}
                        defaultCountry="AE"
                        international
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                      />
                    )}
                  />
                  {clientErrors.primaryNumber && (
                    <p className="mt-1 text-xs text-red-500">
                      {String(clientErrors.primaryNumber.message)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-700">
                    Secondary Number
                  </label>
                  <Controller
                    control={clientControl}
                    name="secondaryNumber"
                    render={({ field }) => (
                      <PhoneInput
                        {...field}
                        defaultCountry="AE"
                        international
                        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
                      />
                    )}
                  />
                  {clientErrors.secondaryNumber && (
                    <p className="mt-1 text-xs text-red-500">
                      {String(clientErrors.secondaryNumber.message)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Controller
                  control={clientControl}
                  name="country"
                  render={({ field }) => (
                    <div className="space-y-1">
                      <label className="mb-1 block text-sm font-medium text-zinc-700">
                        Country
                      </label>
                      <Select
                        value={field.value || 'United Arab Emirates'}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="w-full rounded-xl border-zinc-300 text-sm">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent className="z-[9999] max-h-60 overflow-y-auto rounded-xl bg-white shadow-lg">
                          {countryData.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {clientErrors.country && (
                        <p className="mt-1 text-xs text-red-500">
                          {String(clientErrors.country.message)}
                        </p>
                      )}
                    </div>
                  )}
                />
              </div>
            </GlassPanel>
          </div>
        </Dialog>

        {/* Delete dialog */}
        <Dialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title="Confirm Delete"
          onSubmit={handleDeleteProduct}
        >
          <p className="text-sm text-zinc-800">
            Are you sure you want to delete this product?
          </p>
        </Dialog>

        {/* Share dialog */}
        <Dialog
          isOpen={isShareDialogOpen}
          onClose={() => setIsShareDialogOpen(false)}
          title="PDF Generated"
        >
          <div className="space-y-4 p-4">
            <p className="text-sm text-zinc-700">
              Your PDF has been generated successfully.
            </p>
            <div className="flex items-center space-x-2 rounded-xl border border-zinc-200 bg-white/70 p-2">
              <span className="truncate text-xs text-zinc-700">
                {shareableUrl}
              </span>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(shareableUrl)
                  toast.success('Link copied to clipboard!')
                }}
                className="rounded-lg border-zinc-300 px-3 py-1 text-xs font-medium"
              >
                Copy Link
              </Button>
            </div>
          </div>
        </Dialog>

        {/* 🛒 Cart preview dialog - Full Table View */}
        <Dialog
          isOpen={isCartDialogOpen}
          onClose={() => setIsCartDialogOpen(false)}
          title={`Selected Products (${cartItems.length})`}
          maxWidth="full"
        >
          <div className="max-h-[80vh] overflow-auto p-4">
            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-16 w-16 text-zinc-300 mb-4" />
                <p className="text-sm text-zinc-600">No products in cart yet.</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end mb-3">
                  <Button
                    className="rounded-lg px-4 py-2 text-sm"
                    onClick={handleRemoveAll}
                  >
                    <Trash className="h-4 w-4 mr-1" />
                    Remove All
                  </Button>
                </div>
                <div className="w-full overflow-hidden rounded-lg bg-white shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-8 bg-zinc-50">
                        <TableHead className="px-3 py-1 text-xs font-medium">Brand</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Product Name</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Image</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Stick Format</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Tar (mg)</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Nicotine (mg)</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">CO (mg)</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Flavour</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium text-center">FSP</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Pack Format</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Color</TableHead>
                        <TableHead className="px-3 py-1 text-xs font-medium">Capsules</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartItems.map((item) => {
                        const isFsp =
                          item.fsp === true ||
                          item.fsp === 1 ||
                          (typeof item.fsp === 'string' &&
                            ['yes', 'true', '1'].includes(item.fsp.trim().toLowerCase()))

                        return (
                          <TableRow key={item.id} className="h-9 hover:bg-zinc-50/50">
                            {/* Brand */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.brand?.name || '-'}
                            </TableCell>

                            {/* Product Name */}
                            <TableCell className="px-3 py-1 text-xs align-middle font-medium">
                              {item.name}
                            </TableCell>

                            {/* Image */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="h-12 w-12 rounded object-cover"
                                />
                              ) : (
                                <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-[10px] text-gray-700">
                                  No Image
                                </div>
                              )}
                            </TableCell>

                            {/* Stick Format */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.size || '-'}
                            </TableCell>

                            {/* Tar */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.tar || '-'}
                            </TableCell>

                            {/* Nicotine */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.nicotine || '-'}
                            </TableCell>

                            {/* CO */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.co || '-'}
                            </TableCell>

                            {/* Flavour */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.flavor || '-'}
                            </TableCell>

                            {/* FSP */}
                            <TableCell className="px-3 py-1 text-xs align-middle text-center">
                              {isFsp ? 'Yes' : 'No'}
                            </TableCell>

                            {/* Pack Format */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.packetStyle || '-'}
                            </TableCell>

                            {/* Color */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.color || '-'}
                            </TableCell>

                            {/* Capsules */}
                            <TableCell className="px-3 py-1 text-xs align-middle">
                              {item.capsules ?? '-'}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="px-3 py-1 text-xs align-middle text-center">
                              <Button
                                variant="outline"
                                size="small"
                                onClick={() => handleRemoveFromCart(item.id)}
                                className="rounded-lg border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 hover:border-red-300"
                              >
                                <Trash className="h-3.5 w-3.5 mr-1 inline" />
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </Dialog>
      </div>
    </div>
  )
}

export default Products
