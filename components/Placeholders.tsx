import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { FinancialEntry, Cenario, Vendido } from '../types';
import { formatCurrencyBRL } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  LabelList
} from 'recharts';

// --- Shared Helper for Financial Calculations ---
// This logic replicates the "DataEntry" calculation engine to ensure consistency across pages
const useFinancialMetrics = (entries: FinancialEntry[]) => {
    
    // 1. Group by Imovel
    const properties = useMemo(() => {
        const groups: { [key: string]: FinancialEntry[] } = {};
        entries.forEach(e => {
            if (!groups[e.imovel]) groups[e.imovel] = [];
            groups[e.imovel].push(e);
        });
        return groups;
    }, [entries]);

    // 2. Calculate Metrics per Property per Scenario
    const processedData = useMemo(() => {
        return Object.keys(properties).map(imovel => {
            const propEntries = properties[imovel];
            const projectedEntries = propEntries.filter(e => e.cenario === 'Projetado');
            const executedEntriesRaw = propEntries.filter(e => e.cenario === 'Executado');
            
            // Check if sold based on Main Entry (usually in projected or executed)
            const mainEntry = propEntries.find(e => e.descricao === 'Venda' || e.descricao === 'Valor Aquisição') || propEntries[0];
            const isSold = mainEntry?.vendido === Vendido.Sim;
            const dataVenda = mainEntry?.dataVenda;
            const dataCompra = mainEntry?.dataCompra;
            // Get numCotistas with safe fallback
            const numCotistas = mainEntry?.numCotistas && mainEntry.numCotistas > 0 ? mainEntry.numCotistas : 1;

            const calculateScenario = (scenario: Cenario) => {
                // Inheritance Logic: If calculating Executed, and a field is missing, check Projected
                const getVal = (desc: string) => {
                    let entry = (scenario === 'Executado' ? executedEntriesRaw : projectedEntries).find(e => e.descricao === desc);
                    if (!entry && scenario === 'Executado') {
                        entry = projectedEntries.find(e => e.descricao === desc);
                    }
                    return entry ? Math.abs(entry.fluxoCaixa) : 0;
                };

                const getEntryObj = (desc: string) => {
                    let entry = (scenario === 'Executado' ? executedEntriesRaw : projectedEntries).find(e => e.descricao === desc);
                    if (!entry && scenario === 'Executado') {
                         entry = projectedEntries.find(e => e.descricao === desc);
                    }
                    return entry;
                }

                const valorVenda = getVal('Venda');
                const comissaoCorretor = getVal('Comissão Corretor');
                const impostoGanhoCapital = getVal('Imposto de Ganho de Capital');
                const saldoDevedor = getVal('Saldo Devedor');
                const entrada = getVal('Entrada');
                const itbi = getVal('ITBI');
                const registro = getVal('Registro');
                const despachante = getVal('Despachante');
                const comissaoLeiloeiro = getVal('Comissão Leiloeiro');
                const taxaFinanciamento = getVal('Taxa Financiamento/Escritura');
                const reforma = getVal('Reforma');
                const desocupacao = getVal('Desocupação');
                const divida = getVal('Dívida');
                const prestacao = getVal('Prestação');
                const condominio = getVal('Condomínio');
                const iptu = getVal('IPTU');

                const custosFixosOperacionais = itbi + registro + despachante + comissaoLeiloeiro + taxaFinanciamento + reforma + desocupacao + divida + prestacao + condominio + iptu;
                const capitalInvestido = entrada + custosFixosOperacionais;
                const lucroLiquidoOperacional = valorVenda - saldoDevedor - comissaoCorretor - impostoGanhoCapital - capitalInvestido;
                
                const roiTotal = capitalInvestido > 0 ? (lucroLiquidoOperacional / capitalInvestido) * 100 : 0;

                // Duration Calculation
                let durationMonths = 12; // Default for Projected
                if (scenario === 'Executado') {
                    const vendaEntry = getEntryObj('Venda');
                    if (vendaEntry?.tempoVendaMeses && vendaEntry.tempoVendaMeses > 0) {
                        durationMonths = vendaEntry.tempoVendaMeses;
                    } else if (dataCompra) {
                         const start = new Date(dataCompra);
                         const end = dataVenda ? new Date(dataVenda) : new Date();
                         const diffTime = Math.abs(end.getTime() - start.getTime());
                         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                         durationMonths = Math.max(1, diffDays / 30.44);
                    }
                }

                const roiDecimal = roiTotal / 100;
                const base = 1 + roiDecimal;
                let roiMensal = 0;
                if (base > 0) {
                    roiMensal = (Math.pow(base, 1 / durationMonths) - 1) * 100;
                } else {
                    roiMensal = -100; // Loss
                }

                return {
                    // CÁLCULO POR COTA: Divide o total operacional pelo número de cotistas
                    lucro: lucroLiquidoOperacional / numCotistas,
                    roi: roiTotal,
                    roiMensal: roiMensal,
                    capitalInvestido: capitalInvestido / numCotistas
                };
            };

            const proj = calculateScenario('Projetado');
            const exec = calculateScenario('Executado');

            return {
                imovel,
                isSold,
                dataVenda,
                proj,
                exec
            };
        });
    }, [properties]);

    return processedData;
};

