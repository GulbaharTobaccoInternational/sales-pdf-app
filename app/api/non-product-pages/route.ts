import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { Buffer } from 'buffer'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const ALLOWED_TYPES = ['banner_front', 'banner_back', 'advertisement', 'promotion'] as const
type AllowedType = (typeof ALLOWED_TYPES)[number]

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
})

// Upload using Buffer and verify sizes
const uploadToS3 = async (file: File, folder: string): Promise<string> => {
    const key = `${folder}/${Date.now()}-${file.name}`

    // 1) Read the full content we received from Next
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 2) Detect truncation on the server side (what Next gave us vs reported file size)
    if (buffer.length !== file.size) {
        console.error('Upload truncated BEFORE S3', {
            fileName: file.name,
            reportedSize: file.size,
            receivedSize: buffer.length,
        })
        throw new Error('File upload truncated on server (before S3)')
    }

    // 3) PutObject to S3
    await s3.send(
        new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: file.type || 'application/pdf',
            // No ACL – bucket uses Object Ownership: Bucket owner enforced
        }),
    )

    // 4) Double-check what S3 actually stored
    const head = await s3.send(
        new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        }),
    )

    const s3Size = head.ContentLength ?? 0
    if (s3Size !== file.size) {
        console.error('Upload truncated INSIDE S3', {
            fileName: file.name,
            reportedSize: file.size,
            s3Size,
        })
        throw new Error('File upload truncated in S3')
    }

    return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
}

/* ---------- GET: list items ---------- */
export async function GET() {
    try {
        const items = await prisma.promotion.findMany({
            orderBy: { createdAt: 'desc' },
        })
        return NextResponse.json(items)
    } catch (e) {
        console.error('GET /api/non-product-pages failed', e)
        return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }
}

/* ---------- POST: create item ---------- */
export async function POST(req: NextRequest) {
    try {
        const form = await req.formData()
        const file = form.get('file') as File | null
        const rawType = (form.get('type') as string | null)?.toLowerCase()
        const title = (form.get('title') as string) || 'Untitled'

        if (!rawType || !ALLOWED_TYPES.includes(rawType as AllowedType)) {
            return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
        }

        if (!file) {
            return NextResponse.json({ error: 'PDF file is required' }, { status: 400 })
        }

        // Log sizes so we see what Next reports
        console.log('Uploading PDF', {
            name: file.name,
            size: file.size,
            type: file.type,
        })

        // 1) Upload to S3 and validate there
        const filePath = await uploadToS3(file, 'promotions')

        // 2) Now create DB row only if upload is good
        const record = await prisma.promotion.create({
            data: {
                type: rawType as AllowedType,
                title,
                filePath,
            },
        })

        return NextResponse.json(record, { status: 201 })
    } catch (e: any) {
        console.error('POST /api/non-product-pages failed', e)
        return NextResponse.json(
            { error: e?.message ?? 'Failed to create' },
            { status: 400 },
        )
    }
}

/* ---------- DELETE: remove item ---------- */
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id')
        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400 })
        }

        await prisma.promotion.delete({ where: { id } })

        return NextResponse.json({ ok: true })
    } catch (e) {
        console.error('DELETE /api/non-product-pages failed', e)
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
    }
}
