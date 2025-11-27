import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Define the secret key as a Uint8Array
const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value

    if (!token) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        // Verify the token
        await jwtVerify(token, secret)
    } catch (err) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        // exclude public routes from auth: api, assets, login, register, set-password
        '/((?!api|_next|static|images|favicon.ico|manifest.json|login|register|set-password).*)',
    ],
}