const CustomTooltip: React.FC<any> = ({ active, payload, label, formatter }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-800 p-3 border border-gray-600 rounded-md shadow-xl z-50">
                <p className="font-bold text-gray-200 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {formatter ? formatter(entry.value) : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// --- Page 1: Projetado x Executado ---

export const ProjetadoExecutadoPage: React.FC = () => {
    const { entries } = useData();
    const allData = useFinancialMetrics(entries);

    // FILTER: Only show sold properties
    const data = useMemo(() => {
        return allData.filter(d => d.isSold);
    }, [allData]);

    const chartData = useMemo(() => {
        return data.map(d => ({
            name: d.imovel,
            'Lucro Projetado (Cota)': d.proj.lucro,
            'Lucro Executado (Cota)': d.exec.lucro,
            'ROI Projetado': parseFloat(d.proj.roi.toFixed(1)),
            'ROI Executado': parseFloat(d.exec.roi.toFixed(1)),
        })).sort((a,b) => b['Lucro Executado (Cota)'] - a['Lucro Executado (Cota)']);
    }, [data]);

    const totalStats = useMemo(() => {
        const totalProjProfit = data.reduce((acc, curr) => acc + curr.proj.lucro, 0);
        const totalExecProfit = data.reduce((acc, curr) => acc + curr.exec.lucro, 0);
        const avgProjRoi = data.reduce((acc, curr) => acc + curr.proj.roi, 0) / (data.length || 1);
        const avgExecRoi = data.reduce((acc, curr) => acc + curr.exec.roi, 0) / (data.length || 1);

        return { totalProjProfit, totalExecProfit, avgProjRoi, avgExecRoi };
    }, [data]);

    if (data.length === 0) {
        return (
             <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-white">Nenhum Imóvel Vendido</h2>
                    <p>O comparativo "Projetado x Executado" exibe apenas imóveis marcados como "Vendido: Sim".</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] bg-gray-900 p-6 animate-fade-in space-y-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Consolidado: Projetado x Executado (Vendidos)</h2>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-cyan-500">
                    <h3 className="text-sm font-medium text-gray-400">Total Lucro Projetado (Soma Cotas)</h3>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{formatCurrencyBRL(totalStats.totalProjProfit)}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                    <h3 className="text-sm font-medium text-gray-400">Total Lucro Executado (Soma Cotas)</h3>
                    <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrencyBRL(totalStats.totalExecProfit)}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-cyan-500">
                    <h3 className="text-sm font-medium text-gray-400">Média ROI (Projetado)</h3>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{totalStats.avgProjRoi.toFixed(1)}%</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                    <h3 className="text-sm font-medium text-gray-400">Média ROI (Executado)</h3>
                    <p className="text-2xl font-bold text-green-400 mt-1">{totalStats.avgExecRoi.toFixed(1)}%</p>
                 </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-white mb-4">Comparativo de Lucro (Por Cota)</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatCurrencyBRL} />
                                <Tooltip content={<CustomTooltip formatter={formatCurrencyBRL} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                <Legend />
                                <Bar dataKey="Lucro Projetado (Cota)" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Lucro Executado (Cota)" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-white mb-4">Comparativo de ROI (%)</h3>
                     <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(v) => `${v}%`} />
                                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v}%`} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                <Legend />
                                <Bar dataKey="ROI Projetado" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="ROI Executado" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Imóvel</th>
                            <th className="px-6 py-3 text-right">Lucro Proj. (Cota)</th>
                            <th className="px-6 py-3 text-right">Lucro Exec. (Cota)</th>
                            <th className="px-6 py-3 text-right">Dif. Lucro</th>
                            <th className="px-6 py-3 text-right">ROI Proj.</th>
                            <th className="px-6 py-3 text-right">ROI Exec.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {data.map((row) => {
                            const diff = row.exec.lucro - row.proj.lucro;
                            return (
                                <tr key={row.imovel} className="hover:bg-gray-700">
                                    <td className="px-6 py-3 font-medium text-white">{row.imovel}</td>
                                    <td className="px-6 py-3 text-right">{formatCurrencyBRL(row.proj.lucro)}</td>
                                    <td className="px-6 py-3 text-right">{formatCurrencyBRL(row.exec.lucro)}</td>
                                    <td className={`px-6 py-3 text-right font-bold ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrencyBRL(diff)}
                                    </td>
                                    <td className="px-6 py-3 text-right">{row.proj.roi.toFixed(1)}%</td>
                                    <td className="px-6 py-3 text-right">{row.exec.roi.toFixed(1)}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


