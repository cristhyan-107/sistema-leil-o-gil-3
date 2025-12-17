
import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <div className="text-white">Carregando...</div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}
