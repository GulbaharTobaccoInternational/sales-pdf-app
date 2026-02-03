import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'
import sendEmail from '@/app/api/auth/sendEmail'
import { buildSharePath, buildShareUrl } from '@/lib/shareUrl'

type SharedPdfRow = {
    id: string
    uniqueSlug: string
    productIds: string
    createdAt: Date
    expiresAt: Date
    createdById: string
    clientId: string | null
    proposalNumber: number | null
    client?: {
        id: string
        firstName: string
        lastName: string
        email: string | null
    } | null
}

const BASE_PROPOSAL_NUMBER = 25001

// 👇 emails that can see ALL PDFs + should always be copied on notifications
const SUPER_VIEWER_EMAILS = [
    'admin@gulbahartobacco.com',
    'vinu@gulbahartobacco.com',
]

// ✅ Middleware to Extract User ID (Example - Adjust for Auth System)
async function getUserIdFromToken(req: Request): Promise<string | null> {
    try {
        const token = cookies().get('token')?.value
        if (!token) {
            console.error('🚨 No token found in cookies.')
            return null
        }

        const secret = new TextEncoder().encode(process.env.JWT_SECRET)
        const { payload } = await jwtVerify(token, secret)

        if (!payload || typeof payload !== 'object') {
            console.error('🚨 Invalid JWT payload format:', payload)
            return null
        }

        const userId = (payload as any).userId || (payload as any).id || (payload as any).sub

        if (!userId) {
            console.error('🚨 No userId found in payload:', payload)
            return null
        }

        return userId as string
    } catch (error) {
        console.error('🚨 Error verifying token:', error)
        return null
    }
}

// ✅ GET Method: Fetch PDFs (now restricted by user where needed)
export async function GET(req: Request) {
    try {
        const url = new URL(req.url)

        // ---------- AUTH + VISIBILITY ----------
        const userId = await getUserIdFromToken(req)
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // fetch email so we can check if they are in the "see all" list
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        })

        if (!currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const isSuperViewer =
            !!currentUser.email && SUPER_VIEWER_EMAILS.includes(currentUser.email)

        // Filters
        const dateStr = url.searchParams.get('date') // yyyy-MM-dd
        const clientId = url.searchParams.get('clientId') || undefined
        const productId = url.searchParams.get('productId') || undefined
        const productName = url.searchParams.get('product') || undefined // free-text product name

        // Base where (can be extended safely)
        const where: any = {}

        // 🔒 Visibility filter:
        //  - super-viewers: see all PDFs
        //  - others: only PDFs they created
        if (!isSuperViewer) {
            where.createdById = currentUser.id
        }

        if (clientId) where.clientId = clientId
        if (dateStr) {
            const d = new Date(dateStr)
            where.createdAt = { gte: startOfDay(d), lte: endOfDay(d) }
        }

        // Pull PDFs (without products first)
        const rows: SharedPdfRow[] = await prisma.sharedPDF.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                client: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
            },
        })

        if (!rows.length) return NextResponse.json([])

        // Parse all product ids used across these PDFs and fetch them once
        const allIds = new Set<string>()
        const parsedIdsByPdf = new Map<string, string[]>()

        for (const r of rows) {
            const ids = r.productIds
                ? r.productIds
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                : []
            parsedIdsByPdf.set(r.id, ids)
            ids.forEach((id) => allIds.add(id))
        }

        const allProducts = await prisma.product.findMany({
            where: { id: { in: Array.from(allIds) } },
            select: { id: true, name: true, pdfUrl: true },
        })
        const productMap = new Map(allProducts.map((p) => [p.id, p]))

        // Optional product filtering
        const matchesProduct = (ids: string[]) => {
            if (productId) return ids.includes(productId)

            if (productName && productName.trim()) {
                const q = productName.trim().toLowerCase()
                return ids.some((id) => {
                    const p = productMap.get(id)
                    return p ? p.name.toLowerCase().includes(q) : false
                })
            }

            return true
        }

        // Build final response with products attached and product filter applied
        const result = rows
            .filter((r) => matchesProduct(parsedIdsByPdf.get(r.id) ?? []))
            .map((r) => {
                const ids = parsedIdsByPdf.get(r.id) ?? []
                return {
                    id: r.id,
                    uniqueSlug: r.uniqueSlug,
                    createdAt: r.createdAt,
                    expiresAt: r.expiresAt,
                    client: r.client ?? null,
                    proposalNumber: r.proposalNumber,
                    products: ids
                        .map((id) => productMap.get(id))
                        .filter(Boolean) as { id: string; name: string; pdfUrl: string }[],
                }
            })

        return NextResponse.json(result)
    } catch (err) {
        console.error('GET /api/shared-pdf error:', err)
        return NextResponse.json(
            { error: 'Failed to fetch generated PDFs' },
            { status: 500 },
        )
    }
}

