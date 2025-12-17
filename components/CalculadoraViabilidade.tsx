import React, { useState, useMemo, useEffect, useRef } from 'react';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/formatters';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

// --- TYPES ---
type SimulationType = 'AVista' | 'Financiado';
type AmortizationSystem = 'SAC' | 'Price';

interface Simulation {
    id: string;
    name: string;
    
    // Inputs Gerais
    mesesParaVenda: number;
    valorVenda: number;
    comissaoCorretorPct: number;
    
    // Inputs Leilão
    valorLance: number;
    incrementoLance: number; // Para tabela sensibilidade
    
    comissaoLeiloeiroPct: number;
    comissaoLeiloeiroValor: number; // Armazena override ou calculado
    
    itbiPct: number;
    itbiValor: number; // Armazena override ou calculado
    
    custoRegistro: number;
    custoEscritura: number;
    
    // Custos Fixos
    custoReforma: number;
    custoDesocupacao: number;
    condominioMensal: number;
    iptuAnual: number;
    
    // Financiamento
    tipoCompra: SimulationType;
    percentualEntrada: number;
    taxaJurosAnual: number;
    prazoMeses: number;
    sistemaAmortizacao: AmortizationSystem; // Novo campo
}

// --- HELPERS ---
const generateId = () => Math.random().toString(36).substr(2, 9);

const DEFAULT_SIMULATION: Simulation = {
    id: 'default',
    name: 'Simulação 1',
    mesesParaVenda: 12,
    valorVenda: 0,
    comissaoCorretorPct: 5,
    valorLance: 0,
    incrementoLance: 5000,
    comissaoLeiloeiroPct: 5,
    comissaoLeiloeiroValor: 0,
    itbiPct: 2,
    itbiValor: 0,
    custoRegistro: 0,
    custoEscritura: 0,
    custoReforma: 0,
    custoDesocupacao: 0,
    condominioMensal: 0,
    iptuAnual: 0, 
    tipoCompra: 'AVista',
    percentualEntrada: 20,
    taxaJurosAnual: 9.5,
    prazoMeses: 360,
    sistemaAmortizacao: 'SAC'
};

