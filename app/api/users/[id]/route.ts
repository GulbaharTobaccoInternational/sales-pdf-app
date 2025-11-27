import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserIdFromToken } from '@/lib/getUserIdFromToken'

// Update user
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const loggedInUserId = await getUserIdFromToken(req)
    if (!loggedInUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if the logged-in user is an admin
    const loggedInUser = await prisma.user.findUnique({
        where: { id: loggedInUserId },
    })
    if (loggedInUser?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userIdToUpdate = params.id

    try {
        const { email, password, role } = await req.json()

        // Ensure at least one field is provided
        if (!email && !password && !role) {
            return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: userIdToUpdate },
            data: { email, password, role },
        })

        return NextResponse.json(updatedUser, { status: 200 })
    } catch (error) {
        console.error('Error updating user:', error)
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}

// Delete user
// Delete user
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const protectedEmail = 'admin@gulbahartobacco.com';
    const loggedInUserId = await getUserIdFromToken(req);

    if (!loggedInUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the logged-in user is an admin
    const loggedInUser = await prisma.user.findUnique({
        where: { id: loggedInUserId },
    });

    if (loggedInUser?.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userIdToDelete = params.id;

    // 🔒 Fetch the user we are about to delete
    const userToDelete = await prisma.user.findUnique({
        where: { id: userIdToDelete },
    });

    if (!userToDelete) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 🔒 Nobody can delete the protected account
    if (userToDelete.email === protectedEmail) {
        return NextResponse.json(
            { error: 'This user account cannot be deleted.' },
            { status: 403 }
        );
    }

    // (Optional) prevent users from deleting themselves at all
    // if (userIdToDelete === loggedInUserId) {
    //   return NextResponse.json(
    //     { error: 'You cannot delete your own account.' },
    //     { status: 403 }
    //   );
    // }

    try {
        await prisma.user.delete({
            where: { id: userIdToDelete },
        });

        return NextResponse.json(
            { message: 'User deleted successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
            { error: 'Failed to delete user' },
            { status: 500 }
        );
    }
}