// ✅ POST Method: Create a New Shared PDF & Assign Creator & Proposal Number + EMAIL CREATOR
export async function POST(req: Request) {
    try {
        let { productIds, clientId } = await req.json()

        const userId = await getUserIdFromToken(req)

        if (!userId) {
            console.error('🚨 No user ID found in token.')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const creator = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        })

        if (!creator) {
            console.error('🚨 Invalid createdById, user does not exist:', userId)
            return NextResponse.json({ error: 'User does not exist' }, { status: 400 })
        }

        if (typeof productIds === 'string') {
            productIds = productIds.split(',').map((id: string) => id.trim())
        }

        if (!Array.isArray(productIds) || productIds.length === 0) {
            console.error('🚨 Invalid productIds format:', productIds)
            return NextResponse.json({ error: 'Invalid productIds format' }, { status: 400 })
        }

        const lastWithNumber = await prisma.sharedPDF.findFirst({
            where: { proposalNumber: { not: null } },
            orderBy: { proposalNumber: 'desc' },
            select: { proposalNumber: true },
        })

        let nextProposalNumber = BASE_PROPOSAL_NUMBER
        if (
            lastWithNumber?.proposalNumber &&
            lastWithNumber.proposalNumber >= BASE_PROPOSAL_NUMBER
        ) {
            nextProposalNumber = lastWithNumber.proposalNumber + 1
        }

        const uniqueSlug = nanoid(10)

        const sharedPdf = await prisma.sharedPDF.create({
            data: {
                uniqueSlug,
                productIds: productIds.join(','),
                createdById: userId,
                proposalNumber: nextProposalNumber,
                ...(clientId && { clientId }),
                // schema requires non-null expiresAt (not used)
                expiresAt: new Date(),
            },
            select: {
                uniqueSlug: true,
                proposalNumber: true,
                createdAt: true,
            },
        })

        const shareUrl = buildShareUrl(sharedPdf.uniqueSlug)
        const fileName = `GTI_PROPOSAL_${sharedPdf.proposalNumber ?? nextProposalNumber}.pdf`

        // ✅ email: to creator, bcc admins
        if (creator.email) {
            const html = `
        <div style="margin:0;padding:0;background-color:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f5f5f7;padding:32px 16px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.12);">
                  <tr>
                    <td align="center" style="padding:24px 24px 8px;">
                      <div style="font-size:26px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;">Toolio</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="height:4px;background:linear-gradient(90deg,#3B06D2,#7C3AED);"></td>
                  </tr>
                  <tr>
                    <td style="padding:28px 24px 8px;">
                      <h1 style="margin:0 0 10px;font-size:20px;line-height:1.3;font-weight:600;color:#111827;">
                        Shared PDF Created
                      </h1>
                      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#4b5563;">
                        Proposal <strong>#${sharedPdf.proposalNumber ?? nextProposalNumber}</strong> is ready.
                      </p>

                      <div style="margin:18px 0;">
                        <a href="${shareUrl}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#111827,#000000);color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;">
                          Open Shared Link
                        </a>
                      </div>

                      <p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;">
                        File name: <strong>${fileName}</strong>
                      </p>

                      <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:#6b7280;">
                        If the button doesn’t work, use this link:
                      </p>
                      <p style="margin:0 0 20px;font-size:12px;line-height:1.5;word-break:break-all;background-color:#f9fafb;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb;color:#111827;">
                        <a href="${shareUrl}" style="color:#2563eb;text-decoration:none;">${shareUrl}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 24px 24px;border-top:1px solid #e5e7eb;">
                      <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#9ca3af;">Best regards,</p>
                      <p style="margin:0 0 2px;font-size:12px;font-weight:600;color:#4b5563;">GTI Toolio • Gulbahar Tobacco International</p>
                      <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;">This is an automated message. Please do not reply directly.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `

            // BCC admins, but avoid duplicating if creator is admin
            const bcc = SUPER_VIEWER_EMAILS.filter((e) => e !== creator.email)

            await sendEmail({
                to: creator.email,
                bcc,
                subject: `Shared PDF Created • Proposal #${sharedPdf.proposalNumber ?? nextProposalNumber}`,
                html,
            })
        }

        return NextResponse.json({
            slug: sharedPdf.uniqueSlug,
            url: buildSharePath(sharedPdf.uniqueSlug),
            proposalNumber: sharedPdf.proposalNumber,
            fileName,
        })
    } catch (error) {
        console.error('🚨 Error creating shared PDF:', error)
        return NextResponse.json({ error: 'Failed to create shared PDF' }, { status: 500 })
    }
}
