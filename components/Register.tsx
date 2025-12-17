
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../src/lib/supabaseClient'

export default function Register() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setErrorMsg(null)

        if (password !== confirmPassword) {
            setErrorMsg('As senhas não coincidem.')
            setLoading(false)
            return
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
        })

        if (error) {
            setErrorMsg(error.message)
            setLoading(false)
        } else {
            setSuccessMsg('Cadastro realizado com sucesso! Verifique seu email.')
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 bg-white p-8 shadow-lg rounded-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Crie sua conta
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Já tem uma conta?{' '}
                        <Link to="/login" className="font-medium text-cyan-600 hover:text-cyan-500">
                            Faça login
                        </Link>
                    </p>
                </div>

                {successMsg ? (
                    <div className="rounded-md bg-green-50 p-4 text-sm text-green-600 text-center">
                        {successMsg}
                        <div className="mt-4">
                            <Link to="/login" className="font-medium text-cyan-600 underline">Ir para Login</Link>
                        </div>
                    </div>
                ) : (
                    <div className="mt-8 space-y-6">
                        {errorMsg && (
                            <div className="rounded-md bg-red-50 p-4 text-sm text-red-500 text-center">
                                {errorMsg}
                            </div>
                        )}

                        <form className="space-y-6" onSubmit={handleRegister}>
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
                                        autoComplete="new-password"
                                        required
                                        className="relative block w-full border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 pl-2"
                                        placeholder="Senha"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirm-password" className="sr-only">Confirm Password</label>
                                    <input
                                        id="confirm-password"
                                        name="confirm-password"
                                        type="password"
                                        autoComplete="new-password"
                                        required
                                        className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-cyan-600 sm:text-sm sm:leading-6 pl-2"
                                        placeholder="Confirme a senha"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative flex w-full justify-center rounded-md bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:opacity-50"
                                >
                                    {loading ? 'Cadastrando...' : 'Cadastrar'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
