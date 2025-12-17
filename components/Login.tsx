import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setErrorMsg(error.message)
            setLoading(false)
        } else {
            navigate('/dashboard')
        }
    }

    const handleGoogleLogin = async () => {
        setErrorMsg(null)

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // ⚠️ ROTA PROTEGIDA REAL
                redirectTo: `${window.location.origin}/dashboard`,
            },
        })

        if (error) {
            setErrorMsg(error.message)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
                <h2 className="mb-2 text-center text-3xl font-bold text-gray-900">
                    Entrar
                </h2>
                <p className="mb-6 text-center text-sm text-gray-600">
                    Ou{' '}
                    <Link to="/register" className="text-cyan-600 hover:text-cyan-500">
                        crie uma conta
                    </Link>
                </p>

                {errorMsg && (
                    <div className="mb-4 rounded bg-red-50 p-3 text-center text-sm text-red-600">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Email"
                        required
                        className="w-full rounded border px-3 py-2"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <input
                        type="password"
                        placeholder="Senha"
                        required
                        className="w-full rounded border px-3 py-2"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded bg-cyan-600 py-2 font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>

                <div className="my-6 text-center text-sm text-gray-500">ou</div>

                <button
                    onClick={handleGoogleLogin}
                    className="flex w-full items-center justify-center gap-2 rounded border py-2 font-semibold hover:bg-gray-50"
                >
                    Entrar com Google
                </button>
            </div>
        </div>
    )
}
