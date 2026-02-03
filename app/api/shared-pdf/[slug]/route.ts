import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid';
import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'
import { buildSharePath } from '@/lib/shareUrl'

// ✅ Extract User ID from JWT Token
async function getUserIdFromToken(req: Request): Promise<string | null> {
    try {
        const token = cookies().get('token')?.value
        if (!token) return null

        const secret = new TextEncoder().encode(process.env.JWT_SECRET)
        const { payload } = await jwtVerify(token, secret)

        return payload.id as string
    } catch (error) {
        console.error('Error verifying token:', error)
        return null
    }
}

// ✅ GET: Fetch Only PDFs Created by the Logged-in User
export async function GET(req: Request) {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sharedPdfs = await prisma.sharedPDF.findMany({
            where: { createdById: userId }, // ✅ Fetch only PDFs created by this user
        });

        return NextResponse.json(sharedPdfs);
    } catch (error) {
        console.error('Error fetching genereated PDFs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch generated PDFs' },
            { status: 500 }
        );
    }
}

// ✅ POST: Create a New Shared PDF & Assign Creator
export async function POST(req: Request) {
    try {
        const userId = await getUserIdFromToken(req);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let { productIds, expiresAt } = await req.json();

         // ✅ Convert `productIds` from a string to an array (if necessary)
         if (typeof productIds === 'string') {
            productIds = productIds.split(',').map(id => id.trim());
        }
        
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return NextResponse.json({ error: 'Invalid productIds format' }, { status: 400 });
        }

        const uniqueSlug = nanoid(10);

        const sharedPdf = await prisma.sharedPDF.create({
            data: {
                uniqueSlug,
                productIds: productIds.join(','),
                expiresAt: new Date(expiresAt),
                createdById: userId, // ✅ Assign creator ID
            },
        });

        return NextResponse.json({ slug: sharedPdf.uniqueSlug, url: buildSharePath(sharedPdf.uniqueSlug) });
    } catch (error) {
        console.error('Error creating shared PDF:', error);
        return NextResponse.json({ error: 'Failed to create shared PDF' }, { status: 500 });
    }
}
