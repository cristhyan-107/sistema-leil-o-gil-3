
import { getUser } from './auth.js'

async function checkAuth() {
    const user = await getUser()
    if (!user) {
        // Se não houver usuário autenticado, redireciona para o login
        window.location.href = '/login.html'
    }
}

// Executa a verificação ao carregar o script
checkAuth()
