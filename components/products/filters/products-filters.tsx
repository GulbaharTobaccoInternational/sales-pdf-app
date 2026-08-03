'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { X, Filter, RefreshCw, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FloatingLabelInput } from '@/components/ui/floating-label-input'
import { useRouter, usePathname } from 'next/navigation'

interface FilterProps {
  filters: Record<string, string>
  onFilterChange: (filters: Record<string, string>) => void
  onRefresh: () => void
  onClearSelection?: () => void
  initialFilters?: Record<string, string>
   refreshKey?: number
}

interface IBrand {
  id: string
  name: string
}

const ALL = 'all'
const PLACEHOLDER = '__PLACEHOLDER__'
const UI_ALL_FLAVOURS = '__ALL_FLAVOURS__'
const UI_ALL_CAPS = '__ALL_CAPS__'

function applySelectUI(
  key: string,
  value: string,
  filters: Record<string, string>,
  setFilters: (f: Record<string, string>) => void,
  onFilterChange: (f: Record<string, string>) => void,
  uiSelections: Record<string, string>,
  setUiSelections: (f: Record<string, string>) => void,
) {
  const nextUi = { ...uiSelections, [key]: value }
  setUiSelections(nextUi)

  if (value === ALL) {
    const { [key]: _omit, ...rest } = filters
    setFilters(rest)
    onFilterChange(rest)
  } else {
    const next = { ...filters, [key]: value }
    setFilters(next)
    onFilterChange(next)
  }
}

