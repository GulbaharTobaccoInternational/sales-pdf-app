'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { DataTable } from '@/components/custom/table/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Users as UsersIcon } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { columns } from '@/components/custom/table/users/columns'
import PageHeading from '@/components/layout/page-heading'
import { useUserRole } from '@/hooks/useUserRole'

type User = {
    id: string
    email: string
    role: string
    createdAt: string
}

type FormValues = {
    email: string
    role: string
}

const UsersPage = () => {
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [userToDelete, setUserToDelete] = useState<string | null>(null)
    const [buttonLoading, setButtonLoading] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const role = useUserRole()

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        formState: { errors },
    } = useForm<FormValues>()

    useEffect(() => {
        fetchUsers()

        const editHandler = (event: CustomEvent) => openEditModal(event.detail)
        const deleteHandler = (event: CustomEvent) => openDeleteDialog(event.detail)

        window.addEventListener('openEditUser', editHandler as EventListener)
        window.addEventListener('confirmDeleteUser', deleteHandler as EventListener)

        return () => {
            window.removeEventListener('openEditUser', editHandler as EventListener)
            window.removeEventListener('confirmDeleteUser', deleteHandler as EventListener)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const response = await api.get('/api/users')
            setUsers(response.data)
        } catch (error) {
            toast.error('Failed to load users')
        } finally {
            setLoading(false)
        }
    }

    // ADD or EDIT user based on selectedUser
    const handleAddUser = async (data: FormValues) => {
        setButtonLoading(true)
        try {
            if (selectedUser) {
                // ✅ EDIT: call PUT /api/users/:id
                const response = await api.put(`/api/users/${selectedUser.id}`, {
                    email: data.email,
                    role: data.role,
                })

                if (response.status === 200) {
                    toast.success('User updated successfully')
                    reset()
                    setSelectedUser(null)
                    setIsDialogOpen(false)
                    fetchUsers()
                } else {
                    toast.error('Failed to update user')
                }
            } else {
                // ✅ ADD: call POST /api/users
                const response = await api.post('/api/users', data)

                if (response.status === 201) {
                    toast.success('User added successfully')
                    reset()
                    setIsDialogOpen(false)
                    fetchUsers()
                } else {
                    toast.error('Failed to add user')
                }
            }
        } catch (error: any) {
            const msg = error?.response?.data?.error
            if (msg === 'User already exists') {
                toast.error('User already exists')
            } else if (selectedUser) {
                toast.error('Error updating user')
            } else {
                toast.error('Error adding user')
            }
            console.error(error)
        } finally {
            setButtonLoading(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!userToDelete) return
        setButtonLoading(true)
        try {
            await api.delete(`/api/users/${userToDelete}`)
            toast.success('User deleted successfully')
            fetchUsers()
        } catch (error) {
            toast.error('Failed to delete user')
        } finally {
            setDeleteDialogOpen(false)
            setUserToDelete(null)
            setButtonLoading(false)
        }
    }

    const openEditModal = (user: User) => {
        setSelectedUser(user)
        setValue('email', user.email)
        setValue('role', user.role)
        setIsDialogOpen(true)
    }

    const openDeleteDialog = (id: string) => {
        setUserToDelete(id)
        setDeleteDialogOpen(true)
    }

    return (
        <div className="space-y-5">
            <PageHeading heading="Users" />

            {/* Top bar — count + action */}
            <div className="flex items-center justify-between rounded-2xl border border-white/30 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-xl">
                <div className="flex items-center gap-3 text-sm text-zinc-700">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 bg-white/70 shadow-sm">
                        <UsersIcon className="h-4 w-4" />
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">Total</span>
                        <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-zinc-900 shadow-sm">
                            {users.length}
                        </span>
                    </div>
                </div>

                {role === 'ADMIN' && (
                    <Button
                        variant="black"
                        onClick={() => {
                            setSelectedUser(null)
                            reset()
                            setIsDialogOpen(true)
                        }}
                        className="rounded-xl"
                    >
                        <Plus className="mr-2" />
                        Add User
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-white/30 bg-white/60 p-2 shadow-sm backdrop-blur-xl md:p-4">
                <DataTable<User>
                    columns={columns(role)}
                    data={users}
                    filterField="email"
                    loading={loading}
                />
            </div>

            {/* Add/Edit User Dialog */}
            <Dialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false)
                    setSelectedUser(null)
                    reset()
                }}
                title={selectedUser ? 'Edit User' : 'Add User'}
                onSubmit={handleSubmit(handleAddUser)}
                buttonLoading={buttonLoading}
            >
                <div className="space-y-5 p-1">
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            Email
                        </label>
                        <Input
                            placeholder="Enter email"
                            className="rounded-xl border border-zinc-300 bg-white text-black
                 placeholder:text-black/70
                 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10"
                            {...register('email', { required: 'Email is required' })}
                        />
                        {errors.email && (
                            <p className="text-sm text-red-500">{String(errors.email.message)}</p>
                        )}
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                            Role
                        </label>
                        <select
                            className="w-full rounded-xl border border-zinc-300 bg-white p-2 text-sm text-black
                 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10"
                            {...register('role', { required: 'Role is required' })}
                            defaultValue={selectedUser ? selectedUser.role : ''}
                        >
                            <option value="">Select Role</option>
                            <option value="ADMIN">Admin</option>
                            <option value="SALESPERSON">Salesperson</option>
                        </select>
                        {errors.role && (
                            <p className="text-sm text-red-500">{String(errors.role.message)}</p>
                        )}
                    </div>
                </div>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                isOpen={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                title="Confirm Delete"
                onSubmit={handleDeleteUser}
                buttonLoading={buttonLoading}
            >
                <div className="px-1 py-2 text-center text-lg font-semibold text-zinc-800">
                    Are you sure you want to delete this user?
                </div>
            </Dialog>
        </div>
    )
}

export default UsersPage