// --- Page 2: Vendido ---

export const VendidoPage: React.FC = () => {
    const { entries } = useData();
    const allMetrics = useFinancialMetrics(entries);
    
    // Filter only Sold
    const soldMetrics = useMemo(() => allMetrics.filter(m => m.isSold), [allMetrics]);

    // Aggregate Stats
    const stats = useMemo(() => {
        const totalProfit = soldMetrics.reduce((acc, curr) => acc + curr.exec.lucro, 0);
        const avgTotalRoi = soldMetrics.reduce((acc, curr) => acc + curr.exec.roi, 0) / (soldMetrics.length || 1);
        const avgMonthlyRoi = soldMetrics.reduce((acc, curr) => acc + curr.exec.roiMensal, 0) / (soldMetrics.length || 1);
        
        return { totalProfit, avgTotalRoi, avgMonthlyRoi, count: soldMetrics.length };
    }, [soldMetrics]);

    // Charts Data: Profit by Year
    const profitByYear = useMemo(() => {
        const groups: {[key: string]: number} = {};
        soldMetrics.forEach(m => {
            const year = m.dataVenda ? m.dataVenda.substring(0, 4) : 'N/D';
            groups[year] = (groups[year] || 0) + m.exec.lucro;
        });
        return Object.entries(groups)
            .map(([year, profit]) => ({ year, profit }))
            .sort((a,b) => a.year.localeCompare(b.year));
    }, [soldMetrics]);

    // Charts Data: ROI by Property
    const roiByProperty = useMemo(() => {
        return soldMetrics.map(m => ({
            name: m.imovel,
            roi: parseFloat(m.exec.roi.toFixed(1)),
            monthlyRoi: parseFloat(m.exec.roiMensal.toFixed(2))
        })).sort((a, b) => b.roi - a.roi);
    }, [soldMetrics]);

    if (soldMetrics.length === 0) {
        return (
             <div className="flex items-center justify-center h-full text-gray-500 bg-gray-900">
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-2 text-white">Nenhum Imóvel Vendido</h2>
                    <p>Marque imóveis como "Vendido: Sim" na aba de Lançamentos para ver as estatísticas aqui.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] bg-gray-900 p-6 animate-fade-in space-y-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-4">Dashboard de Vendas</h2>

             {/* KPIs */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                    <h3 className="text-sm font-medium text-gray-400">Imóveis Vendidos</h3>
                    <p className="text-3xl font-bold text-white mt-1">{stats.count}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                    <h3 className="text-sm font-medium text-gray-400">Total Lucro Realizado (Soma Cotas)</h3>
                    <p className="text-3xl font-bold text-green-400 mt-1">{formatCurrencyBRL(stats.totalProfit)}</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-cyan-500">
                    <h3 className="text-sm font-medium text-gray-400">Média ROI Total</h3>
                    <p className="text-3xl font-bold text-cyan-400 mt-1">{stats.avgTotalRoi.toFixed(1)}%</p>
                 </div>
                 <div className="bg-gray-800 p-6 rounded-lg shadow border-l-4 border-cyan-500">
                    <h3 className="text-sm font-medium text-gray-400">Média ROI Mensal</h3>
                    <p className="text-3xl font-bold text-cyan-400 mt-1">{stats.avgMonthlyRoi.toFixed(2)}%</p>
                 </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profit per Year Chart */}
                 <div className="bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-white mb-4">Lucro Realizado por Ano (Cota)</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={profitByYear}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} />
                                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatCurrencyBRL} />
                                <Tooltip content={<CustomTooltip formatter={formatCurrencyBRL} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                <Bar dataKey="profit" name="Lucro (Cota)" fill="#34d399" radius={[4, 4, 0, 0]}>
                                     <LabelList dataKey="profit" position="top" fill="#ffffff" formatter={formatCurrencyBRL} fontSize={10} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ROI by Property Chart */}
                 <div className="bg-gray-800 p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold text-white mb-4">ROI por Imóvel Vendido</h3>
                    <div className="h-80">
                         <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={roiByProperty} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={100} />
                                <Tooltip content={<CustomTooltip formatter={(v: number) => `${v}%`} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                <Legend />
                                <Bar dataKey="roi" name="ROI Total (%)" fill="#22d3ee" barSize={20} radius={[0, 4, 4, 0]} />
                                <Line dataKey="monthlyRoi" name="ROI Mensal (%)" stroke="#fbbf24" strokeWidth={2} dot={{r:3}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
            
             {/* Detailed Table */}
             <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-300 uppercase bg-gray-700">
                        <tr>
                            <th className="px-6 py-3">Imóvel</th>
                            <th className="px-6 py-3">Data Venda</th>
                            <th className="px-6 py-3 text-right">Capital Investido (Cota)</th>
                            <th className="px-6 py-3 text-right">Lucro Líquido (Cota)</th>
                            <th className="px-6 py-3 text-right">ROI Total</th>
                            <th className="px-6 py-3 text-right">ROI Mensal</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {soldMetrics.map((row) => (
                            <tr key={row.imovel} className="hover:bg-gray-700">
                                <td className="px-6 py-3 font-medium text-white">{row.imovel}</td>
                                <td className="px-6 py-3">{row.dataVenda ? new Date(row.dataVenda).toLocaleDateString('pt-BR') : '-'}</td>
                                <td className="px-6 py-3 text-right">{formatCurrencyBRL(row.exec.capitalInvestido)}</td>
                                <td className="px-6 py-3 text-right font-bold text-green-400">{formatCurrencyBRL(row.exec.lucro)}</td>
                                <td className="px-6 py-3 text-right">{row.exec.roi.toFixed(1)}%</td>
                                <td className="px-6 py-3 text-right">{row.exec.roiMensal.toFixed(2)}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>
    );
};