export default function ProductsFilters({
  filters,
  onFilterChange,
  onRefresh,
  onClearSelection,
  initialFilters = {},
  refreshKey = 0,
}: FilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [uiSelections, setUiSelections] = useState<Record<string, string>>({})
  const [brands, setBrands] = useState<IBrand[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [flavors, setFlavors] = useState<string[]>([])
  const [packFormats, setPackFormats] = useState<string[]>([])
  const [carbonMonoxides, setCarbonMonoxides] = useState<string[]>([])
  const [colors, setColors] = useState<string[]>([])
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false)
  const [showAllFilters, setShowAllFilters] = useState(false)
  const [isLoadingBrands, setIsLoadingBrands] = useState(true)
  const [isLoadingSizes, setIsLoadingSizes] = useState(true)
  const [isLoadingFlavors, setIsLoadingFlavors] = useState(true)
  const [isLoadingPackFormats, setIsLoadingPackFormats] = useState(true)
  const [isLoadingCarbonMonoxides, setIsLoadingCarbonMonoxides] = useState(true)
  const [isLoadingColors, setIsLoadingColors] = useState(true)

  // local copy just to satisfy TS and keep UI in sync
  const [filterState, setFilters] = useState<Record<string, string>>(filters)

  // local state for the keyword search input
  const [nameInput, setNameInput] = useState<string>(filters.name ?? '')

  const tarOptions = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const nicotineOptions = Array.from({ length: 12 }, (_, i) =>
    ((i + 1) / 10).toFixed(1),
  )

  // helper so all selects fully reset when filters/uiSelections are cleared
  const getSelectValue = (key: string) => uiSelections[key] ?? filterState[key] ?? ''

  useEffect(() => {
    // whenever parent filters change (via onFilterChange), keep local copy in sync
    setFilters(filters)
    // keep name input in sync with parent filter (clear filters, initial filters, etc.)
    setNameInput(filters.name ?? '')
  }, [filters])

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await api.get('/api/brands')
        setBrands(
          response.data.sort((a: IBrand, b: IBrand) =>
            a.name.localeCompare(b.name),
          ),
        )
      } catch (error) {
        console.error('Failed to fetch brands:', error)
      } finally {
        setIsLoadingBrands(false)
      }
    }

    const fetchFilterOptions = async () => {
      try {
        const response = await api.get('/api/products/filters')
        const {
          sizes: sizeOptions = [],
          flavors: flavorOptions = [],
          colors: colorOptions = [],
          packFormats: packFormatOptions = [],
          carbonMonoxides: coOptions = [],
        } = response.data || {}

        setSizes(sizeOptions ?? [])
        setFlavors(flavorOptions ?? [])
        setColors(colorOptions ?? [])
        setPackFormats(packFormatOptions ?? [])
        setCarbonMonoxides((coOptions ?? []).map((v: number | string) => String(v)))
      } catch (error) {
        console.error('Failed to fetch filter options:', error)
      } finally {
        setIsLoadingSizes(false)
        setIsLoadingFlavors(false)
        setIsLoadingPackFormats(false)
        setIsLoadingCarbonMonoxides(false)
        setIsLoadingColors(false)
      }
    }

    fetchBrands()
    fetchFilterOptions()
  }, [refreshKey])

  // Ensure initial brandId (from URL/parent) is applied only once.
  const [hasAppliedInitialBrand, setHasAppliedInitialBrand] = useState(false)
  useEffect(() => {
    if (brands.length > 0 && initialFilters.brandId && !hasAppliedInitialBrand) {
      setFilters(initialFilters)
      setUiSelections((prev) => ({
        ...prev,
        brandId: initialFilters.brandId!,
      }))
      onFilterChange(initialFilters)
      setHasAppliedInitialBrand(true)
    } else if (brands.length > 0 && filters.brandId) {
      setUiSelections((prev) => ({ ...prev, brandId: filters.brandId }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, filters.brandId, initialFilters.brandId, hasAppliedInitialBrand])

  const handleChangeText = (key: string, value: string) => {
    if (key === 'name') {
      setNameInput(value)
    }
  }

  const getFiltersWithKeyword = (baseFilters: Record<string, string>) => {
    const trimmed = nameInput.trim()
    const updated = { ...baseFilters }

    if (!trimmed) {
      delete updated.name
    } else {
      updated.name = trimmed
    }

    return updated
  }

  // Fire the keyword search only when button is clicked / Enter pressed.
  const applyNameSearch = () => {
    const updated = getFiltersWithKeyword(filters)

    setFilters(updated)
    onFilterChange(updated)
  }

  const clearFilters = () => {
    // prevent the "apply initial brand" effect from re-triggering after clear
    setHasAppliedInitialBrand(true)

    // wipe filters + UI selections (including the Brand dropdown)
    setFilters({})
    setUiSelections({})
    setNameInput('')

    onFilterChange({})
    onClearSelection?.()

    // Clear URL query parameters
    router.push(pathname)
  }

  // Convenience wrapper for standard selects
  const onSelect =
    (key: string) =>
      (v: string) =>
        applySelectUI(
          key,
          v,
          filters,
          setFilters,
          onFilterChange,
          uiSelections,
          setUiSelections,
        )

  // --- SPECIAL: Flavour select (supports placeholder reset + modes) ---
  const onSelectFlavor = (v: string) => {
    if (v === PLACEHOLDER) {
      // reset only flavour fields and close menu
      const { flavor: _f, flavorMode: _fm, ...rest } = filters
      setFilters(rest)
      onFilterChange(rest)
      const { flavor: _uf, ...uiRest } = uiSelections
      setUiSelections(uiRest)
      return
    }

    // clear flavour fields first
    const { flavor: _f, flavorMode: _fm, ...rest } = filters

    if (v === UI_ALL_FLAVOURS) {
      // all flavours except Regular
      const next = { ...rest, flavorMode: 'allFlavoursExceptRegular' }
      setFilters(next)
      onFilterChange(next)
      setUiSelections((u) => ({ ...u, flavor: UI_ALL_FLAVOURS }))
      return
    }

    if (v === 'Regular') {
      // only Regular
      const next = { ...rest, flavor: 'Regular', flavorMode: 'onlyRegular' }
      setFilters(next)
      onFilterChange(next)
      setUiSelections((u) => ({ ...u, flavor: 'Regular' }))
      return
    }

    // exact flavour match
    const next = { ...rest, flavor: v }
    setFilters(next)
    onFilterChange(next)
    setUiSelections((u) => ({ ...u, flavor: v }))
  }

  // --- SPECIAL: Capsules select (supports placeholder reset + modes) ---
  const onSelectCapsules = (v: string) => {
    if (v === PLACEHOLDER) {
      // reset only capsules fields and close menu
      const { capsules: _c, capsulesMode: _cm, ...rest } = filters
      setFilters(rest)
      onFilterChange(rest)
      const { capsules: _uc, ...uiRest } = uiSelections
      setUiSelections(uiRest)
      return
    }

    // clear capsules fields first
    const { capsules: _c, capsulesMode: _cm, ...rest } = filters

    if (v === UI_ALL_CAPS) {
      // > 0 capsules
      const next = { ...rest, capsulesMode: 'gt0' }
      setFilters(next)
      onFilterChange(next)
      setUiSelections((u) => ({ ...u, capsules: UI_ALL_CAPS }))
      return
    }

    // exact integer value (0/1/2/3…)
    const next = { ...rest, capsules: v }
    setFilters(next)
    onFilterChange(next)
    setUiSelections((u) => ({ ...u, capsules: v }))
  }

  const Label = ({ children }: { children: string }) => (
    <div className="mb-1 text-xs font-medium text-gray-500">{children}</div>
  )

  return (
    <>
      {/* Desktop Filters */}
      <div className="hidden grid-cols-2 gap-4 md:grid md:grid-cols-4 lg:grid-cols-6">
        {/* Always visible: Search by name (text + button) */}
        <div className="col-span-2 flex items-center gap-2">
          <div className="relative flex-1">
            <FloatingLabelInput
              label="Search products"
              name="searchByName"
              value={nameInput}
              onChange={(value) => handleChangeText('name', value)}
              iconLeft={<Search className="h-4 w-4" />}
              onKeyDown={(event: any) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyNameSearch()
                }
              }}
            />
          </div>
          <Button
            variant="black"
            className="flex h-11 items-center gap-1 rounded-xl px-4"
            onClick={applyNameSearch}
          >
            <Search className="h-4 w-4" />
            <span>Search</span>
          </Button>
        </div>

        {/* Brand */}
        <div className="space-y-1">
          <Label>Brand</Label>
          <Select
            value={getSelectValue('brandId')}
            onValueChange={onSelect('brandId')}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingBrands ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Select Brand'
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size */}
        <div className="space-y-1">
          <Label>Stick Format</Label>
          <Select value={getSelectValue('size')} onValueChange={onSelect('size')}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingSizes ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Select Stick Format'
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {sizes.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Flavour */}
        <div className="space-y-1">
          <Label>Flavour</Label>
          <Select value={getSelectValue('flavor')} onValueChange={onSelectFlavor}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingFlavors ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Select Flavour'
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PLACEHOLDER}>Select Flavour</SelectItem>
              <SelectItem value={UI_ALL_FLAVOURS}>All Flavours</SelectItem>
              <SelectItem value="Regular">Regular</SelectItem>
              {flavors
                .filter((f) => f !== 'Regular')
                .map((flavor) => (
                  <SelectItem key={flavor} value={flavor}>
                    {flavor}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Pack Format */}
        <div className="space-y-1">
          <Label>Pack Format</Label>
          <Select
            value={getSelectValue('packetStyle')}
            onValueChange={onSelect('packetStyle')}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingPackFormats ? (
                    <span className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                    </span>
                  ) : (
                    'Select Pack Format'
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {packFormats.map((packFormat) => (
                <SelectItem key={packFormat} value={packFormat}>
                  {packFormat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Extra filters */}
        {showAllFilters && (
          <>
            {/* FSP */}
            <div className="space-y-1">
              <Label>FSP</Label>
              <Select value={getSelectValue('fsp')} onValueChange={onSelect('fsp')}>
                <SelectTrigger>
                  <SelectValue placeholder="FSP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Capsules */}
            <div className="space-y-1">
              <Label>Number of Capsules</Label>
              <Select
                value={getSelectValue('capsules')}
                onValueChange={onSelectCapsules}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Number of Capsules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PLACEHOLDER}>Number of Capsules</SelectItem>
                  <SelectItem value={UI_ALL_CAPS}>All Capsules</SelectItem>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tar */}
            <div className="space-y-1">
              <Label>Tar (mg)</Label>
              <Select value={getSelectValue('tar')} onValueChange={onSelect('tar')}>
                <SelectTrigger>
                  <SelectValue placeholder="Tar (mg)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {tarOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nicotine */}
            <div className="space-y-1">
              <Label>Nicotine (mg)</Label>
              <Select
                value={getSelectValue('nicotine')}
                onValueChange={onSelect('nicotine')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nicotine (mg)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {nicotineOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CO */}
            <div className="space-y-1">
              <Label>Carbon Monoxide (mg)</Label>
              <Select value={getSelectValue('co')} onValueChange={onSelect('co')}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingCarbonMonoxides ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                        </span>
                      ) : (
                        'Select Carbon Monoxide (mg)'
                      )
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {carbonMonoxides.map((co) => {
                    const coStr = String(co)
                    return (
                      <SelectItem key={coStr} value={coStr}>
                        {coStr}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label>Color of Packet</Label>
              <Select
                value={getSelectValue('color')}
                onValueChange={onSelect('color')}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingColors ? (
                        <span className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                        </span>
                      ) : (
                        'Select Color of Packet'
                      )
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All</SelectItem>
                  {colors.map((color) => (
                    <SelectItem key={color} value={color}>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="col-span-full flex gap-2">
          <Button
            variant="outline"
            size="small"
            onClick={() => setShowAllFilters(!showAllFilters)}
          >
            {showAllFilters ? 'Hide Filters' : 'View All Filters'}
          </Button>

          <Button variant="outline" size="small" onClick={onRefresh}>
            <RefreshCw size={18} /> Refresh
          </Button>

          <Button variant="outline" size="small" onClick={clearFilters}>
            <X size={18} /> Clear filters
          </Button>
        </div>
      </div>

      {/* Mobile Filters Button & Clear */}
      <div className="flex justify-end gap-2 md:hidden">
        <Button variant="outline" onClick={() => setIsMobileFilterOpen(true)}>
          <Filter size={20} /> Filters
        </Button>
        <Button variant="outline" size="small" onClick={clearFilters}>
          <X size={18} /> Clear filters
        </Button>
      </div>

      {/* Mobile Filters Modal */}
      <Dialog
        isOpen={isMobileFilterOpen}
        onClose={() => setIsMobileFilterOpen(false)}
        title="Filters"
      >
        <div className="space-y-4 p-4">
          {/* Product keyword */}
          <div className="space-y-1">
            <Label>Search Products</Label>
            <div className="relative">
              <FloatingLabelInput
                label="Search products"
                name="mobileSearchByName"
                value={nameInput}
                onChange={(value) => handleChangeText('name', value)}
                iconLeft={<Search className="h-4 w-4" />}
                onKeyDown={(event: any) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyNameSearch()
                    setIsMobileFilterOpen(false)
                  }
                }}
              />
            </div>
          </div>

          {/* Brand */}
          <div className="space-y-1">
            <Label>Brand</Label>
            <Select
              value={getSelectValue('brandId')}
              onValueChange={onSelect('brandId')}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingBrands ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'Select Brand'
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size */}
          <div className="space-y-1">
            <Label>Stick Format</Label>
            <Select value={getSelectValue('size')} onValueChange={onSelect('size')}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingSizes ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'Select Stick Format'
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {sizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Flavour (same behavior as desktop) */}
          <div className="space-y-1">
            <Label>Flavour</Label>
            <Select value={getSelectValue('flavor')} onValueChange={onSelectFlavor}>
              <SelectTrigger>
                <SelectValue placeholder="Select Flavour" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PLACEHOLDER}>Select Flavour</SelectItem>
                <SelectItem value={UI_ALL_FLAVOURS}>All Flavours</SelectItem>
                <SelectItem value="Regular">Regular</SelectItem>
                {flavors
                  .filter((f) => f !== 'Regular')
                  .map((flavor) => (
                    <SelectItem key={flavor} value={flavor}>
                      {flavor}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pack Format */}
          <div className="space-y-1">
            <Label>Pack Format</Label>
            <Select
              value={getSelectValue('packetStyle')}
              onValueChange={onSelect('packetStyle')}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingPackFormats ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'Select Pack Format'
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {packFormats.map((packFormat) => (
                  <SelectItem key={packFormat} value={packFormat}>
                    {packFormat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FSP */}
          <div className="space-y-1">
            <Label>FSP</Label>
            <Select value={getSelectValue('fsp')} onValueChange={onSelect('fsp')}>
              <SelectTrigger>
                <SelectValue placeholder="FSP" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Capsules (same behavior as desktop) */}
          <div className="space-y-1">
            <Label>Number of Capsules</Label>
            <Select
              value={getSelectValue('capsules')}
              onValueChange={onSelectCapsules}
            >
              <SelectTrigger>
                <SelectValue placeholder="Number of Capsules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PLACEHOLDER}>Number of Capsules</SelectItem>
                <SelectItem value={UI_ALL_CAPS}>All Capsules</SelectItem>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tar */}
          <div className="space-y-1">
            <Label>Tar (mg)</Label>
            <Select value={getSelectValue('tar')} onValueChange={onSelect('tar')}>
              <SelectTrigger>
                <SelectValue placeholder="Tar (mg)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {tarOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nicotine */}
          <div className="space-y-1">
            <Label>Nicotine (mg)</Label>
            <Select
              value={getSelectValue('nicotine')}
              onValueChange={onSelect('nicotine')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nicotine (mg)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {nicotineOptions.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CO (mg) — MOBILE */}
          <div className="space-y-1">
            <Label>Carbon Monoxide (mg)</Label>
            <Select value={getSelectValue('co')} onValueChange={onSelect('co')}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingCarbonMonoxides ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'Select Carbon Monoxide (mg)'
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {carbonMonoxides.map((co) => {
                  const coStr = String(co)
                  return (
                    <SelectItem key={coStr} value={coStr}>
                      {coStr}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label>Color of Packet</Label>
            <Select value={getSelectValue('color')} onValueChange={onSelect('color')}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingColors ? (
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'Select Color of Packet'
                    )
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                {colors.map((color) => (
                  <SelectItem key={color} value={color}>
                    {color}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="black"
              onClick={() => {
                const updated = getFiltersWithKeyword(filterState)
                setFilters(updated)
                onFilterChange(updated)
                setIsMobileFilterOpen(false)
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
