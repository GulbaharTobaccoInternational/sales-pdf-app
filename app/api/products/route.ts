import { NextRequest, NextResponse } from 'next/server'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { Readable } from 'stream'
import { prisma } from '@/lib/prisma'
import { rankProductsForSearch } from '@/lib/product-search'

// AWS S3 Configuration
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    // no accelerate endpoint – using standard regional endpoint
    // endpoint: 'https://s3-accelerate.amazonaws.com',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!

const productListSelect = {
    id: true,
    name: true,
    size: true,
    tar: true,
    nicotine: true,
    co: true,
    flavor: true,
    packetStyle: true,
    fsp: true,
    capsules: true,
    color: true,
    brandId: true,
    brand: {
        select: {
            id: true,
            name: true,
        },
    },
    createdAt: true,
    updatedAt: true,
} as const

function readableStreamToNodeStream(stream: ReadableStream) {
    const reader = stream.getReader()
    return new Readable({
        async read() {
            const { done, value } = await reader.read()
            if (done) this.push(null)
            else this.push(value)
        },
    })
}

// multipart upload helper
const uploadToS3 = async (file: File, folder: string): Promise<string> => {
    const key = `${folder}/${Date.now()}-${file.name}`
    const nodeStream = readableStreamToNodeStream(file.stream())
    const upload = new Upload({
        client: s3,
        params: {
            Bucket: BUCKET_NAME,
            Key: key,
            Body: nodeStream,
            ContentType: file.type,
            // ❌ ACL removed – bucket has Object Ownership: Bucket owner enforced
            // ACL: 'public-read',
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
    })
    await upload.done()
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
}

// **GET Products (Fetch All – light, no image/pdfUrl)**
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url)
        const sp = url.searchParams

        const where: any = {}
        const and: any[] = []

        const contains = (paramKey: string, fieldKey: string) => {
            const v = sp.get(paramKey)
            if (v && v.trim()) {
                where[fieldKey] = { contains: v.trim(), mode: 'insensitive' }
            }
        }

        contains('size', 'size')
        contains('packetStyle', 'packetStyle')
        contains('color', 'color')

        const brandId = sp.get('brandId')
        if (brandId) where.brandId = brandId

        const fsp = sp.get('fsp')
        if (fsp === 'true') where.fsp = true
        else if (fsp === 'false') where.fsp = false

        const capsulesMode = sp.get('capsulesMode')
        const capsules = sp.get('capsules')
        if (capsulesMode === 'gt0') {
            where.capsules = { gt: 0 }
        } else if (capsules !== null) {
            const n = Number.parseInt(capsules, 10)
            if (!Number.isNaN(n)) where.capsules = n
        }

        const tar = sp.get('tar')
        if (tar) where.tar = parseFloat(tar)

        const nicotine = sp.get('nicotine')
        if (nicotine) where.nicotine = parseFloat(nicotine)

        const co = sp.get('co')
        if (co) where.co = parseFloat(co)

        const flavorMode = sp.get('flavorMode')
        const flavor = sp.get('flavor')

        if (flavorMode === 'allFlavoursExceptRegular') {
            and.push({ NOT: { flavor: { equals: 'Regular', mode: 'insensitive' } } })
            and.push({ flavor: { not: '' } })
        } else if (flavorMode === 'onlyRegular') {
            where.flavor = { equals: 'Regular', mode: 'insensitive' }
        } else if (flavor) {
            where.flavor = { equals: flavor, mode: 'insensitive' }
        }

        if (and.length) where.AND = and

        const page = Number.parseInt(sp.get('page') || '1', 10)
        const pageSize = Number.parseInt(sp.get('pageSize') || '10', 10)
        const skip = (page - 1) * pageSize
        const take = pageSize
        const searchQuery = (sp.get('name') || sp.get('q') || sp.get('search') || '').trim()

        if (searchQuery) {
            const products = await prisma.product.findMany({
                where,
                select: productListSelect,
                orderBy: { updatedAt: 'desc' },
            })

            const rankedProducts = rankProductsForSearch(products, searchQuery)

            return NextResponse.json({
                products: rankedProducts.slice(skip, skip + take),
                total: rankedProducts.length,
            })
        }

        // run count + data query in parallel
        const [total, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                select: productListSelect,
                skip,
                take,
                orderBy: { updatedAt: 'desc' },
            }),
        ])

        return NextResponse.json({ products, total })
    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}

// **POST Product (Create a New Product with S3 Uploads)**
export async function POST(req: Request) {
    const formData = await req.formData()
    const pdfFile = formData.get('pdf') as File | null
    const imageFile = formData.get('image') as File | null
    const productData: Record<string, string> = {}

    formData.forEach((value, key) => {
        if (typeof value === 'string') productData[key] = value
    })

    const {
        brandId,
        name,
        size,
        tar,
        nicotine,
        co,
        flavor,
        packetStyle,
        fsp,
        capsules,
        color,
    } = productData

    const missing = [
        ['brandId', brandId],
        ['name', name],
        ['size', size],
        ['tar', tar],
        ['nicotine', nicotine],
        ['flavor', flavor],
        ['packetStyle', packetStyle],
        ['fsp', fsp],
        ['capsules', capsules],
        ['color', color],
    ].filter(([, v]) => !v || String(v).trim() === '')

    if (missing.length) {
        return NextResponse.json(
            { error: `Missing fields: ${missing.map(([k]) => k).join(', ')}` },
            { status: 400 },
        )
    }
    if (!imageFile || imageFile.size === 0) {
        return NextResponse.json({ error: 'Product image is required' }, { status: 400 })
    }
    if (!pdfFile || pdfFile.size === 0 || pdfFile.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Valid PDF is required' }, { status: 400 })
    }

    try {
        const parsedTar = parseFloat(tar || '0')
        const parsedNicotine = parseFloat(nicotine || '0')
        const parsedCo = parseFloat(co || '0')
        const parsedFsp = fsp === 'true'
        const parsedCapsules = parseInt(capsules || '0')

        // Upload files to S3 inside the request lifecycle
        const [imageUrl, pdfUrl] = await Promise.all([
            uploadToS3(imageFile as File, 'products'),
            uploadToS3(pdfFile as File, 'pdfs'),
        ])

        // Create product with final URLs
        const product = await prisma.product.create({
            data: {
                name,
                size,
                tar: parsedTar,
                nicotine: parsedNicotine,
                co: parsedCo,
                flavor,
                packetStyle,
                fsp: parsedFsp,
                capsules: parsedCapsules,
                color,
                image: imageUrl,
                pdfUrl,
                brand: { connect: { id: brandId } },
            },
        })

        return NextResponse.json(product, { status: 201 })
    } catch (error) {
        console.error('Error creating product:', error)
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
    }
}

// **DELETE Product (Remove Product & Delete from S3)**
export async function DELETE(req: Request) {
    const { id } = Object.fromEntries(new URL(req.url).searchParams)

    try {
        const product = await prisma.product.findUnique({
            where: { id },
        })

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        if (product.image) {
            const imageKey = product.image.split('.com/')[1]
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: imageKey,
                }),
            )
        }

        if (product.pdfUrl) {
            const pdfKey = product.pdfUrl.split('.com/')[1]
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: pdfKey,
                }),
            )
        }

        await prisma.product.delete({ where: { id } })

        return NextResponse.json({ message: 'Product deleted' }, { status: 200 })
    } catch (error) {
        console.error('Error deleting product:', error)
        return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }
}
