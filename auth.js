
import { supabase } from './supabaseClient.js'

// --- Sign Up ---
export async function registerUser(email, password) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })
    return { data, error }
}

// --- Sign In (Email/Password) ---
export async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })
    return { data, error }
}

// --- Sign In (Google OAuth) ---
export async function loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth-callback.html`,
        },
    })
    return { data, error }
}

// --- Log Out ---
export async function logoutUser() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
        window.location.href = '/login.html'
    }
    return { error }
}

// --- Get Current User ---
export async function getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
}

// --- Get Session ---
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
}
