// app/non-product-pages/page.tsx
'use client'

import React, { useEffect, useState } from 'react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Trash2, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeading from '@/components/layout/page-heading'
import { useUserRole } from '@/hooks/useUserRole'

type UiType = 'banner_front' | 'banner_back' | 'advertisement' | 'promotion'
type RawType = UiType | 'banner' // legacy "banner" = front

type NonProductPageItem = {
    id: string
    filePath: string | null
    title: string
    type: UiType
    createdAt: string
}

type FilterType = 'all' | UiType

const normalizeType = (t: RawType): UiType => (t === 'banner' ? 'banner_front' : t)

const TYPE_PRIORITY: Record<UiType, number> = {
    banner_front: 1,
    banner_back: 2,
    advertisement: 3,
    promotion: 4,
}

const sortNonProductItems = (list: NonProductPageItem[]): NonProductPageItem[] => {
    return [...list].sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type]
        const pb = TYPE_PRIORITY[b.type]

        if (pa !== pb) return pa - pb

        const da = new Date(a.createdAt).getTime()
        const db = new Date(b.createdAt).getTime()
        return db - da
    })
}

const BACK_HEX = '#8b5cf6'

const borderClassFor = (t: UiType) => {
    switch (t) {
        case 'banner_front':
            return 'border-primary'
        case 'banner_back':
            return 'border-purple-500'
        case 'advertisement':
            return 'border-success'
        case 'promotion':
            return 'border-yellow-500'
    }
}

const dotClassFor = (t: UiType) => {
    switch (t) {
        case 'banner_front':
            return 'bg-primary'
        case 'banner_back':
            return 'bg-purple-500'
        case 'advertisement':
            return 'bg-success'
        case 'promotion':
            return 'bg-yellow-500'
    }
}

const borderStyleFor = (t: UiType): React.CSSProperties | undefined =>
    t === 'banner_back' ? { borderColor: BACK_HEX } : undefined

const dotStyleFor = (t: UiType): React.CSSProperties | undefined =>
    t === 'banner_back' ? { backgroundColor: BACK_HEX } : undefined

const Glass = ({
    children,
    className = '',
}: {
    children: React.ReactNode
    className?: string
}) => (
    <div
        className={[
            'rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl',
            'shadow-[0_6px_24px_rgba(0,0,0,0.08)]',
            className,
        ].join(' ')}
    >
        {children}
    </div>
)