// Componente Input Monetário
const MoneyInput: React.FC<{ 
    value: number; 
    onChange: (val: number) => void; 
    className?: string;
    placeholder?: string;
    readOnly?: boolean;
}> = ({ value, onChange, className, placeholder, readOnly }) => {
    const [displayValue, setDisplayValue] = useState(value === 0 ? '' : formatCurrencyBRL(value));
    const [isFocused, setIsFocused] = useState(false);
    
    useEffect(() => {
        if (!isFocused) {
             setDisplayValue(value === 0 ? '' : formatCurrencyBRL(value));
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDisplayValue(e.target.value);
        const val = parseCurrencyBRL(e.target.value);
        onChange(val);
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        const val = parseCurrencyBRL(displayValue);
        setDisplayValue(val === 0 ? '' : formatCurrencyBRL(val));
    };

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={className}
            placeholder={placeholder}
            readOnly={readOnly}
        />
    );
};

const CalculadoraViabilidade: React.FC = () => {
    // State: Lista de Simulações
    const [simulations, setSimulations] = useState<Simulation[]>([{ ...DEFAULT_SIMULATION, id: generateId() }]);
    const [activeSimId, setActiveSimId] = useState<string>(simulations[0].id);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    
    // Ref para o container do relatório (invisível na tela)
    const reportRef = useRef<HTMLDivElement>(null);

    // Get Active Simulation
    const activeSim = useMemo(() => simulations.find(s => s.id === activeSimId) || simulations[0], [simulations, activeSimId]);

    // --- ACTIONS ---
    const updateSim = (field: keyof Simulation, value: any) => {
        setSimulations(prev => prev.map(s => {
            if (s.id === activeSim.id) {
                const updated = { ...s, [field]: value };
                
                // Regras Automáticas de Negócio
                
                if (field === 'valorVenda') {
                    const val = value as number;
                    updated.custoRegistro = val * 0.01;
                    updated.custoEscritura = val * 0.01;
                }

                if (field === 'valorLance') {
                    const val = value as number;
                    updated.comissaoLeiloeiroValor = val * (s.comissaoLeiloeiroPct / 100);
                    updated.itbiValor = val * (s.itbiPct / 100);
                }

                if (field === 'comissaoLeiloeiroPct') {
                    updated.comissaoLeiloeiroValor = s.valorLance * ((value as number) / 100);
                }

                if (field === 'itbiPct') {
                    updated.itbiValor = s.valorLance * ((value as number) / 100);
                }

                return updated;
            }
            return s;
        }));
    };

    const updateCoupledValue = (fieldVal: 'comissaoLeiloeiroValor' | 'itbiValor', fieldPct: 'comissaoLeiloeiroPct' | 'itbiPct', newVal: number) => {
        setSimulations(prev => prev.map(s => {
            if (s.id === activeSim.id) {
                const updated = { ...s, [fieldVal]: newVal };
                if (s.valorLance > 0) {
                    updated[fieldPct] = (newVal / s.valorLance) * 100;
                }
                return updated;
            }
            return s;
        }));
    };

    const addSimulation = () => {
        const newSim = { ...DEFAULT_SIMULATION, id: generateId(), name: `Simulação ${simulations.length + 1}` };
        setSimulations(prev => [...prev, newSim]);
        setActiveSimId(newSim.id);
    };

    const deleteSimulation = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (simulations.length === 1) return;
        const newSims = simulations.filter(s => s.id !== id);
        setSimulations(newSims);
        if (activeSimId === id) setActiveSimId(newSims[0].id);
    };

    // --- PDF GENERATION ---
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsGeneratingPdf(true);

        try {
            // Pequeno delay para garantir renderização
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(reportRef.current, {
                scale: 2, // Melhor qualidade
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // Calcular proporção para caber na largura da página A4
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10; // Margem superior

            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297); // Força A4 full
            pdf.save(`Viabilidade_${activeSim.name.replace(/\s+/g, '_')}.pdf`);

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Erro ao gerar PDF. Tente novamente.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // --- CALCULATION ENGINE ---
    const calculateScenario = (lance: number) => {
        const {
            mesesParaVenda, valorVenda, comissaoCorretorPct, 
            comissaoLeiloeiroPct, itbiPct, 
            custoRegistro, custoEscritura, 
            custoReforma, custoDesocupacao, condominioMensal, iptuAnual,
            tipoCompra, percentualEntrada, taxaJurosAnual, prazoMeses, sistemaAmortizacao
        } = activeSim;

        // 1. Custos de Aquisição
        const comissaoLeiloeiro = lance * (comissaoLeiloeiroPct / 100);
        const itbi = lance * (itbiPct / 100);
        const cartorioTotal = custoRegistro + custoEscritura;

        const custosAquisicao = comissaoLeiloeiro + itbi + cartorioTotal;

        // 2. Custos de Holding (Manutenção)
        const totalCondominio = condominioMensal * mesesParaVenda;
        const totalIptu = (iptuAnual / 12) * mesesParaVenda;
        
        const manutencaoTotal = totalCondominio + totalIptu;
        const preparacaoTotal = custoReforma + custoDesocupacao + manutencaoTotal;

        // 3. Custos de Venda
        const comissaoCorretor = valorVenda * (comissaoCorretorPct / 100);

        // --- LÓGICA FINANCEIRA ---
        let capitalInvestido = 0;
        let saldoDevedorQuitacao = 0;
        let custoFinanciamento = 0;
        let totalPagoParcelas = 0;

        if (tipoCompra === 'AVista') {
            capitalInvestido = lance + custosAquisicao + preparacaoTotal;
        } else {
            // Financiado
            const valorEntrada = lance * (percentualEntrada / 100);
            const valorFinanciado = lance - valorEntrada;
            
            const taxaMensal = (taxaJurosAnual / 100) / 12;
            let saldoDevedor = valorFinanciado;
            
            if (prazoMeses > 0 && valorFinanciado > 0) {
                // Simulação mês a mês para encontrar o saldo devedor exato na venda
                if (sistemaAmortizacao === 'SAC') {
                     const amortizacaoConstante = valorFinanciado / prazoMeses;
                     
                     for (let i = 0; i < mesesParaVenda; i++) {
                        const juros = saldoDevedor * taxaMensal;
                        const parcela = amortizacaoConstante + juros;
                        
                        totalPagoParcelas += parcela;
                        custoFinanciamento += juros;
                        saldoDevedor -= amortizacaoConstante;
                        
                        if (saldoDevedor < 0) saldoDevedor = 0;
                    }
                } else {
                    // PRICE
                    const fator = Math.pow(1 + taxaMensal, prazoMeses);
                    const pmt = valorFinanciado * ((taxaMensal * fator) / (fator - 1));

                    for (let i = 0; i < mesesParaVenda; i++) {
                        const juros = saldoDevedor * taxaMensal;
                        const amortizacao = pmt - juros;
                        
                        let parcela = pmt;
                        
                        if (saldoDevedor < amortizacao) {
                            parcela = saldoDevedor + juros;
                            saldoDevedor = 0;
                        } else {
                            saldoDevedor -= amortizacao;
                        }

                        totalPagoParcelas += parcela;
                        custoFinanciamento += juros;
                    }
                }
            }
            
            saldoDevedorQuitacao = saldoDevedor;

            // O capital investido é o que saiu do bolso até a venda
            capitalInvestido = valorEntrada + custosAquisicao + preparacaoTotal + totalPagoParcelas;
        }

        // 4. Imposto de Renda
        const custosDedutiveis = (tipoCompra === 'AVista' ? lance : lance) + custosAquisicao + custoReforma + comissaoCorretor + (tipoCompra === 'Financiado' ? custoFinanciamento : 0);
        const baseGanho = valorVenda - custosDedutiveis;
        const impostoRenda = baseGanho > 0 ? baseGanho * 0.15 : 0;

        // 5. Saída de Caixa Final
        const totalSaidasVenda = comissaoCorretor + impostoRenda + saldoDevedorQuitacao;
        
        // Lucro Líquido
        const recebimentoLiquidoVenda = valorVenda - totalSaidasVenda;
        const lucroLiquido = recebimentoLiquidoVenda - capitalInvestido;

        const roiTotal = capitalInvestido > 0 ? (lucroLiquido / capitalInvestido) * 100 : 0;
        
        let roiMensal = 0;
        if ((1 + roiTotal/100) > 0 && mesesParaVenda > 0) {
            roiMensal = (Math.pow(1 + roiTotal/100, 1 / mesesParaVenda) - 1) * 100;
        }

        return {
            lance,
            lucroLiquido,
            roiTotal,
            roiMensal,
            capitalInvestido,
            breakdown: {
                comissaoLeiloeiro,
                itbi,
                cartorioTotal,
                preparacaoTotal,
                comissaoCorretor,
                impostoRenda,
                saldoDevedorQuitacao,
                totalPagoParcelas,
                custoFinanciamento
            }
        };
    };

    // Base Scenario (Current Inputs)
    const baseResult = useMemo(() => calculateScenario(activeSim.valorLance), [activeSim]);

    // Sensitivity Table
    const sensitivityData = useMemo(() => {
        if (activeSim.valorLance === 0) return [];
        const rows = [];
        // Loop expanded to 12 rows as requested
        for (let i = 0; i < 12; i++) {
            const currentLance = activeSim.valorLance + (activeSim.incrementoLance * i);
            rows.push(calculateScenario(currentLance));
        }
        return rows;
    }, [activeSim]);

    return (
        <div className="flex h-full bg-gray-900 animate-fade-in overflow-hidden relative">
            
            {/* --- HIDDEN PDF REPORT TEMPLATE --- */}
            <div 
                ref={reportRef} 
                className="fixed top-0 -left-[9999px] w-[210mm] min-h-[297mm] bg-white text-gray-900 p-8 shadow-none font-sans"
            >
                {/* Header */}
                <div className="border-b-2 border-gray-200 pb-4 mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-1">{activeSim.name}</h1>
                        <a href="https://www.leilaocomdados.com.br" className="text-sm text-blue-600">www.leilaocomdados.com.br</a>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data do Relatório</div>
                        <div className="text-lg font-bold text-gray-700">{new Date().toLocaleDateString('pt-BR')}</div>
                    </div>
                </div>

                {/* Executive Summary Cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Lucro Líquido</div>
                        <div className={`text-2xl font-bold ${baseResult.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrencyBRL(baseResult.lucroLiquido)}
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase">ROI Total</div>
                        <div className="text-2xl font-bold text-cyan-700">
                            {baseResult.roiTotal.toFixed(1)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            ROI Mensal: {baseResult.roiMensal.toFixed(2)}%
                        </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase">Capital Investido</div>
                        <div className="text-2xl font-bold text-gray-800">
                            {formatCurrencyBRL(baseResult.capitalInvestido)}
                        </div>
                    </div>
                </div>

                {/* Main Details Grid */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                    
                    {/* Coluna 1: Dados do Imóvel e Aquisição */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4">Dados da Operação</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Valor de Venda (Mercado):</span>
                                <span className="font-bold">{formatCurrencyBRL(activeSim.valorVenda)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Valor do Lance:</span>
                                <span className="font-bold">{formatCurrencyBRL(activeSim.valorLance)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Tipo de Compra:</span>
                                <span className="font-bold">{activeSim.tipoCompra === 'AVista' ? 'À Vista' : 'Financiado'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Prazo Estimado:</span>
                                <span className="font-bold">{activeSim.mesesParaVenda} Meses</span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4 mt-8">Custos de Aquisição</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Comissão Leiloeiro ({activeSim.comissaoLeiloeiroPct}%):</span>
                                <span>{formatCurrencyBRL(baseResult.breakdown.comissaoLeiloeiro)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">ITBI ({activeSim.itbiPct}%):</span>
                                <span>{formatCurrencyBRL(baseResult.breakdown.itbi)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Registro e Escritura:</span>
                                <span>{formatCurrencyBRL(baseResult.breakdown.cartorioTotal)}</span>
                            </div>
                            {activeSim.tipoCompra === 'Financiado' && (
                                <div className="flex justify-between border-b border-gray-100 pb-1 bg-blue-50 p-1 rounded">
                                    <span className="text-blue-800 font-medium">Entrada ({activeSim.percentualEntrada}%):</span>
                                    <span className="text-blue-800 font-bold">{formatCurrencyBRL(activeSim.valorLance * (activeSim.percentualEntrada/100))}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Coluna 2: Custos e Saídas */}
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4">Reformas e Manutenção</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Reforma:</span>
                                <span>{formatCurrencyBRL(activeSim.custoReforma)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Desocupação:</span>
                                <span>{formatCurrencyBRL(activeSim.custoDesocupacao)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Condomínio + IPTU ({activeSim.mesesParaVenda} meses):</span>
                                <span>{formatCurrencyBRL((activeSim.condominioMensal * activeSim.mesesParaVenda) + (activeSim.iptuAnual / 12 * activeSim.mesesParaVenda))}</span>
                            </div>
                            {activeSim.tipoCompra === 'Financiado' && (
                                <div className="flex justify-between border-b border-gray-100 pb-1">
                                    <span className="text-gray-600">Parcelas Pagas (Holding):</span>
                                    <span className="font-medium text-orange-600">{formatCurrencyBRL(baseResult.breakdown.totalPagoParcelas || 0)}</span>
                                </div>
                            )}
                             <div className="flex justify-between pt-2">
                                <span className="font-bold text-gray-700">Total Preparação:</span>
                                <span className="font-bold">{formatCurrencyBRL(baseResult.breakdown.preparacaoTotal + (baseResult.breakdown.totalPagoParcelas || 0))}</span>
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4 mt-8">Saídas na Venda</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Comissão Corretor ({activeSim.comissaoCorretorPct}%):</span>
                                <span>{formatCurrencyBRL(baseResult.breakdown.comissaoCorretor)}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 pb-1">
                                <span className="text-gray-600">Imposto de Renda (Est. 15%):</span>
                                <span>{formatCurrencyBRL(baseResult.breakdown.impostoRenda)}</span>
                            </div>
                            {activeSim.tipoCompra === 'Financiado' && (
                                <div className="flex justify-between border-b border-gray-100 pb-1 bg-red-50 p-1 rounded">
                                    <span className="text-red-800 font-medium">Saldo Devedor para Quitação:</span>
                                    <span className="text-red-800 font-bold">{formatCurrencyBRL(baseResult.breakdown.saldoDevedorQuitacao)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sensitivity Table Minimal */}
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-300 pb-2 mb-4">Tabela de Lances</h3>
                    <table className="w-full text-xs text-left text-gray-600">
                        <thead className="bg-gray-100 uppercase font-semibold">
                            <tr>
                                <th className="px-4 py-2">Lance</th>
                                <th className="px-4 py-2 text-right">Invest. Total</th>
                                <th className="px-4 py-2 text-right">Lucro</th>
                                <th className="px-4 py-2 text-right">ROI</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sensitivityData.map((row, idx) => (
                                <tr key={idx} className={idx === 0 ? "font-bold bg-gray-50" : "border-b border-gray-100"}>
                                    <td className="px-4 py-2">{formatCurrencyBRL(row.lance)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrencyBRL(row.capitalInvestido)}</td>
                                    <td className="px-4 py-2 text-right">{formatCurrencyBRL(row.lucroLiquido)}</td>
                                    <td className="px-4 py-2 text-right">{row.roiTotal.toFixed(2)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="absolute bottom-8 left-8 right-8 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
                    <a href="https://www.leilaocomdados.com.br" className="text-blue-500">www.leilaocomdados.com.br</a>
                </div>
            </div>

            
            {/* SIDEBAR: SIMULATIONS */}
            <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-gray-700">
                    <button 
                        onClick={addSimulation}
                        className="w-full px-3 py-2 text-sm font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors flex items-center justify-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nova Simulação
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {simulations.map(sim => (
                        <div key={sim.id} className="relative group">
                            <button
                                onClick={() => setActiveSimId(sim.id)}
                                className={`w-full text-left px-3 py-3 rounded-md text-sm font-medium transition-colors flex justify-between items-center ${activeSimId === sim.id ? 'bg-gray-700 text-cyan-400 border-l-4 border-cyan-500' : 'text-gray-400 hover:bg-gray-750 hover:text-white'}`}
                            >
                                {activeSimId === sim.id ? (
                                    <input 
                                        type="text" 
                                        value={sim.name} 
                                        onChange={(e) => updateSim('name', e.target.value)}
                                        className="bg-transparent border-none focus:ring-0 p-0 text-cyan-400 font-bold w-full"
                                        onClick={e => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="truncate">{sim.name}</span>
                                )}
                            </button>
                            {simulations.length > 1 && (
                                <button 
                                    onClick={(e) => deleteSimulation(sim.id, e)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col overflow-y-auto p-6 space-y-6">
                 <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-white flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Calculadora de Viabilidade
                    </h2>
                    
                    <div className="flex items-center space-x-3">
                        {/* PDF Button */}
                        <button
                            onClick={handleExportPDF}
                            disabled={isGeneratingPdf}
                            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${isGeneratingPdf ? 'bg-gray-700 text-gray-500 cursor-wait' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'}`}
                        >
                            {isGeneratingPdf ? (
                                <span>Gerando...</span>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Gerar Relatório
                                </>
                            )}
                        </button>

                        {/* Toggle Tipo Compra */}
                        <div className="bg-gray-800 p-1 rounded-lg flex space-x-1 border border-gray-700">
                            <button
                                onClick={() => updateSim('tipoCompra', 'AVista')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeSim.tipoCompra === 'AVista' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                À Vista
                            </button>
                            <button
                                onClick={() => updateSim('tipoCompra', 'Financiado')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeSim.tipoCompra === 'Financiado' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                            >
                                Financiado
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    
                    {/* INPUTS COLUMN */}
                    <div className="xl:col-span-4 space-y-6">
                        
                        {/* 1. Potencial de Venda */}
                        <div className="bg-gray-800 p-5 rounded-lg shadow border-l-4 border-green-500 space-y-4">
                            <h3 className="text-base font-semibold text-white border-b border-gray-700 pb-2">1. Potencial de Venda</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Valor Venda (Mercado)</label>
                                    <MoneyInput 
                                        value={activeSim.valorVenda} 
                                        onChange={val => updateSim('valorVenda', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-bold text-right"
                                        placeholder="R$ 0,00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Meses p/ Venda</label>
                                    <input 
                                        type="number" 
                                        value={activeSim.mesesParaVenda}
                                        onChange={e => updateSim('mesesParaVenda', parseFloat(e.target.value))}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-center"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Comissão Corretor (%)</label>
                                    <div className="flex items-center">
                                         <input 
                                            type="number" 
                                            value={activeSim.comissaoCorretorPct}
                                            onChange={e => updateSim('comissaoCorretorPct', parseFloat(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-600 rounded-l p-2 text-white text-right"
                                        />
                                        <span className="bg-gray-700 border border-l-0 border-gray-600 p-2 rounded-r text-gray-300 text-sm">%</span>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <div className="text-xs text-gray-500 text-right">
                                        = {formatCurrencyBRL(activeSim.valorVenda * (activeSim.comissaoCorretorPct/100))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700/50">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Registro (1%)</label>
                                    <MoneyInput 
                                        value={activeSim.custoRegistro} 
                                        onChange={val => updateSim('custoRegistro', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Escritura (1%)</label>
                                    <MoneyInput 
                                        value={activeSim.custoEscritura} 
                                        onChange={val => updateSim('custoEscritura', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 2. Aquisição (Leilão) */}
                        <div className="bg-gray-800 p-5 rounded-lg shadow border-l-4 border-cyan-500 space-y-4">
                            <h3 className="text-base font-semibold text-white border-b border-gray-700 pb-2">2. Aquisição (Leilão)</h3>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Valor do Lance</label>
                                <MoneyInput 
                                    value={activeSim.valorLance} 
                                    onChange={val => updateSim('valorLance', val)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-bold text-lg text-right focus:border-cyan-500"
                                    placeholder="R$ 0,00"
                                />
                            </div>

                            {/* Leiloeiro: Valor e Porcentagem lado a lado */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Comissão Leiloeiro</label>
                                <div className="flex space-x-2">
                                    <MoneyInput 
                                        value={activeSim.comissaoLeiloeiroValor}
                                        onChange={val => updateCoupledValue('comissaoLeiloeiroValor', 'comissaoLeiloeiroPct', val)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                    <div className="w-24 flex items-center">
                                        <input 
                                            type="number" 
                                            value={activeSim.comissaoLeiloeiroPct}
                                            onChange={e => updateSim('comissaoLeiloeiroPct', parseFloat(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-600 rounded-l p-2 text-white text-right"
                                        />
                                        <span className="bg-gray-700 border border-l-0 border-gray-600 p-2 rounded-r text-gray-300 text-sm">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* ITBI: Valor e Porcentagem lado a lado */}
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">ITBI</label>
                                <div className="flex space-x-2">
                                    <MoneyInput 
                                        value={activeSim.itbiValor}
                                        onChange={val => updateCoupledValue('itbiValor', 'itbiPct', val)}
                                        className="flex-1 bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                    <div className="w-24 flex items-center">
                                        <input 
                                            type="number" 
                                            value={activeSim.itbiPct}
                                            onChange={e => updateSim('itbiPct', parseFloat(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-600 rounded-l p-2 text-white text-right"
                                        />
                                        <span className="bg-gray-700 border border-l-0 border-gray-600 p-2 rounded-r text-gray-300 text-sm">%</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Incremento Simulação (Tabela)</label>
                                <MoneyInput 
                                    value={activeSim.incrementoLance} 
                                    onChange={val => updateSim('incrementoLance', val)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-gray-400 text-right text-sm"
                                />
                            </div>
                        </div>

                        {/* 3. Financiamento (Condicional) */}
                        {activeSim.tipoCompra === 'Financiado' && (
                            <div className="bg-gray-800 p-5 rounded-lg shadow border-l-4 border-indigo-500 space-y-4">
                                <h3 className="text-base font-semibold text-white border-b border-gray-700 pb-2">3. Dados Financiamento</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Entrada (%)</label>
                                        <div className="flex items-center">
                                            <input 
                                                type="number" 
                                                value={activeSim.percentualEntrada} 
                                                onChange={e => updateSim('percentualEntrada', parseFloat(e.target.value))}
                                                className="w-full bg-gray-900 border border-gray-600 rounded-l p-2 text-white text-right"
                                            />
                                            <span className="bg-gray-700 p-2 rounded-r text-gray-300 text-sm">%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 mb-1 text-right">Valor Entrada</div>
                                        <div className="text-white font-mono text-right text-sm pt-2">
                                            {formatCurrencyBRL(activeSim.valorLance * (activeSim.percentualEntrada / 100))}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Taxa Juros (a.a.)</label>
                                        <input 
                                            type="number" 
                                            value={activeSim.taxaJurosAnual} 
                                            onChange={e => updateSim('taxaJurosAnual', parseFloat(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Prazo (Meses)</label>
                                        <input 
                                            type="number" 
                                            value={activeSim.prazoMeses} 
                                            onChange={e => updateSim('prazoMeses', parseFloat(e.target.value))}
                                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Sistema Amortização</label>
                                    <select 
                                        value={activeSim.sistemaAmortizacao} 
                                        onChange={e => updateSim('sistemaAmortizacao', e.target.value as AmortizationSystem)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm"
                                    >
                                        <option value="SAC">SAC (Amortização Constante)</option>
                                        <option value="Price">Price (Parcela Fixa)</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* 4. Custos Fixos */}
                         <div className="bg-gray-800 p-5 rounded-lg shadow border-l-4 border-yellow-500 space-y-4">
                            <h3 className="text-base font-semibold text-white border-b border-gray-700 pb-2">4. Manutenção e Reforma</h3>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Reforma</label>
                                    <MoneyInput 
                                        value={activeSim.custoReforma} 
                                        onChange={val => updateSim('custoReforma', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Desocupação</label>
                                    <MoneyInput 
                                        value={activeSim.custoDesocupacao} 
                                        onChange={val => updateSim('custoDesocupacao', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Condomínio (Mensal)</label>
                                    <MoneyInput 
                                        value={activeSim.condominioMensal} 
                                        onChange={val => updateSim('condominioMensal', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">IPTU (Anual)</label>
                                    <MoneyInput 
                                        value={activeSim.iptuAnual} 
                                        onChange={val => updateSim('iptuAnual', val)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-right"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RESULTS COLUMN */}
                    <div className="xl:col-span-8 flex flex-col space-y-6">
                        
                        {/* Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gray-800 p-4 rounded-lg shadow border-t-2 border-green-500">
                                <span className="text-xs text-gray-400 uppercase font-semibold">Lucro Líquido</span>
                                <div className={`text-2xl font-bold mt-1 ${baseResult.lucroLiquido >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatCurrencyBRL(baseResult.lucroLiquido)}
                                </div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded-lg shadow border-t-2 border-cyan-500">
                                <span className="text-xs text-gray-400 uppercase font-semibold">ROI Total</span>
                                <div className="text-2xl font-bold mt-1 text-cyan-400">
                                    {baseResult.roiTotal.toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded-lg shadow border-t-2 border-cyan-500">
                                <span className="text-xs text-gray-400 uppercase font-semibold">ROI Mensal</span>
                                <div className="text-2xl font-bold mt-1 text-cyan-400">
                                    {baseResult.roiMensal.toFixed(2)}%
                                </div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded-lg shadow border-t-2 border-yellow-500">
                                <span className="text-xs text-gray-400 uppercase font-semibold">Capital Investido</span>
                                <div className="text-2xl font-bold mt-1 text-yellow-400">
                                    {formatCurrencyBRL(baseResult.capitalInvestido)}
                                </div>
                            </div>
                        </div>

                        {/* Breakdown Chart */}
                         <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h4 className="text-sm font-semibold text-gray-300 mb-4">Detalhamento Financeiro</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-400 mb-4">
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>Com. Leiloeiro:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.comissaoLeiloeiro)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>ITBI:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.itbi)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>Registro/Escr.:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.cartorioTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>Prep/Holding:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.preparacaoTotal)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>Corretagem:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.comissaoCorretor)}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-700 pb-1">
                                    <span>Imposto Renda:</span>
                                    <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.impostoRenda)}</span>
                                </div>
                                {activeSim.tipoCompra === 'Financiado' && (
                                    <>
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Saldo Devedor (Quit.):</span>
                                            <span className="text-red-400">{formatCurrencyBRL(baseResult.breakdown.saldoDevedorQuitacao)}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Parcelas Pagas (Total):</span>
                                            <span className="text-white">{formatCurrencyBRL(baseResult.breakdown.totalPagoParcelas || 0)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* SENSITIVITY TABLE */}
                        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden flex-1 flex flex-col">
                            <div className="p-4 border-b border-gray-700 bg-gray-700/30">
                                <h3 className="text-lg font-bold text-white">Tabela de Lances</h3>
                                <p className="text-xs text-gray-400">Simulação variando o valor do lance em +{formatCurrencyBRL(activeSim.incrementoLance)}</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-400">
                                    <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3">Lance</th>
                                            <th className="px-6 py-3 text-right">Invest. Total</th>
                                            <th className="px-6 py-3 text-right">Lucro Líquido</th>
                                            <th className="px-6 py-3 text-right">ROI Total</th>
                                            <th className="px-6 py-3 text-right">ROI Mensal</th>
                                            <th className="px-6 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700">
                                        {sensitivityData.map((row, idx) => {
                                            let statusColor = 'text-red-500';
                                            let statusText = 'Inviável';
                                            
                                            if (row.roiTotal > 30) { 
                                                statusColor = 'text-cyan-400'; 
                                                statusText = 'Excelente'; 
                                            } else if (row.roiTotal >= 20) { 
                                                statusColor = 'text-green-400'; 
                                                statusText = 'Bom'; 
                                            }

                                            const isBase = idx === 0;

                                            return (
                                                <tr key={idx} className={`${isBase ? 'bg-gray-700/50' : 'hover:bg-gray-700'} transition-colors`}>
                                                    <td className="px-6 py-4 font-medium text-white flex items-center">
                                                        {formatCurrencyBRL(row.lance)}
                                                        {isBase && <span className="ml-2 px-2 py-0.5 rounded text-[10px] bg-cyan-900 text-cyan-200 border border-cyan-700">BASE</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {formatCurrencyBRL(row.capitalInvestido)}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-bold ${row.lucroLiquido > 0 ? 'text-white' : 'text-red-400'}`}>
                                                        {formatCurrencyBRL(row.lucroLiquido)}
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-bold ${row.roiTotal > 0 ? 'text-white' : 'text-red-400'}`}>
                                                        {row.roiTotal.toFixed(2)}%
                                                    </td>
                                                    <td className={`px-6 py-4 text-right font-bold ${row.roiMensal > 0 ? 'text-white' : 'text-red-400'}`}>
                                                        {row.roiMensal.toFixed(2)}%
                                                    </td>
                                                    <td className={`px-6 py-4 text-center font-bold ${statusColor}`}>
                                                        {statusText}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {sensitivityData.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-center py-8 text-gray-500">
                                                    Preencha o "Valor do Lance" para gerar a simulação.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Chart */}
                         <div className="bg-gray-800 p-6 rounded-lg shadow-lg h-64">
                            <h4 className="text-sm font-semibold text-gray-300 mb-4">Curva de ROI (%)</h4>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={sensitivityData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                    <XAxis dataKey="lance" tickFormatter={formatCurrencyBRL} stroke="#9ca3af" fontSize={10} />
                                    <YAxis yAxisId="left" stroke="#9ca3af" fontSize={10} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151' }}
                                        formatter={(value: number) => [`${value.toFixed(2)}%`, 'ROI Total']}
                                        labelFormatter={(label) => `Lance: ${formatCurrencyBRL(label)}`}
                                    />
                                    <ReferenceLine y={0} stroke="#6b7280" />
                                    <Bar yAxisId="left" dataKey="roiTotal" fill="#22d3ee" name="ROI Total" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};

export default CalculadoraViabilidade;