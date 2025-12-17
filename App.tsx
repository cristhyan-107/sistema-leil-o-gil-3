import React from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Projecao from './components/Projecao';
import FluxoDeCaixa from './components/FluxoDeCaixa';
import StatusPage from './components/StatusPage';
import { ProjetadoExecutadoPage, VendidoPage } from './components/Placeholders';
import CalculadoraViabilidade from './components/CalculadoraViabilidade';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';

const AppLayout = () => {
    const location = useLocation();
    const { signOut, user } = useAuth();

    // Define if we are in the "Meus Imóveis" section (any of these sub-routes)
    const isPropertiesSection = ['/dashboard', '/projecao', '/fluxo-caixa', '/status', '/projetado-executado', '/vendido'].includes(location.pathname);
    const isCalculatorSection = location.pathname === '/calculadora';

    const topLevelLinkClasses = (isActive: boolean) =>
        `px-4 py-3 text-base font-medium flex items-center space-x-2 border-b-2 transition-colors duration-200 ${isActive ? 'border-cyan-500 text-white' : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'}`;

    const subLinkClasses = ({ isActive }: { isActive: boolean }) =>
        `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-cyan-700/50 text-cyan-100 border border-cyan-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`;

    return (
        <div className="min-h-screen flex flex-col bg-gray-900">
            <header className="bg-gray-800 shadow-md z-10 relative">
                {/* Top Level Navigation */}
                <div className="container mx-auto">
                    <div className="flex items-center h-16 px-4 justify-between">
                        <div className="flex items-center">
                            {/* Logo */}
                            <div className="flex-shrink-0 mr-8 flex items-center">
                                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold rounded p-1.5 mr-2 text-xs">
                                    LCD
                                </div>
                                <h1 className="text-xl font-semibold text-white hidden md:block">LeilaoComDados</h1>
                            </div>

                            {/* Top Tabs */}
                            <nav className="flex space-x-6 h-full">
                                <NavLink
                                    to="/projecao"
                                    className={({ isActive }) => topLevelLinkClasses(isPropertiesSection)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span>Meus Imóveis</span>
                                </NavLink>

                                <NavLink
                                    to="/calculadora"
                                    className={({ isActive }) => topLevelLinkClasses(isCalculatorSection)}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <span>Calculadora de Viabilidade</span>
                                </NavLink>
                            </nav>
                        </div>

                        {/* User / Logout */}
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-400 hidden sm:block">{user?.email}</span>
                            <button
                                onClick={() => signOut()}
                                className="text-sm text-gray-400 hover:text-white border border-gray-600 px-3 py-1 rounded"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                </div>

                {/* Second Level Navigation (Sub-menu for Properties) */}
                {isPropertiesSection && (
                    <div className="bg-gray-900/50 border-t border-gray-700">
                        <div className="container mx-auto px-4 py-2">
                            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar">
                                <NavLink to="/projecao" className={subLinkClasses}>
                                    Projeção
                                </NavLink>
                                <NavLink to="/fluxo-caixa" className={subLinkClasses}>
                                    Fluxo de Caixa
                                </NavLink>
                                <NavLink to="/status" className={subLinkClasses}>
                                    Status
                                </NavLink>
                                <NavLink to="/projetado-executado" className={subLinkClasses}>
                                    Projetado x Executado
                                </NavLink>
                                <NavLink to="/vendido" className={subLinkClasses}>
                                    Vendido
                                </NavLink>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            <main className="flex-grow container mx-auto relative overflow-hidden">
                <Routes>
                    <Route path="/" element={<Navigate to="/projecao" />} />
                    <Route path="/projecao" element={<Projecao />} />
                    <Route path="/fluxo-caixa" element={<FluxoDeCaixa />} />
                    <Route path="/status" element={<StatusPage />} />
                    <Route path="/projetado-executado" element={<ProjetadoExecutadoPage />} />
                    <Route path="/vendido" element={<VendidoPage />} />
                    <Route path="/calculadora" element={<CalculadoraViabilidade />} />
                </Routes>
            </main>
        </div>
    );
};

function App() {
    return (
        <DataProvider>
            <AuthProvider>
                <HashRouter>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        {/* Protected Routes Wrapper */}
                        <Route path="/*" element={
                            <ProtectedRoute>
                                <AppLayout />
                            </ProtectedRoute>
                        } />
                    </Routes>
                </HashRouter>
            </AuthProvider>
        </DataProvider>
    );
}

export default App;