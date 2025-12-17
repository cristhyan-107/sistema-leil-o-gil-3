import React, { useState, useMemo, useEffect, KeyboardEvent, FocusEvent, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { FinancialEntry, TipoCompra, TipoDespesa, Vendido, ESTADOS_BRASIL, FIELD_GROUPS, Cenario, StatusImovel } from '../types';
import { formatCurrencyBRL, parseCurrencyBRL } from '../utils/formatters';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';

interface ImovelListItemProps {
  imovel: string;
  status: StatusImovel;
  activeImovel: string | null;
  onSelect: (imovel: string) => void;
  onContextMenu: (e: React.MouseEvent, imovel: string, status: StatusImovel) => void;
  onDelete: (imovel: string) => void;
}

const ImovelListItem: React.FC<ImovelListItemProps> = React.memo(({ imovel, status, activeImovel, onSelect, onContextMenu, onDelete }) => (
  <div className="relative group">
      <button 
          onClick={() => onSelect(imovel)}
          onContextMenu={(e) => onContextMenu(e, imovel, status)}
          className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex justify-between items-center ${activeImovel === imovel ? 'bg-gray-700 text-cyan-400 border-l-4 border-cyan-500' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
      >
          <span className="truncate">{imovel}</span>
      </button>
      <button 
          onClick={(e) => { e.stopPropagation(); onDelete(imovel); }}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ${activeImovel === imovel ? 'opacity-100' : ''}`}
          title={`Excluir imóvel ${imovel}`}
      >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
      </button>
  </div>
));

type ViewMode = 'Projetado' | 'Executado' | 'Comparativo';

const CustomBarTooltip: React.FC<any> = ({ active, payload, label, formatter }) => {
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

const DataEntry: React.FC = () => {
  const { entries, addEntry, updateEntry, deleteEntriesByImovel, restoreEntries, duplicateImovel, updateImovelStatus, renameImovelGlobal } = useData();
  
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ entries: FinancialEntry[], imovelName: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, imovel: string, currentStatus: StatusImovel } | null>(null);

  // Sidebar Collapsible State
  const [isEmAndamentoOpen, setIsEmAndamentoOpen] = useState(true);
  const [isFinalizadosOpen, setIsFinalizadosOpen] = useState(true);

  // State for business logic (Percentages)
  const [itbiPercent, setItbiPercent] = useState(2);
  const [entradaPercentFinanciado, setEntradaPercentFinanciado] = useState(5);
  const [ganhoCapitalPercent, setGanhoCapitalPercent] = useState(15);
  const [comissaoCorretorPercent, setComissaoCorretorPercent] = useState(5);
  const [comissaoLeiloeiroPercent, setComissaoLeiloeiroPercent] = useState(5);

  // Financial Simulation State
  const [taxaJurosAnual, setTaxaJurosAnual] = useState(9.5);
  const [prazoMeses, setPrazoMeses] = useState(360);
  const [sistemaAmortizacao, setSistemaAmortizacao] = useState<'SAC' | 'Price'>('SAC');

  // Removed volatile `overriddenFields` state in favor of persistent `manualOverride` in data.
  const [monthlyInputs, setMonthlyInputs] = useState<{ [key: string]: string }>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // View State (Replaces simple activeScenario)
  const [viewMode, setViewMode] = useState<ViewMode>('Projetado');
  
  // Derived activeScenario for logic compatibility
  const activeScenario: Cenario = viewMode === 'Comparativo' ? 'Executado' : viewMode;

  // Logic to separate properties by status
  const imoveisData = useMemo(() => {
    const map = new Map<string, StatusImovel>();
    entries.forEach(e => {
        const status = e.statusImovel || 'em_andamento';
        map.set(e.imovel, status);
    });
    
    const emAndamento: string[] = [];
    const finalizados: string[] = [];

    map.forEach((status, imovel) => {
        if (status === 'finalizado') {
            finalizados.push(imovel);
        } else {
            emAndamento.push(imovel);
        }
    });

    return {
        all: Array.from(map.keys()).sort(),
        emAndamento: emAndamento.sort(),
        finalizados: finalizados.sort()
    };
  }, [entries]);

  const [activeImovel, setActiveImovel] = useState<string | null>(null);
  
  useEffect(() => {
    if (!activeImovel) {
        if (imoveisData.all.includes('ma1')) {
            setActiveImovel('ma1');
        } else if (imoveisData.all.length > 0) {
            setActiveImovel(imoveisData.all[0]);
        }
    } else if (!imoveisData.all.includes(activeImovel) && imoveisData.all.length > 0) {
        setActiveImovel(imoveisData.all[0]);
    } else if (imoveisData.all.length === 0) {
        setActiveImovel(null);
    }
  }, [imoveisData.all, activeImovel]);


  const activeImovelEntries = useMemo(() => {
    if (!activeImovel) return [];
    return entries.filter(e => e.imovel === activeImovel && e.cenario === activeScenario);
  }, [entries, activeImovel, activeScenario]);

  // NEW: Get Projected entries to support replication logic
  const projectedEntries = useMemo(() => {
    if (!activeImovel) return [];
    return entries.filter(e => e.imovel === activeImovel && e.cenario === 'Projetado');
  }, [entries, activeImovel]);

  // General Property Info 
  const activeImovelData = useMemo(() => {
    // 1. Try to find the main entry for the current scenario
    if (activeImovelEntries.length > 0) {
      const mainEntry = activeImovelEntries[0];
      
      // SYNC DATE LOGIC: If Executed, force dataCompra to be same as Projected
      let dataCompra = mainEntry.dataCompra;
      if (activeScenario === 'Executado') {
          const proj = projectedEntries.find(p => p.dataCompra);
          if (proj && proj.dataCompra) {
              dataCompra = proj.dataCompra;
          }
      }

      return {
        ...mainEntry,
        dataCompra: dataCompra ? dataCompra.split('T')[0] : new Date().toISOString().split('T')[0],
        dataVenda: mainEntry.dataVenda ? mainEntry.dataVenda.split('T')[0] : undefined,
      };
    }
    
    // 2. If no entries in current scenario (e.g. Empty Executed), inherit from Projected
    if (activeScenario === 'Executado' && activeImovel) {
        const proj = projectedEntries[0]; // Base info from any projected entry
        if (proj) {
             return {
                imovel: activeImovel,
                estado: proj.estado,
                cidade: proj.cidade,
                tipoCompra: proj.tipoCompra,
                vendido: proj.vendido,
                numCotistas: proj.numCotistas,
                dataCompra: proj.dataCompra ? proj.dataCompra.split('T')[0] : new Date().toISOString().split('T')[0],
                dataVenda: undefined,
                cenario: 'Executado',
                statusImovel: proj.statusImovel
             };
        }
    }

    return {
      imovel: activeImovel || '',
      estado: 'SP',
      cidade: '',
      tipoCompra: TipoCompra.AVista,
      vendido: Vendido.Nao,
      numCotistas: 1,
      dataCompra: new Date().toISOString().split('T')[0],
      dataVenda: undefined,
      cenario: activeScenario,
      statusImovel: 'em_andamento' as StatusImovel
    };
  }, [activeImovelEntries, activeImovel, activeScenario, entries, projectedEntries]);
  
  const [imovelNameInput, setImovelNameInput] = useState(activeImovelData.imovel);

  useEffect(() => {
    setImovelNameInput(activeImovelData.imovel);
  }, [activeImovelData.imovel]);
  
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    return () => {
        if(undoTimerRef.current) {
            clearTimeout(undoTimerRef.current)
        }
    }
  }, []);

  // LOAD DATA and Defaults on Tab/Imovel Change
  useEffect(() => {
    setMonthlyInputs({});

    // We fetch directly from 'entries' to avoid dependency loop with activeImovelEntries
    const currentEntries = entries.filter(e => e.imovel === activeImovel && e.cenario === activeScenario);
    
    // Helper to fetch defaults from Projected if in Executado
    const projectedEntriesForDefaults = entries.filter(e => e.imovel === activeImovel && e.cenario === 'Projetado');

    // 1. Load Simulation Data (Standard)
    // Try to find in current scenario
    let simEntry = currentEntries.find(e => e.descricao === 'Valor Aquisição') || currentEntries.find(e => e.taxaJurosAnual !== undefined);
    
    // If not found and we are in Executado, try Projected (Inheritance)
    if (!simEntry && activeScenario === 'Executado') {
        simEntry = projectedEntriesForDefaults.find(e => e.descricao === 'Valor Aquisição') || projectedEntriesForDefaults.find(e => e.taxaJurosAnual !== undefined);
    }

    if (simEntry) {
        setTaxaJurosAnual(simEntry.taxaJurosAnual ?? 9.5);
        setPrazoMeses(simEntry.prazoMeses ?? 360);
        setSistemaAmortizacao(simEntry.sistemaAmortizacao ?? 'SAC');
    } else {
        setTaxaJurosAnual(9.5);
        setPrazoMeses(360);
        setSistemaAmortizacao('SAC');
    }

    // 2. Load Percentages from specific entries if available, otherwise default
    const getPercent = (desc: string, defaultVal: number) => {
        let e = currentEntries.find(x => x.descricao === desc);
        // Fallback to Projected if in Executado and not set locally (Inheritance)
        if (!e && activeScenario === 'Executado') {
             e = projectedEntriesForDefaults.find(x => x.descricao === desc);
        }
        return e && e.percentual !== undefined ? e.percentual : defaultVal;
    };

    setItbiPercent(getPercent('ITBI', 2));
    setComissaoCorretorPercent(getPercent('Comissão Corretor', 5));
    setComissaoLeiloeiroPercent(getPercent('Comissão Leiloeiro', 5));
    setEntradaPercentFinanciado(getPercent('Entrada', 5));
    setGanhoCapitalPercent(getPercent('Imposto de Ganho de Capital', 15));

  }, [activeImovel, activeScenario]); 
  
  const handleValueChange = useCallback((
    tipoDespesa: TipoDespesa,
    descricao: string,
    newValue: number,
    options: { isAutomatic?: boolean; newPercentual?: number } = {}
  ) => {
    if (!activeImovel) return;

    const entry = activeImovelEntries.find(e => e.descricao === descricao);
    const numCotistas = activeImovelData.numCotistas || 1;
    
    let fluxoCaixa = -Math.abs(newValue);
    if (tipoDespesa === TipoDespesa.Venda && descricao === 'Venda') {
      fluxoCaixa = Math.abs(newValue);
    }
    
    const cota = fluxoCaixa / numCotistas;

    let manualOverride = entry?.manualOverride;
    if (!options.isAutomatic) {
        manualOverride = true;
    } else if (options.newPercentual !== undefined) {
        manualOverride = false;
    }

    const updatePayload: Partial<FinancialEntry> = {
        fluxoCaixa,
        cota,
        numCotistas,
        manualOverride,
    };

    if (options.newPercentual !== undefined) {
        updatePayload.percentual = options.newPercentual;
    }

    if (entry) {
      updateEntry({ ...entry, ...updatePayload });
    } else {
      const newEntry: Omit<FinancialEntry, 'id'> = {
        ...activeImovelData,
        imovel: activeImovel,
        tipoDespesa,
        descricao,
        fluxoCaixa,
        cota,
        numCotistas,
        cenario: activeScenario,
        manualOverride,
        percentual: options.newPercentual
      };
      addEntry(newEntry);
    }
  }, [activeImovel, activeImovelData, activeImovelEntries, addEntry, updateEntry, activeScenario]);

  // NEW: Handler for Tempo Venda Manual Change
  const handleTempoVendaChange = (val: number) => {
      const entry = activeImovelEntries.find(e => e.descricao === 'Venda');
      if (entry) {
          updateEntry({ ...entry, tempoVendaMeses: val });
      } else {
           // Create entry if doesn't exist (rare case for Venda in executed but logical)
           const newEntry: Omit<FinancialEntry, 'id'> = {
            ...activeImovelData,
            imovel: activeImovel!,
            tipoDespesa: TipoDespesa.Venda,
            descricao: 'Venda',
            fluxoCaixa: 0,
            cota: 0,
            numCotistas: activeImovelData.numCotistas || 1,
            cenario: activeScenario,
            tempoVendaMeses: val
          };
          addEntry(newEntry);
      }
  };

    // Auto-Calculate Months when Dates Change (Executed Scenario Only)
    useEffect(() => {
        if (activeScenario !== 'Executado' || !activeImovelData.dataCompra || !activeImovelData.dataVenda) return;
        
        const dCompra = new Date(activeImovelData.dataCompra);
        const dVenda = new Date(activeImovelData.dataVenda);

        if (!isNaN(dCompra.getTime()) && !isNaN(dVenda.getTime())) {
            const diffTime = dVenda.getTime() - dCompra.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            const diffMonths = parseFloat((diffDays / 30.4375).toFixed(2));
            
            const vendaEntry = activeImovelEntries.find(e => e.descricao === 'Venda');
            
            if (vendaEntry) {
                 // Check to avoid loops (with small tolerance for floats)
                 if (vendaEntry.tempoVendaMeses === undefined || Math.abs(vendaEntry.tempoVendaMeses - diffMonths) > 0.01) {
                     updateEntry({ ...vendaEntry, tempoVendaMeses: diffMonths });
                 }
            } else {
                 // Entry doesn't exist yet, create it with the calculated time
                 // This handles the case where "Venda" amount hasn't been entered yet but dates have
                 const newEntry: Omit<FinancialEntry, 'id'> = {
                    ...activeImovelData,
                    imovel: activeImovel!,
                    tipoDespesa: TipoDespesa.Venda,
                    descricao: 'Venda',
                    fluxoCaixa: 0,
                    cota: 0,
                    numCotistas: activeImovelData.numCotistas || 1,
                    cenario: activeScenario,
                    tempoVendaMeses: diffMonths
                  };
                  addEntry(newEntry);
            }
        }

    }, [activeImovelData.dataCompra, activeImovelData.dataVenda, activeScenario, activeImovelEntries, updateEntry, activeImovel, activeImovelData, addEntry]);

  // NEW: Handler for Simulation changes (SAC/Price/Juros)
  const handleSimulationChange = (key: 'taxaJurosAnual' | 'prazoMeses' | 'sistemaAmortizacao', value: any) => {
      // 1. Update Local State
      if (key === 'taxaJurosAnual') setTaxaJurosAnual(value);
      if (key === 'prazoMeses') setPrazoMeses(value);
      if (key === 'sistemaAmortizacao') setSistemaAmortizacao(value);

      if (!activeImovel) return;

      // 2. RESET MANUAL OVERRIDES for dependent fields
      // If the user changes simulation parameters, they likely want the Prestação/Saldo to update automatically again.
      const resetOverrides = (desc: string) => {
          const entry = activeImovelEntries.find(e => e.descricao === desc);
          if (entry && entry.manualOverride) {
              updateEntry({ ...entry, manualOverride: false });
          }
      };
      
      resetOverrides('Prestação');
      resetOverrides('Saldo Devedor');

      // 3. Persist Simulation Data
      const existingEntry = activeImovelEntries.find(e => e.descricao === 'Valor Aquisição');

      if (existingEntry) {
          updateEntry({ ...existingEntry, [key]: value });
      } else {
          const newEntry: Omit<FinancialEntry, 'id'> = {
            ...activeImovelData,
            imovel: activeImovel,
            tipoDespesa: TipoDespesa.CustoAquisicao,
            descricao: 'Valor Aquisição',
            fluxoCaixa: 0,
            cota: 0,
            numCotistas: activeImovelData.numCotistas || 1,
            cenario: activeScenario,
            [key]: value
          };
          addEntry(newEntry);
      }
  };

  // Helper to update percentages
  const handlePercentChange = (
      type: 'ITBI' | 'Corretor' | 'Leiloeiro' | 'Entrada' | 'GanhoCapital',
      percent: number,
      targetField: string,
      targetGroupType: TipoDespesa,
      baseValue: number
  ) => {
      // 1. Update State
      if (type === 'ITBI') setItbiPercent(percent);
      if (type === 'Corretor') setComissaoCorretorPercent(percent);
      if (type === 'Leiloeiro') setComissaoLeiloeiroPercent(percent);
      if (type === 'Entrada') setEntradaPercentFinanciado(percent);
      if (type === 'GanhoCapital') setGanhoCapitalPercent(percent);

      // 2. Trigger Calculation & Persist (Automatic update + percent save)
      // This explicitly sets manualOverride to false inside handleValueChange logic
      if (baseValue > 0) {
          handleValueChange(targetGroupType, targetField, baseValue * (percent / 100), { isAutomatic: true, newPercentual: percent });
      } else {
          // Even if base is 0, we want to save the percentage preference
           handleValueChange(targetGroupType, targetField, 0, { isAutomatic: true, newPercentual: percent });
      }
  };


  // Main calculation engine
  useEffect(() => {
    if (!activeImovel || !activeImovelData) return;

    const getEntry = (descricao: string) => activeImovelEntries.find(e => e.descricao === descricao);
    
    // UPDATED HELPER: Incorporate Projection Fallback logic inside calculation engine
    const getEntryValue = (descricao: string) => {
        let entry = getEntry(descricao);
        // If entry missing in Executed, try to find in Projected
        if (!entry && activeScenario === 'Executado') {
            entry = projectedEntries.find(e => e.descricao === descricao);
        }
        return entry ? Math.abs(entry.fluxoCaixa) : 0;
    };

    const checkAndUpdate = (tipoDespesa: TipoDespesa, descricao: string, calculatedValue: number) => {
        const entry = getEntry(descricao);
        
        // CRITICAL: Prevent overwrite if manual override is active
        if (entry?.manualOverride) return;

        const currentValue = entry ? Math.abs(entry.fluxoCaixa) : 0;
        if (Math.abs(currentValue - calculatedValue) > 0.01) {
            handleValueChange(tipoDespesa, descricao, calculatedValue, { isAutomatic: true });
        }
    };
    
    const vendaValue = getEntryValue('Venda');
    const entradaValue = getEntryValue('Entrada');
    const valorAquisicaoValue = getEntryValue('Valor Aquisição');
    // const saldoDevedorValue = getEntryValue('Saldo Devedor');
    // const desocupacaoValue = getEntryValue('Desocupação');
    const reformaValue = getEntryValue('Reforma');
    const despachanteValue = getEntryValue('Despachante');
    
    const isAVista = activeImovelData.tipoCompra === TipoCompra.AVista;
    const isFinanciado = activeImovelData.tipoCompra === TipoCompra.Financiado;

    const baseAquisicao = isFinanciado ? valorAquisicaoValue : entradaValue;

    // Universal calculations
    if (vendaValue > 0) {
        checkAndUpdate(TipoDespesa.Venda, 'Comissão Corretor', vendaValue * (comissaoCorretorPercent / 100));
        
        checkAndUpdate(TipoDespesa.CustoAquisicao, 'Registro', vendaValue * 0.01);
        checkAndUpdate(TipoDespesa.CustoAquisicao, 'Taxa Financiamento/Escritura', vendaValue * 0.01);
    }

    if (baseAquisicao > 0) {
        checkAndUpdate(TipoDespesa.CustoAquisicao, 'ITBI', baseAquisicao * (itbiPercent / 100));
    }

    if (isAVista) {
        if (entradaValue > 0) {
             checkAndUpdate(TipoDespesa.CustoAquisicao, 'Comissão Leiloeiro', entradaValue * (comissaoLeiloeiroPercent / 100));
        }
        
        const comissaoCorretorValue = getEntryValue('Comissão Corretor');
        const itbiValue = getEntryValue('ITBI');
        const registroValue = getEntryValue('Registro');
        const comissaoLeiloeiroValue = getEntryValue('Comissão Leiloeiro');
        const taxaFinanciamentoValue = getEntryValue('Taxa Financiamento/Escritura');

        const totalCostsForTax = comissaoCorretorValue + entradaValue + itbiValue + registroValue + despachanteValue + comissaoLeiloeiroValue + taxaFinanciamentoValue + reformaValue;
        const capitalGainBase = vendaValue - totalCostsForTax;
        const tax = capitalGainBase > 0 ? capitalGainBase * (ganhoCapitalPercent / 100) : 0;
        
        checkAndUpdate(TipoDespesa.Venda, 'Imposto de Ganho de Capital', tax);

    } else if (isFinanciado) {
        if (valorAquisicaoValue > 0) {
            checkAndUpdate(TipoDespesa.CustoAquisicao, 'Entrada', valorAquisicaoValue * (entradaPercentFinanciado / 100));
            checkAndUpdate(TipoDespesa.CustoAquisicao, 'Comissão Leiloeiro', valorAquisicaoValue * (comissaoLeiloeiroPercent / 100));

            // === CÁLCULO DE SIMULAÇÃO FINANCEIRA ===
            const principal = valorAquisicaoValue - entradaValue;
            
            if (principal > 0 && prazoMeses > 0) {
                const taxaMensal = (taxaJurosAnual / 100) / 12;
                let prestacaoMensal = 0;
                let saldoDevedor12Meses = 0;

                if (sistemaAmortizacao === 'SAC') {
                    // SAC
                    const amortizacao = principal / prazoMeses;
                    const juros = principal * taxaMensal;
                    prestacaoMensal = amortizacao + juros;
                    const amortizadoEm12 = amortizacao * 12;
                    saldoDevedor12Meses = principal - amortizadoEm12;
                } else {
                    // Price
                    const fatorN = Math.pow(1 + taxaMensal, prazoMeses);
                    if (fatorN > 1) { 
                         prestacaoMensal = principal * ((taxaMensal * fatorN) / (fatorN - 1));
                         const fatorK = Math.pow(1 + taxaMensal, 12);
                         saldoDevedor12Meses = principal * ((fatorN - fatorK) / (fatorN - 1));
                    }
                }

                // Prestação
                // Only update monthlyInputs if the value in data changed (to avoid fighting user input if it was manual)
                const entryPrestacao = getEntry('Prestação');
                // The check logic inside checkAndUpdate handles manualOverride, but we also need to sync UI state 'monthlyInputs'
                // if the calc updates.
                if (!entryPrestacao?.manualOverride) {
                     const currentPrestacao = entryPrestacao ? Math.abs(entryPrestacao.fluxoCaixa) / 12 : 0;
                     if (Math.abs(currentPrestacao - prestacaoMensal) > 0.01) {
                         setMonthlyInputs(prev => ({...prev, 'Prestação': formatCurrencyBRL(prestacaoMensal)}));
                         checkAndUpdate(TipoDespesa.CustoManutencao, 'Prestação', prestacaoMensal * 12);
                     }
                }

                checkAndUpdate(TipoDespesa.Venda, 'Saldo Devedor', saldoDevedor12Meses > 0 ? saldoDevedor12Meses : 0);
            }
        }

        const comissaoCorretorValue = getEntryValue('Comissão Corretor');
        const comissaoLeiloeiroValue = getEntryValue('Comissão Leiloeiro');
        const itbiValue = getEntryValue('ITBI');
        const registroValue = getEntryValue('Registro');
        const taxaFinanciamentoValue = getEntryValue('Taxa Financiamento/Escritura');
        
        // CORRECTION: 'desocupacaoValue' removed from deductible costs for Tax Calculation
        const totalCustosDedutiveis = valorAquisicaoValue + comissaoCorretorValue + 
                         comissaoLeiloeiroValue + itbiValue + registroValue + despachanteValue +
                         taxaFinanciamentoValue + reformaValue;
        
        const baseCalculo = vendaValue - totalCustosDedutiveis;
        const taxFinanciado = baseCalculo > 0 ? baseCalculo * (ganhoCapitalPercent / 100) : 0;

        checkAndUpdate(TipoDespesa.Venda, 'Imposto de Ganho de Capital', taxFinanciado);
    }
  }, [activeImovel, activeImovelData, activeImovelEntries, itbiPercent, entradaPercentFinanciado, ganhoCapitalPercent, comissaoCorretorPercent, comissaoLeiloeiroPercent, handleValueChange, taxaJurosAnual, prazoMeses, sistemaAmortizacao, projectedEntries]);


  // EXTRACTED SUMMARY LOGIC for Reuse in Comparison
  const calculateScenarioSummary = (scenarioEntries: FinancialEntry[], scenarioType: Cenario) => {
    // Inheritance logic for Summary
    const getEntryValue = (descricao: string) => {
        let entry = scenarioEntries.find(e => e.descricao === descricao);
        if (!entry && scenarioType === 'Executado') {
             entry = projectedEntries.find(e => e.descricao === descricao);
        }
        return entry ? Math.abs(entry.fluxoCaixa) : 0;
    };

    const getEntryObject = (descricao: string) => {
        return scenarioEntries.find(e => e.descricao === descricao);
    };
    
    const valorVenda = getEntryValue('Venda');
    const comissaoCorretor = getEntryValue('Comissão Corretor');
    const impostoGanhoCapital = getEntryValue('Imposto de Ganho de Capital');
    const saldoDevedor = getEntryValue('Saldo Devedor');
    const entrada = getEntryValue('Entrada');
    const itbi = getEntryValue('ITBI');
    const registro = getEntryValue('Registro');
    const despachante = getEntryValue('Despachante');
    const comissaoLeiloeiro = getEntryValue('Comissão Leiloeiro');
    const taxaFinanciamento = getEntryValue('Taxa Financiamento/Escritura');
    const reforma = getEntryValue('Reforma');
    const desocupacao = getEntryValue('Desocupação');
    const divida = getEntryValue('Dívida');
    const prestacao = getEntryValue('Prestação');
    const condominio = getEntryValue('Condomínio');
    const iptu = getEntryValue('IPTU');
    
    const custosFixosOperacionais = 
        itbi +
        registro +
        despachante +
        comissaoLeiloeiro +
        taxaFinanciamento +
        reforma +
        desocupacao +
        divida +
        prestacao +
        condominio +
        iptu;

    const capitalInvestido = entrada + custosFixosOperacionais;

    const lucroLiquidoOperacional = valorVenda - saldoDevedor - comissaoCorretor - impostoGanhoCapital - capitalInvestido;
    
    const roiTotal = capitalInvestido > 0 ? (lucroLiquidoOperacional / capitalInvestido) * 100 : 0;
    
    // ROI Mensal Calculation
    let durationMonths = 1;

    if (scenarioType === 'Projetado') {
        durationMonths = 12; // FIXED: ROI mensal para Projetado sempre 12 meses
    } else {
        // Check for manual "Tempo Venda" override in Venda entry (Executed scenario)
        const vendaEntry = getEntryObject('Venda');
        if (scenarioType === 'Executado' && vendaEntry?.tempoVendaMeses && vendaEntry.tempoVendaMeses > 0) {
            durationMonths = vendaEntry.tempoVendaMeses;
        } else if (activeImovelData.dataCompra) {
            // Fallback for Executed without manual override
            const startDate = new Date(activeImovelData.dataCompra);
            const endDate = activeImovelData.dataVenda ? new Date(activeImovelData.dataVenda) : new Date();
            const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
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
        roiMensal = -100;
    }

    const numCotistas = activeImovelData.numCotistas || 1;
    const lucroPorCota = lucroLiquidoOperacional / numCotistas;

    return { 
        lucroTotal: lucroLiquidoOperacional, 
        roiTotal, 
        roiMensal, 
        lucroPorCota,
        details: {
            valorVenda,
            capitalInvestido,
            custos: {
                comissaoCorretor,
                impostoGanhoCapital,
                saldoDevedor,
                entrada,
                reforma,
                desocupacao,
                condominio,
                iptu,
                itbi,
                registro,
                despachante,
                taxaFinanciamento,
                custosFixosOperacionais
            }
        }
    };
  };

  const summary = useMemo(() => {
     if (!activeImovel) return { lucroTotal: 0, roiTotal: 0, roiMensal: 0, lucroPorCota: 0 };
     return calculateScenarioSummary(activeImovelEntries, activeScenario);
  }, [activeImovel, activeImovelEntries, activeScenario, projectedEntries, activeImovelData]);

  // NEW: COMPARISON DATA FOR CHARTS
  const comparisonCharts = useMemo(() => {
      if (!activeImovel) return null;
      
      const executedEntries = entries.filter(e => e.imovel === activeImovel && e.cenario === 'Executado');
      const proj = calculateScenarioSummary(projectedEntries, 'Projetado');
      const exec = calculateScenarioSummary(executedEntries, 'Executado');
      
      // Chart 1: ROI
      const roiData = [
          { name: 'ROI Total', Projetado: parseFloat(proj.roiTotal.toFixed(1)), Executado: parseFloat(exec.roiTotal.toFixed(1)) },
          { name: 'ROI Mensal', Projetado: parseFloat(proj.roiMensal.toFixed(2)), Executado: parseFloat(exec.roiMensal.toFixed(2)) }
      ];

      // Chart 2: Profit per Share
      const profitData = [
          { name: 'Lucro Cota', Projetado: proj.lucroPorCota, Executado: exec.lucroPorCota },
      ];

      // Chart 3: Expenses Comparison (Reforma vs Cartorio/Impostos)
      // "Despesas Cartório + Imposto" = ITBI + Registro + Despachante + Taxa Finan + Imposto Ganho Capital
      const bureauCostsProj = proj.details.custos.itbi + proj.details.custos.registro + proj.details.custos.despachante + proj.details.custos.taxaFinanciamento + proj.details.custos.impostoGanhoCapital;
      const bureauCostsExec = exec.details.custos.itbi + exec.details.custos.registro + exec.details.custos.despachante + exec.details.custos.taxaFinanciamento + exec.details.custos.impostoGanhoCapital;

      const expenseData = [
          { name: 'Reforma', Projetado: proj.details.custos.reforma, Executado: exec.details.custos.reforma },
          { name: 'Cartório + Impostos', Projetado: bureauCostsProj, Executado: bureauCostsExec },
      ];

      return { roiData, profitData, expenseData };

  }, [activeImovel, entries, projectedEntries]);


  const handleAddImovel = () => {
    let newImovelName = "Novo Imóvel";
    let counter = 2;
    while (imoveisData.all.includes(newImovelName)) {
        newImovelName = `Novo Imóvel ${counter}`;
        counter++;
    }

    const newEntry: Omit<FinancialEntry, 'id'> = {
        imovel: newImovelName,
        estado: 'SP',
        cidade: '',
        tipoCompra: TipoCompra.AVista,
        vendido: Vendido.Nao,
        numCotistas: 1,
        fluxoCaixa: 0,
        tipoDespesa: TipoDespesa.CustoAquisicao,
        descricao: 'Entrada', 
        cota: 0,
        dataCompra: new Date().toISOString().split('T')[0],
        cenario: 'Projetado',
        statusImovel: 'em_andamento'
    };
    
    addEntry(newEntry);
    setActiveImovel(newImovelName);
    setViewMode('Projetado');
  };

 const handleDeleteImovel = (imovelToDelete: string) => {
    const entriesToDelete = entries.filter(e => e.imovel === imovelToDelete);
    setRecentlyDeleted({ entries: entriesToDelete, imovelName: imovelToDelete });

    const currentIndex = imoveisData.all.indexOf(imovelToDelete);
    const remainingImoveis = imoveisData.all.filter(i => i !== imovelToDelete);
    let nextActiveImovel = null;

    if (remainingImoveis.length > 0) {
        const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        nextActiveImovel = remainingImoveis[nextIndex];
    }
    
    deleteEntriesByImovel(imovelToDelete);
    setActiveImovel(nextActiveImovel);
    
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
        setRecentlyDeleted(null); 
        undoTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (recentlyDeleted) {
        restoreEntries(recentlyDeleted.entries);
        setActiveImovel(recentlyDeleted.imovelName);
        setRecentlyDeleted(null);
        if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current);
            undoTimerRef.current = null;
        }
    }
  };
  
  const handleRenameImovel = (e?: FocusEvent | KeyboardEvent) => {
    if (e && e.target) (e.target as HTMLInputElement).blur();
    const oldName = activeImovel;
    const newName = imovelNameInput.trim();

    if (!oldName || !newName || oldName === newName) {
        setImovelNameInput(oldName || ''); 
        return; 
    }
    if (imoveisData.all.includes(newName)) {
        alert("Já existe um imóvel com este nome.");
        setImovelNameInput(oldName);
        return;
    }

    renameImovelGlobal(oldName, newName);
    setActiveImovel(newName);
  };

  const handlePropertyDataChange = (field: keyof FinancialEntry, value: any) => {
    if (!activeImovel) return;
    
    // Changing TipoCompra resets overrides implicitly because fields disappear/reappear, but logic below handles data structure
    
    const updates: Partial<FinancialEntry> = { [field]: value };
  
    if (field === 'dataCompra' && value) {
      try {
        const purchaseDate = new Date(value + 'T00:00:00');
        if (!isNaN(purchaseDate.getTime())) {
          purchaseDate.setFullYear(purchaseDate.getFullYear() + 1);
          updates.dataVenda = purchaseDate.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error("Error calculating sale date:", e);
      }
    }
  
    const allPropertyEntries = entries.filter(e => e.imovel === activeImovel);
    
    allPropertyEntries.forEach(entry => {
      let updatedEntry = { ...entry, ...updates };
      if (field === 'numCotistas' || (updates.hasOwnProperty('numCotistas') && updates.numCotistas)) {
        const numCotistas = Number(updates.numCotistas || entry.numCotistas) || 1;
        updatedEntry.cota = entry.fluxoCaixa / numCotistas;
      }
      updateEntry(updatedEntry);
    });
  
    if (allPropertyEntries.length === 0) {
      const newEntry: Omit<FinancialEntry, 'id'> = {
        imovel: activeImovel,
        estado: activeImovelData.estado || 'SP',
        cidade: activeImovelData.cidade || '',
        tipoCompra: activeImovelData.tipoCompra || TipoCompra.AVista,
        vendido: activeImovelData.vendido || Vendido.Nao,
        numCotistas: activeImovelData.numCotistas || 1,
        fluxoCaixa: 0,
        tipoDespesa: TipoDespesa.CustoAquisicao,
        descricao: 'placeholder',
        cota: 0,
        cenario: activeScenario,
        statusImovel: activeImovelData.statusImovel,
        ...updates
      };
      addEntry(newEntry);
    }
  };
  
  const isFieldManual = (field: string): boolean => {
      // Logic for styling: check if the entry has manual override
      const entry = activeImovelEntries.find(e => e.descricao === field);
      return !!entry?.manualOverride;
  };

  const shouldHighlight = (field: string): boolean => {
      const highlightedFields = ["Venda", "Entrada", "Reforma", "Desocupação", "Dívida", "Condomínio", "IPTU", "Valor Aquisição"];
      if (highlightedFields.includes(field)) return true;
      return false;
  };
  
  const handleContextMenu = (e: React.MouseEvent, imovel: string, currentStatus: StatusImovel) => {
      e.preventDefault();
      setContextMenu({
          x: e.clientX,
          y: e.clientY,
          imovel: imovel,
          currentStatus: currentStatus
      });
  };

  const handleDuplicate = () => {
      if (contextMenu) {
          const newName = duplicateImovel(contextMenu.imovel);
          setActiveImovel(newName);
          setContextMenu(null);
      }
  };

  const handleMoveCategory = (newStatus: StatusImovel) => {
      if (contextMenu) {
          updateImovelStatus(contextMenu.imovel, newStatus);
          setContextMenu(null);
      }
  };

  // Helper icons for Accordion
  const ChevronDown = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
  
  const ChevronRight = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );


  return (
    <div className="flex h-full animate-fade-in">
        {/* Left Sidebar - Property List */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-gray-700">
                 <button 
                    onClick={handleAddImovel}
                    className="w-full px-3 py-2 text-sm font-medium bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors"
                >
                    + Novo Imóvel
                </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-4">
                
                {/* Section: Em Andamento */}
                <div>
                    <button 
                        onClick={() => setIsEmAndamentoOpen(!isEmAndamentoOpen)}
                        className="w-full flex justify-between items-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-700 rounded transition-colors"
                    >
                        <span>Em Andamento</span>
                        {isEmAndamentoOpen ? <ChevronDown /> : <ChevronRight />}
                    </button>
                    {isEmAndamentoOpen && (
                        <nav className="space-y-1 mt-1 pl-1">
                            {imoveisData.emAndamento.map(imovel => (
                                <ImovelListItem 
                                    key={imovel} 
                                    imovel={imovel} 
                                    status='em_andamento'
                                    activeImovel={activeImovel}
                                    onSelect={setActiveImovel}
                                    onContextMenu={handleContextMenu}
                                    onDelete={handleDeleteImovel}
                                />
                            ))}
                            {imoveisData.emAndamento.length === 0 && (
                                <p className="text-gray-600 text-xs text-center py-2">Vazio</p>
                            )}
                        </nav>
                    )}
                </div>

                {/* Section: Finalizados */}
                <div>
                     <button 
                        onClick={() => setIsFinalizadosOpen(!isFinalizadosOpen)}
                        className="w-full flex justify-between items-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-700 rounded transition-colors"
                    >
                        <span>Finalizados</span>
                         {isFinalizadosOpen ? <ChevronDown /> : <ChevronRight />}
                    </button>
                    {isFinalizadosOpen && (
                        <nav className="space-y-1 mt-1 pl-1">
                            {imoveisData.finalizados.map(imovel => (
                                <ImovelListItem 
                                    key={imovel} 
                                    imovel={imovel} 
                                    status='finalizado'
                                    activeImovel={activeImovel}
                                    onSelect={setActiveImovel}
                                    onContextMenu={handleContextMenu}
                                    onDelete={handleDeleteImovel}
                                />
                            ))}
                            {imoveisData.finalizados.length === 0 && (
                                <p className="text-gray-600 text-xs text-center py-2">Vazio</p>
                            )}
                        </nav>
                    )}
                </div>

            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-900">
        
            {/* Context Menu */}
            {contextMenu && (
                <div 
                    className="fixed z-50 bg-gray-800 border border-gray-600 rounded shadow-lg py-1 min-w-[180px]"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        onClick={handleDuplicate}
                        className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white border-b border-gray-700"
                    >
                        Duplicar Imóvel
                    </button>
                    {contextMenu.currentStatus === 'em_andamento' ? (
                        <button
                            onClick={() => handleMoveCategory('finalizado')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                        >
                            Mover para Finalizados
                        </button>
                    ) : (
                         <button
                            onClick={() => handleMoveCategory('em_andamento')}
                            className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700 hover:text-white"
                        >
                            Mover para Em Andamento
                        </button>
                    )}
                </div>
            )}
            
            {recentlyDeleted && (
                <div className="fixed bottom-6 right-6 z-50 bg-gray-700 text-white py-3 px-5 rounded-lg shadow-2xl flex items-center space-x-4 animate-fade-in-up">
                    <span>Imóvel "{recentlyDeleted.imovelName}" excluído.</span>
                    <button onClick={handleUndoDelete} className="font-bold hover:underline text-cyan-400">
                        Desfazer
                    </button>
                </div>
            )}

            {activeImovel ? (
              <div key={activeImovel} className="space-y-6">
                
                {/* Scenario Tabs */}
                <div className="flex space-x-1 border-b border-gray-700 mb-6">
                     <button
                        onClick={() => setViewMode('Projetado')}
                        className={`px-6 py-2 text-sm font-medium rounded-t-lg transition-colors ${viewMode === 'Projetado' ? 'bg-gray-800 text-cyan-400 border-t border-l border-r border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Projetado
                    </button>
                    <button
                        onClick={() => setViewMode('Executado')}
                        className={`px-6 py-2 text-sm font-medium rounded-t-lg transition-colors ${viewMode === 'Executado' ? 'bg-gray-800 text-cyan-400 border-t border-l border-r border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Executado
                    </button>
                    <button
                        onClick={() => setViewMode('Comparativo')}
                        className={`px-6 py-2 text-sm font-medium rounded-t-lg transition-colors ${viewMode === 'Comparativo' ? 'bg-gray-800 text-cyan-400 border-t border-l border-r border-gray-700' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        Projetado x Executado
                    </button>
                </div>

                {viewMode === 'Comparativo' && comparisonCharts ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h3 className="text-xl font-bold mb-6 text-white text-center">Comparativo: {activeImovel}</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                {/* ROI Comparison */}
                                <div className="bg-gray-700 p-4 rounded-lg shadow border border-gray-600">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center uppercase">Retorno sobre Investimento (%)</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={comparisonCharts.roiData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" vertical={false} />
                                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(tick) => `${tick}%`} />
                                                <Tooltip content={<CustomBarTooltip formatter={(v: number) => `${v}%`} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                                <Legend />
                                                <Bar dataKey="Projetado" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Executado" fill="#34d399" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Profit per Share Comparison */}
                                <div className="bg-gray-700 p-4 rounded-lg shadow border border-gray-600">
                                    <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center uppercase">Lucro por Cota (R$)</h4>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={comparisonCharts.profitData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" vertical={false} />
                                                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatCurrencyBRL} />
                                                <Tooltip content={<CustomBarTooltip formatter={formatCurrencyBRL} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                                <Legend />
                                                <Bar dataKey="Projetado" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="Executado" fill="#34d399" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-700 p-4 rounded-lg shadow border border-gray-600">
                                <h4 className="text-sm font-semibold text-gray-300 mb-4 text-center uppercase">Comparativo de Despesas</h4>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={comparisonCharts.expenseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" vertical={false} />
                                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                                            <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatCurrencyBRL} />
                                            <Tooltip content={<CustomBarTooltip formatter={formatCurrencyBRL} />} cursor={{fill: '#374151', opacity: 0.2}} />
                                            <Legend />
                                            <Bar dataKey="Projetado" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Executado" fill="#fb7185" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="mt-2 text-xs text-gray-400 text-center">
                                    * Cartório + Impostos inclui: ITBI, Registro, Despachante, Taxas de Financiamento e Imposto sobre Ganho de Capital.
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                <div className="space-y-6">
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-6">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Estado</label>
                            <select value={activeImovelData.estado} onChange={e => handlePropertyDataChange('estado', e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white">
                                {ESTADOS_BRASIL.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Cidade</label>
                            <input type="text" value={activeImovelData.cidade} onChange={e => handlePropertyDataChange('cidade', e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Imóvel (Nome)</label>
                            <input 
                              type="text" 
                              value={imovelNameInput} 
                              onChange={(e) => setImovelNameInput(e.target.value)}
                              onBlur={handleRenameImovel}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameImovel(e)}
                              className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Tipo Compra</label>
                            <select value={activeImovelData.tipoCompra} onChange={e => handlePropertyDataChange('tipoCompra', e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white">
                                {Object.values(TipoCompra).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Data Compra</label>
                            <input 
                                type="date" 
                                value={activeImovelData.dataCompra || ''} 
                                onChange={e => handlePropertyDataChange('dataCompra', e.target.value)} 
                                disabled={activeScenario === 'Executado'}
                                className={`w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white ${activeScenario === 'Executado' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            />
                        </div>
                         <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Data Venda</label>
                            <input 
                                type="date" 
                                value={activeImovelData.dataVenda || ''} 
                                onChange={e => handlePropertyDataChange('dataVenda', e.target.value)} 
                                className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" 
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Vendido</label>
                            <select value={activeImovelData.vendido} onChange={e => handlePropertyDataChange('vendido', e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white">
                               {Object.values(Vendido).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-400">Nº Cotistas</label>
                            <input type="number" min="1" value={activeImovelData.numCotistas} onChange={e => handlePropertyDataChange('numCotistas', parseInt(e.target.value, 10) || 1)} className="w-full bg-gray-700 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" />
                        </div>
                    </div>
                </div>
                
                {/* NEW: Simulação de Financiamento Panel */}
                {activeImovelData.tipoCompra === TipoCompra.Financiado && (
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border-l-4 border-cyan-600">
                        <h3 className="text-xl font-bold mb-4 text-white">Simulação de Financiamento</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-300">Taxa de Juros Anual (%)</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    value={taxaJurosAnual} 
                                    onChange={(e) => handleSimulationChange('taxaJurosAnual', parseFloat(e.target.value) || 0)} 
                                    className="w-full bg-gray-900 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-300">Prazo Total (Meses)</label>
                                <input 
                                    type="number" 
                                    value={prazoMeses} 
                                    onChange={(e) => handleSimulationChange('prazoMeses', parseInt(e.target.value) || 0)} 
                                    className="w-full bg-gray-900 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-sm font-medium text-gray-300">Sistema de Amortização</label>
                                <select 
                                    value={sistemaAmortizacao} 
                                    onChange={(e) => handleSimulationChange('sistemaAmortizacao', e.target.value as 'SAC' | 'Price')} 
                                    className="w-full bg-gray-900 border-gray-600 rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 text-white"
                                >
                                    <option value="SAC">SAC (Amortização Constante)</option>
                                    <option value="Price">Price (Parcela Fixa)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {FIELD_GROUPS.map(group => (
                        <div key={group.title} className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h3 className="text-xl font-bold mb-4 text-white">{group.title}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                {group.fields.map(field => {
                                    const isAVista = activeImovelData.tipoCompra === TipoCompra.AVista;
                                    const isFinanciado = activeImovelData.tipoCompra === TipoCompra.Financiado;

                                    // Hide fields based on TipoCompra
                                    if (isAVista && (field === 'Saldo Devedor' || field === 'Prestação' || field === 'Valor Aquisição')) {
                                        return null;
                                    }

                                    let entry = activeImovelEntries.find(e => e.descricao === field);
                                    
                                    // REPLICATION LOGIC: Projected -> Executed
                                    if (!entry && activeScenario === 'Executado') {
                                        if (field === 'Entrada' || field === 'Comissão Leiloeiro') {
                                            const projectedEntry = projectedEntries.find(e => e.descricao === field);
                                            if (projectedEntry) {
                                                // We treat the projected entry as the source of truth if executed doesn't exist
                                                entry = projectedEntry; 
                                            }
                                        }
                                    }

                                    const valorAbs = entry ? Math.abs(entry.fluxoCaixa) : 0;
                                    const cotaAbs = entry ? Math.abs(entry.cota) : 0;
                                    const isManual = !!entry?.manualOverride;
                                    
                                    const isMonthlyField = group.type === TipoDespesa.CustoManutencao && (field === 'Prestação');
                                    
                                    let isEditable = true;
                                    // UNLOCKED: ITBI, Registro, Taxa Financiamento/Escritura are now editable manual overrides.
                                    if (isAVista && (field === 'Imposto de Ganho de Capital')) isEditable = false;
                                    // New Logic: Financiado also has automatic Capital Gain Tax
                                    if (isFinanciado && (field === 'Imposto de Ganho de Capital')) isEditable = false;

                                    // Entrada (Financiado) and Comissão Leiloeiro (Financiado) remain strictly calculated or from 'Valor Aquisição'
                                    if (isFinanciado && field === 'Entrada') isEditable = false; 
                                    if (isFinanciado && field === 'Comissão Leiloeiro') isEditable = false;
                                    
                                    // Unlock Valor Aquisição if Financiado
                                    if (isFinanciado && field === 'Valor Aquisição') isEditable = true;
                                    
                                    const fieldIdentifier = `${activeImovel}-${activeScenario}-${field}`;
                                    const isHighlighted = shouldHighlight(field);
                                    
                                    // Override highlight for calculated fields in Financiado mode
                                    // If it's manual, we give it a distinct border or subtle change to indicate override
                                    const isActuallyHighlighted = isHighlighted && isEditable;
                                    
                                    const baseInputClasses = `w-full border rounded-md p-2 focus:ring-cyan-500 focus:border-cyan-500 ${
                                        !isEditable 
                                            ? 'bg-gray-700 border-gray-600 text-gray-400' 
                                            : isManual
                                                ? 'bg-gray-900 border-cyan-600 text-cyan-200' // Highlight manual overrides
                                                : isActuallyHighlighted 
                                                    ? 'bg-cyan-900/40 border-cyan-500/50 text-cyan-50' 
                                                    : 'bg-gray-900 border-gray-600 text-white'
                                    }`;

                                    // Naming Standardization: 
                                    // Both 'Entrada' (À Vista) and 'Valor Aquisição' (Financiado) are labeled "Custo Aquisição (Valor Total)"
                                    let displayLabel = field;
                                    if (isAVista && field === 'Entrada') displayLabel = "Custo Aquisição (Valor Total)";
                                    if (isFinanciado && field === 'Valor Aquisição') displayLabel = "Custo Aquisição (Valor Total)";

                                    const renderField = (currentField: string) => {
                                        const valueToDisplay = focusedField === fieldIdentifier ? valorAbs : formatCurrencyBRL(valorAbs);
                                        
                                        // FIXED: Local helper for base value resolution (Consolidated)
                                        const getBaseValue = (descricao: string) => {
                                            let e = activeImovelEntries.find(el => el.descricao === descricao);
                                            if (!e && activeScenario === 'Executado') {
                                                e = projectedEntries.find(el => el.descricao === descricao);
                                            }
                                            return e ? Math.abs(e.fluxoCaixa) : 0;
                                        };

                                        const vendaValue = getBaseValue('Venda');
                                        const valorAquisicaoValue = getBaseValue('Valor Aquisição');
                                        const entradaValue = getBaseValue('Entrada');
                                        
                                        // Base for Calculations in the Input (like commissions)
                                        // If Financiado -> Valor Aquisicao. If A Vista -> Entrada.
                                        const baseAquisicao = isFinanciado ? valorAquisicaoValue : entradaValue;

                                        return(
                                            <div key={currentField}>
                                                <label className="block text-sm font-medium text-gray-300 mb-1">{displayLabel}</label>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-grow">
                                                        <span className="text-xs text-gray-400">Valor Total</span>
                                                        <input
                                                            type={focusedField === fieldIdentifier ? "number" : "text"}
                                                            value={valueToDisplay}
                                                            readOnly={!isEditable}
                                                            onFocus={() => setFocusedField(fieldIdentifier)}
                                                            onBlur={(e) => {
                                                                setFocusedField(null);
                                                                const val = parseCurrencyBRL(e.target.value);
                                                                handleValueChange(group.type, currentField, val);
                                                            }}
                                                            onChange={(e) => {
                                                                 const val = parseCurrencyBRL(e.target.value);
                                                                 handleValueChange(group.type, currentField, val);
                                                            }}
                                                            className={baseInputClasses}
                                                            placeholder="R$ 0,00"
                                                        />
                                                    </div>
                                                    {currentField === 'Comissão Corretor' && (
                                                        <div className="flex-shrink-0 flex items-end space-x-1">
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                value={comissaoCorretorPercent} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    handlePercentChange('Corretor', val, currentField, group.type, vendaValue);
                                                                }} 
                                                                className="w-16 bg-gray-900 border-gray-700 rounded-md p-2 text-white" 
                                                            />
                                                            <span className="pb-2">%</span>
                                                        </div>
                                                    )}
                                                    {currentField === 'Comissão Leiloeiro' && (
                                                        <div className="flex-shrink-0 flex items-end space-x-1">
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                value={comissaoLeiloeiroPercent} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    handlePercentChange('Leiloeiro', val, currentField, group.type, baseAquisicao);
                                                                }} 
                                                                className="w-16 bg-gray-900 border-gray-700 rounded-md p-2 text-white" 
                                                            />
                                                            <span className="pb-2">%</span>
                                                        </div>
                                                    )}
                                                    {currentField === 'ITBI' && (isAVista || isFinanciado) && (
                                                        <div className="flex-shrink-0 flex items-end space-x-1">
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                value={itbiPercent} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    handlePercentChange('ITBI', val, currentField, group.type, baseAquisicao);
                                                                }} 
                                                                className="w-16 bg-gray-900 border-gray-700 rounded-md p-2 text-white" 
                                                            />
                                                            <span className="pb-2">%</span>
                                                        </div>
                                                    )}
                                                    {currentField === 'Entrada' && isFinanciado && (
                                                         <div className="flex-shrink-0 flex items-end space-x-1">
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                value={entradaPercentFinanciado} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    handlePercentChange('Entrada', val, currentField, group.type, valorAquisicaoValue);
                                                                }} 
                                                                className="w-16 bg-gray-900 border-gray-700 rounded-md p-2 text-white" 
                                                            />
                                                            <span className="pb-2">%</span>
                                                        </div>
                                                    )}
                                                    {currentField === 'Imposto de Ganho de Capital' && (isAVista || isFinanciado) && (
                                                        <div className="flex-shrink-0 flex items-end space-x-1">
                                                            <input 
                                                                type="number" 
                                                                step="0.1" 
                                                                value={ganhoCapitalPercent} 
                                                                onChange={e => {
                                                                    const val = parseFloat(e.target.value) || 0;
                                                                    // Complex calc requires passing 0 as base and relying on useEffect to pick it up, 
                                                                    // OR passing the current complex base. 
                                                                    // For now, simpler to just update percent state and let useEffect re-run.
                                                                    handlePercentChange('GanhoCapital', val, currentField, group.type, 0); 
                                                                }} 
                                                                className="w-16 bg-gray-900 border-gray-700 rounded-md p-2 text-white" 
                                                            />
                                                            <span className="pb-2">%</span>
                                                        </div>
                                                    )}
                                                    {currentField === 'Venda' && activeScenario === 'Executado' && (
                                                        <div className="flex-shrink-0 w-24">
                                                            <span className="text-xs text-gray-400 block mb-1">Tempo (Meses)</span>
                                                            <input
                                                                type="number"
                                                                min="0.1"
                                                                step="0.1"
                                                                value={entry?.tempoVendaMeses || ''}
                                                                onChange={(e) => handleTempoVendaChange(parseFloat(e.target.value))}
                                                                className="w-full bg-gray-900 border-gray-700 rounded-md p-2 text-white text-center focus:ring-cyan-500 focus:border-cyan-500"
                                                                placeholder="Meses"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="w-1/2">
                                                        <span className="text-xs text-gray-400">Valor Cota</span>
                                                        <input type="text" value={formatCurrencyBRL(cotaAbs)} readOnly className="w-full bg-gray-900 border-gray-700 rounded-md p-2 text-gray-400"/>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    };

                                    if (field === 'Condomínio') {
                                        return (
                                            <React.Fragment key={field}>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Condomínio (Mensal)</label>
                                                     <div className="flex-grow">
                                                         <input
                                                            type="text"
                                                            value={monthlyInputs[field] || 'R$ 0,00'}
                                                            onFocus={(e) => {
                                                                const parsedValue = parseCurrencyBRL(e.target.value);
                                                                setMonthlyInputs(prev => ({ ...prev, [field]: parsedValue === 0 ? '' : String(parsedValue) }));
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = parseCurrencyBRL(e.target.value);
                                                                handleValueChange(group.type, field, val * 12);
                                                                setMonthlyInputs(prev => ({ ...prev, [field]: formatCurrencyBRL(val)}));
                                                            }}
                                                            onChange={(e) => setMonthlyInputs(prev => ({ ...prev, [field]: e.target.value }))}
                                                            className={baseInputClasses}
                                                            placeholder="R$ 0,00"
                                                        />
                                                     </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-1">Condomínio (Anual)</label>
                                                    <div className="flex-grow">
                                                        <input
                                                            type="text"
                                                            value={formatCurrencyBRL(valorAbs)}
                                                            readOnly
                                                            className="w-full bg-gray-700 border-gray-600 rounded-md p-2 text-gray-400"
                                                        />
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        );
                                    }
                                    
                                    if (isMonthlyField) { // Handles 'Prestação'
                                         return (
                                            <div key={field}>
                                                <label className="block text-sm font-medium text-gray-300 mb-1">{field}</label>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-grow">
                                                        <span className="text-xs text-gray-400">Valor (Mensal)</span>
                                                        <input
                                                            type="text"
                                                            value={monthlyInputs[field] || 'R$ 0,00'}
                                                            onFocus={(e) => {
                                                                const parsedValue = parseCurrencyBRL(e.target.value);
                                                                setMonthlyInputs(prev => ({ ...prev, [field]: parsedValue === 0 ? '' : String(parsedValue) }));
                                                            }}
                                                            onBlur={(e) => {
                                                                const val = parseCurrencyBRL(e.target.value);
                                                                handleValueChange(group.type, field, val * 12);
                                                                setMonthlyInputs(prev => ({...prev, [field]: formatCurrencyBRL(val) }));
                                                            }}
                                                            onChange={(e) => setMonthlyInputs(prev => ({ ...prev, [field]: e.target.value }))}
                                                            className={baseInputClasses}
                                                            placeholder="R$ 0,00"
                                                        />
                                                    </div>
                                                     <div className="w-1/2">
                                                        <span className="text-xs text-gray-400">Valor Cota</span>
                                                        <input type="text" value={formatCurrencyBRL(cotaAbs)} readOnly className="w-full bg-gray-900 border-gray-700 rounded-md p-2 text-gray-400"/>
                                                    </div>
                                                </div>
                                            </div>
                                         )
                                    }

                                    return renderField(field);
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mt-6">
                    <h3 className="text-xl font-bold mb-4 text-white">Resumo da Operação ({activeScenario})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                        <div className="bg-gray-700 p-4 rounded-md text-center">
                            <h4 className="text-sm font-medium text-gray-400">Lucro Total da Operação</h4>
                            <p className={`text-2xl font-bold mt-1 ${summary.lucroTotal >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrencyBRL(summary.lucroTotal)}
                            </p>
                        </div>
                         <div className="bg-gray-700 p-4 rounded-md text-center">
                            <h4 className="text-sm font-medium text-gray-400">Lucro Total por Cota</h4>
                            <p className={`text-2xl font-bold mt-1 ${summary.lucroPorCota >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrencyBRL(summary.lucroPorCota)}
                            </p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-md text-center">
                            <h4 className="text-sm font-medium text-gray-400">ROI Total</h4>
                            <p className={`text-2xl font-bold mt-1 ${summary.roiTotal >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                                {summary.roiTotal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                            </p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-md text-center">
                            <h4 className="text-sm font-medium text-gray-400">ROI Mensal</h4>
                            <p className={`text-2xl font-bold mt-1 ${summary.roiMensal >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                                {summary.roiMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                            </p>
                        </div>
                    </div>
                </div>
              </div>
                )}
            </div>
            ) : (
                <div className="flex h-full items-center justify-center">
                     <div className="text-center bg-gray-800 p-8 rounded-lg shadow-lg">
                        <h2 className="text-xl text-white font-semibold">Selecione ou Crie um Imóvel</h2>
                        <p className="text-gray-400 mt-2">Use o menu lateral para gerenciar seus imóveis.</p>
                        <button 
                            onClick={handleAddImovel}
                            className="mt-6 px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500"
                        >
                            + Novo Imóvel
                        </button>
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};

export default DataEntry;