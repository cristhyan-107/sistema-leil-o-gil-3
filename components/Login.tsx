
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../src/lib/supabaseClient'

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
            // Successful login, redirection handled by AuthContext/ProtectedRoute usually, 
            // but explicit redirect is good for UX feedback or if using HashRouter without strict protect wrapper on all routes immediately.
            // However, App.tsx flow will redirect.
            navigate('/dashboard')
        }
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`, // Redirects to home/dashboard
            },
        })
        if (error) setErrorMsg(error.message)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-lg rounded-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Entre na sua conta
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Ou{' '}
                        <Link to="/register" className="font-medium text-cyan-600 hover:text-cyan-500">
                            crie uma nova conta
                        </Link>
                    </p>
                </div>
                <div className="mt-8 space-y-6">

                    {errorMsg && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-500 text-center">
                            {errorMsg}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div className="-space-y-px rounded-md shadow-sm">
                            <div>
                                <label htmlFor="email-address" className="sr-only">Email address</label>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 pl-2"
                                    placeholder="Endereço de email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 pl-2"
                                    placeholder="Senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="group relative flex w-full justify-center rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50"
                            >
                                {loading ? 'Carregando...' : 'Entrar'}
                            </button>
                        </div>
                    </form>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white px-2 text-gray-500">Ou continue com</span>
                        </div>
                    </div>

                    <button
                        onClick={handleGoogleLogin}
                        type="button"
                        className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-transparent"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                fill="#34A853"
                            />
                            <path
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                fill="#EA4335"
                            />
                        </svg>
                        <span className="text-sm font-semibold leading-6">Google</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