export default function NonProductPages() {
    const role = useUserRole()

    const [items, setItems] = useState<NonProductPageItem[]>([])
    const [filteredItems, setFilteredItems] = useState<NonProductPageItem[]>([])
    const [filter, setFilter] = useState<FilterType>('all')

    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [type, setType] = useState<UiType>('banner_front')

    const [loading, setLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    const fetchItems = async () => {
        setLoading(true)
        try {
            const res = await api.get('/api/non-product-pages')
            const rows: any[] = res.data || []

            const data: NonProductPageItem[] = rows.map((row) => ({
                id: row.id,
                filePath: row.filePath ?? null,
                title: row.title,
                type: normalizeType(row.type as RawType),
                createdAt: row.createdAt,
            }))

            const sorted = sortNonProductItems(data)

            setItems(sorted)
            setFilteredItems(sorted)
        } catch {
            toast.error('Failed to load items')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchItems()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (filter === 'all') {
            setFilteredItems(items)
        } else {
            setFilteredItems(items.filter((i) => i.type === filter))
        }
    }, [filter, items])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) setFile(e.target.files[0])
    }

    const handleSubmit = async () => {
        if (!file) {
            toast.error('Please select a PDF file')
            return
        }
        setIsSubmitting(true)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        formData.append('title', file.name)

        try {
            const res = await api.post('/api/non-product-pages', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            if (res.status === 201) {
                toast.success('Item added successfully')
                setIsDialogOpen(false)
                setFile(null)
                fetchItems()
            } else {
                toast.error('Failed to add item')
            }
        } catch (err) {
            console.error(err)
            toast.error('Error adding item')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setIsDeleting(true)
        try {
            const res = await api.delete(`/api/non-product-pages?id=${deleteId}`)
            if (res.status === 200) {
                toast.success('Item deleted successfully')
                setItems((prev) => prev.filter((i) => i.id !== deleteId))
            } else {
                toast.error('Failed to delete item')
            }
        } catch (err) {
            console.error(err)
            toast.error('Error deleting item')
        } finally {
            setDeleteDialogOpen(false)
            setDeleteId(null)
            setIsDeleting(false)
        }
    }

    return (
        <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 via-white to-zinc-100" />
                <div className="absolute left-1/2 top-[-120px] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.12),rgba(255,255,255,0)_60%)]" />
            </div>

            <div className="space-y-6 p-4">
                <PageHeading heading="Non Product Pages" />

                <Glass className="p-3">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                            <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value as FilterType)}
                                className="rounded-lg border border-white/40 bg-white/70 p-2 focus:border-black focus:ring-1 focus:ring-black"
                            >
                                <option value="all">All</option>
                                <option value="banner_front">Corporate Infos (Front)</option>
                                <option value="banner_back">Corporate Infos (Back)</option>
                                <option value="advertisement">Adverts</option>
                                <option value="promotion">Promotions</option>
                            </select>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
                                <span className="flex items-center gap-2">
                                    <span className={`h-3 w-3 rounded-full ${dotClassFor('banner_front')}`} />
                                    Corporate Info (Front)
                                </span>
                                <span className="flex items-center gap-2">
                                    <span
                                        className={`h-3 w-3 rounded-full ${dotClassFor('banner_back')}`}
                                        style={dotStyleFor('banner_back')}
                                    />
                                    Corporate Info (Back)
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className={`h-3 w-3 rounded-full ${dotClassFor('advertisement')}`} />
                                    Advert
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className={`h-3 w-3 rounded-full ${dotClassFor('promotion')}`} />
                                    Promotion
                                </span>
                            </div>

                            <Button variant="outline" onClick={fetchItems}>
                                <RefreshCw size={18} className="mr-1" /> Refresh
                            </Button>
                        </div>

                        {role === 'ADMIN' && (
                            <Button variant="black" onClick={() => setIsDialogOpen(true)}>
                                Add Item
                            </Button>
                        )}
                    </div>
                </Glass>

                {loading ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Glass key={i} className="p-2">
                                <div className="relative">
                                    <Skeleton className="h-48 w-full rounded-xl" />
                                    <div className="mt-3 space-y-2 p-1">
                                        <Skeleton className="mx-auto h-5 w-3/4" />
                                    </div>
                                </div>
                            </Glass>
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <Glass className="p-8">
                        <div className="flex flex-col items-center justify-center py-10">
                            <p className="text-lg text-zinc-500">No items found</p>
                        </div>
                    </Glass>
                ) : (
                    <div className="mx-auto grid max-w-6xl grid-cols-1 justify-center gap-4 px-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {filteredItems.map((item) => {
                            const t = item.type
                            const hasFile = !!item.filePath

                            return (
                                <Glass key={item.id} className="overflow-hidden">
                                    <div
                                        className={[
                                            'relative aspect-square w-full max-w-[260px] overflow-hidden rounded-2xl border-4 bg-white/60',
                                            'shadow-[0_8px_24px_rgba(0,0,0,0.06)]',
                                            'transition hover:scale-[1.01]',
                                            borderClassFor(t),
                                        ].join(' ')}
                                        style={borderStyleFor(t)}
                                    >
                                        {hasFile ? (
                                            <embed
                                                src={`${item.filePath}#zoom=Fit`}
                                                type="application/pdf"
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-100 px-4 text-center text-xs text-zinc-500">
                                                <span>PDF upload in progress or missing.</span>
                                                <span className="mt-1 text-[10px]">
                                                    Please refresh or re-upload if this persists.
                                                </span>
                                            </div>
                                        )}

                                        <div className="absolute bottom-0 w-full truncate bg-white/90 px-2 py-1.5 text-center text-[13px] font-medium text-zinc-900">
                                            {item.title.split('.').slice(0, -1).join('.') || item.title}
                                        </div>

                                        {role === 'ADMIN' && (
                                            <button
                                                className="absolute right-2 top-2 rounded-full border border-white/30 bg-white/70 p-2 text-red-600 hover:bg-red-100"
                                                onClick={() => {
                                                    setDeleteId(item.id)
                                                    setDeleteDialogOpen(true)
                                                }}
                                                aria-label="Delete item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}

                                        <span
                                            className={[
                                                'absolute left-2 top-2 h-2.5 w-2.5 rounded-full',
                                                dotClassFor(t),
                                            ].join(' ')}
                                            style={dotStyleFor(t)}
                                        />
                                    </div>
                                </Glass>
                            )
                        })}
                    </div>
                )}

                <Dialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} title="Add Item">
                    <div className="space-y-4 p-1">
                        <Glass className="space-y-4 p-4">
                            <Input type="file" accept="application/pdf" onChange={handleFileChange} />

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                                <label className="flex items-center gap-2 text-zinc-800">
                                    <input
                                        type="radio"
                                        name="type"
                                        value="banner_front"
                                        checked={type === 'banner_front'}
                                        onChange={() => setType('banner_front')}
                                    />
                                    Corporate Info (Front)
                                </label>

                                <label className="flex items-center gap-2 text-zinc-800">
                                    <input
                                        type="radio"
                                        name="type"
                                        value="banner_back"
                                        checked={type === 'banner_back'}
                                        onChange={() => setType('banner_back')}
                                    />
                                    Corporate Info (Back)
                                </label>

                                <label className="flex items-center gap-2 text-zinc-800">
                                    <input
                                        type="radio"
                                        name="type"
                                        value="advertisement"
                                        checked={type === 'advertisement'}
                                        onChange={() => setType('advertisement')}
                                    />
                                    Advert
                                </label>

                                <label className="flex items-center gap-2 text-zinc-800">
                                    <input
                                        type="radio"
                                        name="type"
                                        value="promotion"
                                        checked={type === 'promotion'}
                                        onChange={() => setType('promotion')}
                                    />
                                    Promotion
                                </label>
                            </div>

                            <div className="flex justify-end">
                                <Button type="button" variant="black" disabled={isSubmitting} onClick={handleSubmit}>
                                    {isSubmitting ? 'Submitting...' : 'Submit'}
                                </Button>
                            </div>
                        </Glass>
                    </div>
                </Dialog>

                <Dialog
                    isOpen={deleteDialogOpen}
                    onClose={() => setDeleteDialogOpen(false)}
                    title="Confirm Deletion"
                >
                    <div className="space-y-4 p-2">
                        <p className="text-zinc-800">Are you sure you want to delete this item?</p>
                        <div className="mt-6 flex justify-end gap-4">
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="black" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </div>
        </div>
    )
}
