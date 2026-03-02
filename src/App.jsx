import React, { useState, useMemo, useEffect } from 'react';
import { PlusCircle, List, BarChart3, Receipt, Calendar, DollarSign, Building, Trash2, Store, Settings, ChevronDown, AlertTriangle, Factory, Edit2, Save, X, CheckCircle, RotateCcw, CheckSquare, Tag, TrendingUp, Wallet, PieChart, FileText, Lock, FileSpreadsheet, Printer, Download } from 'lucide-react';

// --- FIREBASE SETUP ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Sua configuração oficial do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAAfM1nJkxRiynAZ5K2i6DyKi7kb1IjUWY",
  authDomain: "controle-de-oticas.firebaseapp.com",
  projectId: "controle-de-oticas",
  storageBucket: "controle-de-oticas.firebasestorage.app",
  messagingSenderId: "802683838060",
  appId: "1:802683838060:web:193884e1db1f374d0ac249"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'pratica-lab-v1'; // Identificador fixo da sua aplicação

export default function App() {
  const [activeTab, setActiveTab] = useState('lancamentos');
  
  // Helper de data local
  const getTodayStr = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  };

  const currentMonthStr = getTodayStr().substring(0, 7); // YYYY-MM

  // --- Auth State ---
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState('');
  const [dbError, setDbError] = useState(false);

  // --- App Login State (Frontend Gatekeeper) ---
  const [isLoggedIn, setIsLoggedIn] = useState(sessionStorage.getItem('praticaLabLoggedIn') === 'true');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- Firestore States ---
  const [installments, setInstallments] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [outrosFornecedores, setOutrosFornecedores] = useState([]);
  const [vendas, setVendas] = useState([]);
  
  const [configMetas, setConfigMetas] = useState({ metaLab: 30, metaArmacao: 30 });

  // --- UI States ---
  const [novaLoja, setNovaLoja] = useState('');
  const [lojaSelecionadaId, setLojaSelecionadaId] = useState('');
  const [novoLaboratorio, setNovoLaboratorio] = useState('');
  const [novoFornecedor, setNovoFornecedor] = useState('');
  const [novoOutroFornecedor, setNovoOutroFornecedor] = useState('');

  const [formVenda, setFormVenda] = useState({
    mes: currentMonthStr,
    valorVendaInfo: '',
    faturamento: '',
    armacaoLente: '',
    outrasDespesas: ''
  });

  const [modalExclusao, setModalExclusao] = useState({ isOpen: false, instId: null, groupId: null });
  const [modalPagamento, setModalPagamento] = useState({ isOpen: false, ids: [], dataPagamento: getTodayStr() });
  const [modalDesfazer, setModalDesfazer] = useState({ isOpen: false, id: null });

  const [selectedIds, setSelectedIds] = useState([]);

  const [filtros, setFiltros] = useState({ tipoCusto: '', entidadeId: '', dataInicio: '', dataFim: '', status: '' });
  const [filtroResumoTipo, setFiltroResumoTipo] = useState('');

  const [termoBusca, setTermoBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 20;

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ dueDate: '', amount: '', observacao: '' });
  
  // --- Relatórios States ---
  const [relatorioTipo, setRelatorioTipo] = useState('a_pagar');
  const [relatorioDataInicio, setRelatorioDataInicio] = useState(getTodayStr().substring(0, 8) + '01');
  const [relatorioDataFim, setRelatorioDataFim] = useState(getTodayStr());

  const [formData, setFormData] = useState({
    tipoCusto: 'laboratorio', 
    entidadeId: '', 
    numeroFechamento: '', 
    totalAmount: '',
    dataEmissao: getTodayStr(),
    startDate: getTodayStr(),
    installmentCount: 1,
    intervalDays: 30,
    observacao: ''
  });

  // --- Configuração de Ordenação da Tabela Lançamentos ---
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });

  // --- DEFINIÇÃO DO IDIOMA PARA PT-BR (Evita Google Tradutor) ---
  useEffect(() => {
    document.documentElement.lang = 'pt-BR';
  }, []);

  // --- 1. FIREBASE AUTH & SUBSCRIPTIONS ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error", err);
        setAuthError(err.message);
        setLoadingAuth(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoadingAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isLoggedIn) return; 
    
    // ATENÇÃO: Mudança para 'public/data' garante que os dados sejam preservados globalmente para a sua aplicação, 
    // ignorando o reset de sessão do usuário anônimo.
    const getRef = (coll) => collection(db, 'artifacts', appId, 'public', 'data', coll);
    const unsubs = [];
    
    const handleDbError = (err) => {
      console.error("Firestore Permission Error:", err);
      if (err.code === 'permission-denied' || err.message.includes('Missing or insufficient permissions')) {
        setDbError(true);
      }
    };

    unsubs.push(onSnapshot(getRef('lojas'), snap => setLojas(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    unsubs.push(onSnapshot(getRef('laboratorios'), snap => setLaboratorios(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    unsubs.push(onSnapshot(getRef('fornecedores'), snap => setFornecedores(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    unsubs.push(onSnapshot(getRef('outrosFornecedores'), snap => setOutrosFornecedores(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    unsubs.push(onSnapshot(getRef('vendas'), snap => setVendas(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    unsubs.push(onSnapshot(getRef('installments'), snap => setInstallments(snap.docs.map(d => ({id: d.id, ...d.data()}))), handleDbError));
    
    unsubs.push(onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'metas'), snap => {
      if (snap.exists()) setConfigMetas(snap.data());
    }, handleDbError));
    
    return () => unsubs.forEach(u => u());
  }, [user, isLoggedIn]);

  // Fallback Loja Selecionada
  useEffect(() => {
    if (lojas.length > 0 && !lojas.some(l => l.id === lojaSelecionadaId)) {
      setLojaSelecionadaId(lojas[0].id);
    }
  }, [lojas, lojaSelecionadaId]);

  // Firestore DB Helpers (Público/Global)
  const saveDoc = async (coll, id, data) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id), data, { merge: true });
    } catch (err) {
      console.error("Save Error:", err);
      if (err.code === 'permission-denied') setDbError(true);
    }
  };
  
  const delDoc = async (coll, id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id));
    } catch (err) {
      console.error("Delete Error:", err);
      if (err.code === 'permission-denied') setDbError(true);
    }
  };

  // --- LOGIN HANDLER ---
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (loginUser === 'admin' && loginPass === 'admin@admin123') {
      setIsLoggedIn(true);
      sessionStorage.setItem('praticaLabLoggedIn', 'true');
      setLoginError('');
    } else {
      setLoginError('Usuário ou senha incorretos.');
    }
  };

  // --- UI EFFECTS ---
  useEffect(() => {
    setSelectedIds([]);
  }, [filtros, lojaSelecionadaId]);

  useEffect(() => {
    if (formData.tipoCusto === 'laboratorio' && laboratorios.length > 0) {
      if (!laboratorios.find(l => l.id === formData.entidadeId)) setFormData(prev => ({ ...prev, entidadeId: laboratorios[0].id }));
    } else if (formData.tipoCusto === 'armacao' && fornecedores.length > 0) {
      if (!fornecedores.find(f => f.id === formData.entidadeId)) setFormData(prev => ({ ...prev, entidadeId: fornecedores[0].id }));
    } else if (formData.tipoCusto === 'outros' && outrosFornecedores.length > 0) {
      if (!outrosFornecedores.find(o => o.id === formData.entidadeId)) setFormData(prev => ({ ...prev, entidadeId: outrosFornecedores[0].id }));
    }
  }, [formData.tipoCusto, laboratorios, fornecedores, outrosFornecedores]);


  // --- HANDLERS FIREBASE ---
  const handleAddLoja = (e) => {
    e.preventDefault();
    if (!novaLoja.trim()) return;
    const newLoja = { id: crypto.randomUUID(), nome: novaLoja.trim() };
    saveDoc('lojas', newLoja.id, newLoja);
    setNovaLoja('');
  };

  const handleDeleteLoja = async (id) => {
    if (lojas.length === 1) return alert("Precisa ter pelo menos uma loja registada.");
    if (installments.some(inst => inst.lojaId === id)) {
      if(!window.confirm("Deseja eliminar a loja e todos os seus lançamentos?")) return;
      const toDelete = installments.filter(i => i.lojaId === id);
      await Promise.all(toDelete.map(inst => delDoc('installments', inst.id)));
    }
    await delDoc('lojas', id);
  };

  const handleAddLaboratorio = (e) => {
    e.preventDefault();
    if (!novoLaboratorio.trim()) return;
    const newLab = { id: crypto.randomUUID(), nome: novoLaboratorio.trim() };
    saveDoc('laboratorios', newLab.id, newLab);
    setNovoLaboratorio('');
  };

  const handleDeleteLaboratorio = (id) => {
    if (installments.some(inst => inst.entidadeId === id)) return alert("Existem lançamentos vinculados a este laboratório.");
    delDoc('laboratorios', id);
  };

  const handleAddFornecedor = (e) => {
    e.preventDefault();
    if (!novoFornecedor.trim()) return;
    const newForn = { id: crypto.randomUUID(), nome: novoFornecedor.trim() };
    saveDoc('fornecedores', newForn.id, newForn);
    setNovoFornecedor('');
  };

  const handleDeleteFornecedor = (id) => {
    if (installments.some(inst => inst.entidadeId === id)) return alert("Existem lançamentos vinculados a este fornecedor.");
    delDoc('fornecedores', id);
  };

  const handleAddOutroFornecedor = (e) => {
    e.preventDefault();
    if (!novoOutroFornecedor.trim()) return;
    const newOutro = { id: crypto.randomUUID(), nome: novoOutroFornecedor.trim() };
    saveDoc('outrosFornecedores', newOutro.id, newOutro);
    setNovoOutroFornecedor('');
  };

  const handleDeleteOutroFornecedor = (id) => {
    if (installments.some(inst => inst.entidadeId === id)) return alert("Existem lançamentos vinculados a este fornecedor.");
    delDoc('outrosFornecedores', id);
  };

  const handleSaveVenda = (e) => {
    e.preventDefault();
    if (!formVenda.mes || !formVenda.faturamento) return;
    
    const vendInfoNum = parseFloat(formVenda.valorVendaInfo) || 0;
    const fatNum = parseFloat(formVenda.faturamento);
    const armacaoNum = parseFloat(formVenda.armacaoLente) || 0;
    const outrasDespNum = parseFloat(formVenda.outrasDespesas) || 0;
    
    const vendaId = `${lojaSelecionadaId}_${formVenda.mes}`;
    const obj = { 
      id: vendaId, 
      lojaId: lojaSelecionadaId, 
      mes: formVenda.mes, 
      valorVendaInfo: vendInfoNum, 
      faturamento: fatNum, 
      armacaoLente: armacaoNum, 
      outrasDespesas: outrasDespNum 
    };

    saveDoc('vendas', vendaId, obj);
    setFormVenda({ mes: currentMonthStr, valorVendaInfo: '', faturamento: '', armacaoLente: '', outrasDespesas: '' });
  };

  const handleEditVenda = (vendaObj) => {
    setFormVenda({
      mes: vendaObj.mes,
      valorVendaInfo: vendaObj.valorVendaInfo ? vendaObj.valorVendaInfo.toString() : '',
      faturamento: vendaObj.faturamento ? vendaObj.faturamento.toString() : (vendaObj.valorVenda || '').toString(),
      armacaoLente: vendaObj.armacaoLente ? vendaObj.armacaoLente.toString() : (vendaObj.armacaoOutros || '').toString(),
      outrasDespesas: vendaObj.outrasDespesas ? vendaObj.outrasDespesas.toString() : ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteVenda = (id) => {
    delDoc('vendas', id);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { tipoCusto, entidadeId, numeroFechamento, totalAmount, dataEmissao, startDate, installmentCount, intervalDays, observacao } = formData;
    
    if (!entidadeId || !numeroFechamento || !totalAmount || !dataEmissao || !startDate || installmentCount < 1) {
      return alert("Por favor, preencha todos os campos obrigatórios.");
    }

    let entidadeNome = '';
    if (tipoCusto === 'laboratorio') {
      const lab = laboratorios.find(l => l.id === entidadeId);
      if (!lab) return;
      entidadeNome = lab.nome;
    } else if (tipoCusto === 'armacao') {
      const forn = fornecedores.find(f => f.id === entidadeId);
      if (!forn) return;
      entidadeNome = forn.nome;
    } else {
      const out = outrosFornecedores.find(o => o.id === entidadeId);
      if (!out) return;
      entidadeNome = out.nome;
    }

    const amount = parseFloat(totalAmount);
    const count = parseInt(installmentCount);
    const interval = parseInt(intervalDays);
    const partialAmount = amount / count;

    const [year, month, day] = startDate.split('-');
    const firstDate = new Date(year, month - 1, day);

    const newInstallments = [];
    const fechamentoGroupId = crypto.randomUUID();

    for (let i = 0; i < count; i++) {
      const dueDate = new Date(firstDate);
      dueDate.setDate(firstDate.getDate() + (i * interval));
      
      const newInst = {
        id: crypto.randomUUID(),
        fechamentoGroupId, 
        lojaId: lojaSelecionadaId, 
        tipoCusto, 
        entidadeId,
        entidadeNome,
        numeroFechamento, 
        dataEmissao, 
        observacao,
        parcelaStr: `${i + 1}/${count}`,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: partialAmount,
        status: 'A Pagar',
        paymentDate: null
      };
      newInstallments.push(newInst);
    }

    await Promise.all(newInstallments.map(inst => saveDoc('installments', inst.id, inst)));
    
    setFormData(prev => ({
      ...prev,
      numeroFechamento: '',
      totalAmount: '',
      observacao: ''
    }));
  };

  const solicitarExclusao = (instId, groupId) => setModalExclusao({ isOpen: true, instId, groupId });
  
  const confirmarExclusaoIndividual = () => {
    if (modalExclusao.instId) delDoc('installments', modalExclusao.instId);
    setModalExclusao({ isOpen: false, instId: null, groupId: null });
  };
  
  const confirmarExclusaoGrupo = async () => {
    if (modalExclusao.groupId) {
      const toDelete = installments.filter(item => item.fechamentoGroupId === modalExclusao.groupId);
      await Promise.all(toDelete.map(item => delDoc('installments', item.id)));
    }
    setModalExclusao({ isOpen: false, instId: null, groupId: null });
  };
  
  const abrirModalPagamento = (ids) => setModalPagamento({ isOpen: true, ids, dataPagamento: getTodayStr() });
  
  const confirmarPagamento = async () => {
    if (!modalPagamento.dataPagamento) return alert("Preencha a data de pagamento.");
    
    await Promise.all(modalPagamento.ids.map(id => {
      const inst = installments.find(i => i.id === id);
      if(inst) return saveDoc('installments', id, { ...inst, status: 'Pago', paymentDate: modalPagamento.dataPagamento });
    }));

    setModalPagamento({ isOpen: false, ids: [], dataPagamento: '' });
    setSelectedIds([]);
  };

  const solicitarDesfazer = (id) => setModalDesfazer({ isOpen: true, id });
  
  const confirmarDesfazer = () => {
    if (modalDesfazer.id) {
      const inst = installments.find(i => i.id === modalDesfazer.id);
      if (inst) saveDoc('installments', inst.id, { ...inst, status: 'A Pagar', paymentDate: null });
    }
    setModalDesfazer({ isOpen: false, id: null });
  };

  const saveEditing = (id) => {
    if (!editData.dueDate || !editData.amount) return alert("Preencha a data e o valor corretamente.");
    const inst = installments.find(i => i.id === id);
    if(inst) {
      saveDoc('installments', id, { ...inst, dueDate: editData.dueDate, amount: parseFloat(editData.amount), observacao: editData.observacao });
    }
    setEditingId(null);
  };

  const startEditing = (inst) => {
    setEditingId(inst.id);
    setEditData({ dueDate: inst.dueDate, amount: inst.amount, observacao: inst.observacao || '' });
  };

  const cancelEditing = () => setEditingId(null);

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(lancamentosFiltrados.filter(inst => inst.status === 'A Pagar').map(inst => inst.id));
    else setSelectedIds([]);
  };
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);

  const handleMetaBlur = () => {
    saveDoc('settings', 'metas', configMetas);
  };

  // --- Funções de Ordenação (Lançamentos) ---
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- Utilitários Formatação ---
  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };
  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    return `${month}/${year}`;
  };

  const getDisplayStatus = (inst) => {
    if (inst.status === 'Pago') return 'Pago';
    if (inst.dueDate < getTodayStr()) return 'Vencido';
    return 'A Pagar';
  };

  // --- Lógicas de Filtro e Resumo ---
  const lancamentosDaLoja = useMemo(() => installments.filter(inst => inst.lojaId === lojaSelecionadaId), [installments, lojaSelecionadaId]);

  const lancamentosFiltrados = useMemo(() => {
    let filtrados = lancamentosDaLoja;
    if (filtros.tipoCusto) filtrados = filtrados.filter(inst => inst.tipoCusto === filtros.tipoCusto);
    if (filtros.entidadeId) filtrados = filtrados.filter(inst => inst.entidadeId === filtros.entidadeId);
    if (filtros.status) {
      if (filtros.status === 'Vencido') filtrados = filtrados.filter(inst => getDisplayStatus(inst) === 'Vencido');
      else filtrados = filtrados.filter(inst => inst.status === filtros.status);
    }
    if (filtros.dataInicio) filtrados = filtrados.filter(inst => inst.dueDate >= filtros.dataInicio);
    if (filtros.dataFim) filtrados = filtrados.filter(inst => inst.dueDate <= filtros.dataFim);
    
    if (termoBusca.trim() !== '') {
      const termo = termoBusca.toLowerCase();
      filtrados = filtrados.filter(inst => {
        const obs = (inst.observacao || '').toLowerCase();
        const numFech = (inst.numeroFechamento || '').toLowerCase();
        const venciBR = formatDate(inst.dueDate).toLowerCase();
        const emissBR = formatDate(inst.dataEmissao || inst.dueDate).toLowerCase();
        
        return obs.includes(termo) || numFech.includes(termo) || venciBR.includes(termo) || emissBR.includes(termo);
      });
    }

    return filtrados;
  }, [lancamentosDaLoja, filtros, termoBusca]);

  // Aplica a ordenação configurada aos dados filtrados
  const lancamentosFiltradosEOrdenados = useMemo(() => {
    let sortableItems = [...lancamentosFiltrados];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Se for valor (numérico)
        if (sortConfig.key === 'amount') {
          aValue = parseFloat(aValue || 0);
          bValue = parseFloat(bValue || 0);
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Para textos e datas (ISO string YYYY-MM-DD permite ordenação alfabética correta)
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [lancamentosFiltrados, sortConfig]);

  // Reseta a paginação sempre que um filtro ou ordenação mudar
  useEffect(() => {
    setPaginaAtual(1);
  }, [filtros, termoBusca, sortConfig]);

  const indiceUltimoItem = paginaAtual * itensPorPagina;
  const indicePrimeiroItem = indiceUltimoItem - itensPorPagina;
  const lancamentosPaginados = lancamentosFiltradosEOrdenados.slice(indicePrimeiroItem, indiceUltimoItem);
  const totalPaginas = Math.ceil(lancamentosFiltradosEOrdenados.length / itensPorPagina);

  const lojaSelecionadaNome = lojas.find(l => l.id === lojaSelecionadaId)?.nome || 'Sem Loja Ativa';
  const overdueCount = useMemo(() => lancamentosDaLoja.filter(i => getDisplayStatus(i) === 'Vencido').length, [lancamentosDaLoja]);
  const numItensSelecionaveis = lancamentosFiltrados.filter(i => i.status === 'A Pagar').length;
  const todosSelecionados = numItensSelecionaveis > 0 && selectedIds.length === numItensSelecionaveis;

  // Lógica Resumo Mensal de Pagamentos (Fluxo de Caixa)
  const { pivotData, months, grandTotalPendente, grandTotalPago, colTotals } = useMemo(() => {
    const summary = {};
    const monthsSet = new Set();
    let tPendente = 0, tPago = 0;
    const cTotals = {};

    lancamentosDaLoja.forEach(inst => {
      if (filtroResumoTipo && inst.tipoCusto !== filtroResumoTipo) return;

      const [year, month] = inst.dueDate.split('-');
      const monthKey = `${year}-${month}`;
      monthsSet.add(monthKey);

      if (!summary[inst.entidadeNome]) summary[inst.entidadeNome] = { totalPendente: 0, totalPago: 0, tipo: inst.tipoCusto };
      if (!summary[inst.entidadeNome][monthKey]) summary[inst.entidadeNome][monthKey] = { pendente: 0, pago: 0 };
      if (!cTotals[monthKey]) cTotals[monthKey] = { pendente: 0, pago: 0 };
      
      if (inst.status === 'Pago') {
        summary[inst.entidadeNome][monthKey].pago += inst.amount;
        summary[inst.entidadeNome].totalPago += inst.amount;
        tPago += inst.amount;
        cTotals[monthKey].pago += inst.amount;
      } else {
        summary[inst.entidadeNome][monthKey].pendente += inst.amount;
        summary[inst.entidadeNome].totalPendente += inst.amount;
        tPendente += inst.amount;
        cTotals[monthKey].pendente += inst.amount;
      }
    });

    const sortedMonths = Array.from(monthsSet).sort();
    return { 
      pivotData: summary, 
      months: sortedMonths.map(m => ({ key: m, label: formatMonth(m) })), 
      grandTotalPendente: tPendente, 
      grandTotalPago: tPago, 
      colTotals: cTotals 
    };
  }, [lancamentosDaLoja, filtroResumoTipo]);

  // Lógica Resultados / DRE (Competência por Data de Emissão)
  const resultadosPorMes = useMemo(() => {
    const sumario = {};

    // 1. Somar Vendas, Faturamento e Manuais
    vendas.filter(v => v.lojaId === lojaSelecionadaId).forEach(v => {
      if (!sumario[v.mes]) sumario[v.mes] = { valorVendaInfo: 0, faturamento: 0, armacaoLente: 0, outrasDespesas: 0, lab: 0 };
      sumario[v.mes].valorVendaInfo += (v.valorVendaInfo || 0);
      sumario[v.mes].faturamento += (v.faturamento || 0);
      sumario[v.mes].armacaoLente += (v.armacaoLente || v.armacaoOutros || 0); 
      sumario[v.mes].outrasDespesas += (v.outrasDespesas || 0);
    });

    // 2. Somar Custos por Data de Emissão (SOMENTE LABORATÓRIO)
    lancamentosDaLoja.forEach(inst => {
      if (inst.tipoCusto === 'laboratorio') {
        const mesEmissao = inst.dataEmissao.substring(0, 7);
        if (!sumario[mesEmissao]) sumario[mesEmissao] = { valorVendaInfo: 0, faturamento: 0, armacaoLente: 0, outrasDespesas: 0, lab: 0 };
        sumario[mesEmissao].lab += inst.amount;
      }
    });

    return Object.entries(sumario).map(([mes, data]) => {
      const custoTotal = data.lab + data.armacaoLente + data.outrasDespesas;
      const lucroBruto = data.faturamento - custoTotal;
      const margemPct = data.faturamento > 0 ? (lucroBruto / data.faturamento) * 100 : 0;
      return { mes, ...data, custoTotal, lucroBruto, margemPct };
    }).sort((a, b) => b.mes.localeCompare(a.mes));

  }, [vendas, lancamentosDaLoja, lojaSelecionadaId]);

  // Lógica de Relatórios
  const dadosRelatorio = useMemo(() => {
    if (relatorioTipo === 'a_pagar') {
      return lancamentosDaLoja.filter(i => i.status === 'A Pagar' && i.dueDate >= relatorioDataInicio && i.dueDate <= relatorioDataFim).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } else if (relatorioTipo === 'pagas') {
      return lancamentosDaLoja.filter(i => i.status === 'Pago' && i.paymentDate >= relatorioDataInicio && i.paymentDate <= relatorioDataFim).sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
    } else if (relatorioTipo === 'todos') {
      return lancamentosDaLoja.filter(i => i.dueDate >= relatorioDataInicio && i.dueDate <= relatorioDataFim).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    } else if (relatorioTipo === 'dre') {
      const mesInicio = relatorioDataInicio.substring(0, 7);
      const mesFim = relatorioDataFim.substring(0, 7);
      return resultadosPorMes.filter(r => r.mes >= mesInicio && r.mes <= mesFim);
    }
    return [];
  }, [lancamentosDaLoja, resultadosPorMes, relatorioTipo, relatorioDataInicio, relatorioDataFim]);

  const exportarRelatorioCSV = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    let rows = [];

    if (relatorioTipo === 'a_pagar' || relatorioTipo === 'pagas' || relatorioTipo === 'todos') {
      rows.push(["Tipo", "Entidade", "Fechamento", "Emissao", "Parcela", "Vencimento", "Pagamento", "Valor", "Status"]);
      dadosRelatorio.forEach(item => {
        rows.push([
          item.tipoCusto,
          item.entidadeNome,
          item.numeroFechamento,
          item.dataEmissao,
          item.parcelaStr,
          item.dueDate,
          item.paymentDate || '-',
          item.amount.toFixed(2).replace('.', ','),
          item.status
        ]);
      });
    } else if (relatorioTipo === 'dre') {
      rows.push(["Mes", "Valor Venda", "Efetivado", "Custo Lab", "Armacao/Lente C.", "Outras Despesas", "Lucro Liquido", "Margem (%)"]);
      dadosRelatorio.forEach(item => {
        rows.push([
          item.mes,
          (item.valorVendaInfo||0).toFixed(2).replace('.', ','),
          item.faturamento.toFixed(2).replace('.', ','),
          item.lab.toFixed(2).replace('.', ','),
          item.armacaoLente.toFixed(2).replace('.', ','),
          item.outrasDespesas.toFixed(2).replace('.', ','),
          item.lucroBruto.toFixed(2).replace('.', ','),
          item.margemPct.toFixed(2).replace('.', ',')
        ]);
      });
    }

    const csvContent = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_${relatorioTipo}_${getTodayStr()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Adicionado um delay considerável para evitar que o navegador se perca no clique imediato
    setTimeout(() => URL.revokeObjectURL(url), 3000); 
  };

  const exportarBackupCSV = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    let rows = [];
    rows.push(["ID", "Tipo", "Entidade", "Fechamento", "Emissao", "Parcela", "Vencimento", "Pagamento", "Valor", "Status", "Observacao"]);
    lancamentosDaLoja.forEach(item => {
      rows.push([
        item.id,
        item.tipoCusto,
        item.entidadeNome,
        item.numeroFechamento,
        item.dataEmissao,
        item.parcelaStr,
        item.dueDate,
        item.paymentDate || '-',
        item.amount.toFixed(2).replace('.', ','),
        item.status,
        item.observacao || ''
      ]);
    });
    
    const csvContent = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Backup_Lancamentos_${getTodayStr()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Adicionado um delay considerável
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const gerarPDF = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setIsGeneratingPDF(true);
    
    // Pequeno atraso para o botão mostrar "Gerando..." antes do travamento da geração do PDF
    setTimeout(async () => {
      const element = document.getElementById('print-area');
      const header = document.getElementById('print-header');
      const tableContainer = document.getElementById('relatorio-table-container');
      
      if (header) {
        header.classList.remove('hidden');
        header.classList.add('block');
      }
      if (tableContainer) {
        tableContainer.classList.remove('overflow-x-auto');
      }

      try {
        if (!window.html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const opt = {
          margin:       10,
          filename:     `Relatorio_${relatorioTipo}_${getTodayStr()}_${Date.now()}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          // A propriedade scrollY em 0 evita que ele corte se o usuário estiver no meio da tela
          html2canvas:  { scale: 2, useCORS: true, logging: false, scrollY: 0 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
          // A propriedade 'avoid: tr' garante que a tabela não quebre linhas pela metade ao mudar de página
          pagebreak:    { mode: 'css', avoid: 'tr' }
        };

        await window.html2pdf().set(opt).from(element).save();
      } catch (error) {
        console.error("Erro ao gerar PDF:", error);
      } finally {
        if (header) {
          header.classList.add('hidden');
          header.classList.remove('block');
        }
        if (tableContainer) {
          tableContainer.classList.add('overflow-x-auto');
        }
        setIsGeneratingPDF(false);
      }
    }, 150);
  };


  // --- TELA DE ERRO DE FIREBASE ---
  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4 text-red-600 p-8 text-center">
        <AlertTriangle className="w-16 h-16" />
        <h2 className="text-2xl font-bold">Acesso Bloqueado pelo Firebase</h2>
        <p className="text-slate-700 max-w-md">
          O seu banco de dados está em <strong>Modo de Produção</strong> e bloqueou a leitura e gravação dos dados por segurança.
          Precisamos liberar o acesso do seu usuário nas Regras do Firestore.
        </p>
        <div className="bg-white p-6 rounded-xl shadow-lg border border-red-200 max-w-2xl w-full mt-4 text-left text-sm text-slate-700 space-y-4">
          <p className="font-bold text-base text-slate-900 border-b pb-2">Como resolver (Passo Final):</p>
          <ol className="list-decimal pl-5 space-y-3">
            <li>Acesse o <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold">Console do Firebase</a> e abra o projeto <strong>controle-de-oticas</strong>.</li>
            <li>No menu lateral esquerdo, vá em <strong>Build</strong> (Criação) {">"} <strong>Firestore Database</strong>.</li>
            <li>No topo, clique na aba <strong>Regras (Rules)</strong>.</li>
            <li>Apague TODO o código que estiver lá e cole EXATAMENTE o código abaixo:
              <div className="mt-2 bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto relative">
                <pre className="text-xs font-mono">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/public/data/{document=**} {
      allow read, write: if true;
    }
  }
}`}
                </pre>
              </div>
            </li>
            <li>Clique no botão azul <strong>Publicar</strong>.</li>
            <li>Aguarde cerca de 1 a 2 minutos para o Firebase atualizar as regras e clique no botão abaixo para tentar novamente.</li>
          </ol>
          <button onClick={() => window.location.reload()} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg text-base transition-colors">
            Já atualizei as regras, tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // --- TELA DE ERRO DE AUTH ---
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4 text-red-600 p-8 text-center">
        <AlertTriangle className="w-16 h-16" />
        <h2 className="text-xl font-bold">Erro de Autenticação no Firebase</h2>
        <p className="text-slate-700 max-w-md">
          {authError.includes('configuration-not-found') || authError.includes('operation-not-allowed')
            ? "Você precisa ativar a Autenticação no seu projeto Firebase."
            : `Erro detalhado: ${authError}`}
        </p>
      </div>
    );
  }

  // --- TELA DE LOADING ---
  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4 text-indigo-600">
        <Store className="w-12 h-12 animate-pulse" />
        <p className="font-semibold text-slate-600 animate-pulse">Sincronizando com Banco de Dados...</p>
      </div>
    );
  }

  // --- TELA DE LOGIN ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full border border-slate-100">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-100 p-4 rounded-full">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-1">PráticaLab</h1>
          <p className="text-slate-500 text-center text-sm mb-8">Controle de Óticas</p>

          {loginError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-6 border border-red-100">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário</label>
              <input
                type="text"
                value={loginUser}
                onChange={e => setLoginUser(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-colors mt-2"
            >
              Entrar no Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 relative pb-20 print:p-0 print:bg-white">
      
      {modalExclusao.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4 text-red-600">Confirmar Eliminação</h3>
            <p className="text-slate-600 mb-6">Deseja eliminar apenas a parcela selecionada ou todo o fechamento associado?</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmarExclusaoIndividual} className="w-full py-3 font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Apenas esta parcela</button>
              <button onClick={confirmarExclusaoGrupo} className="w-full py-3 font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Todo o fechamento</button>
              <button onClick={() => setModalExclusao({isOpen: false})} className="w-full py-2 font-medium text-slate-500">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalPagamento.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-6 text-green-600">Registar Pagamento</h3>
            <input type="date" value={modalPagamento.dataPagamento} onChange={(e) => setModalPagamento(prev => ({...prev, dataPagamento: e.target.value}))} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg outline-none mb-6" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalPagamento({isOpen: false})} className="px-5 py-2.5 text-slate-700 bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={confirmarPagamento} className="px-5 py-2.5 text-white bg-green-600 rounded-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {modalDesfazer.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4 text-amber-600">Reabrir Parcela?</h3>
            <p className="text-slate-600 mb-6">Deseja remover o pagamento e marcar como "A Pagar"?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setModalDesfazer({isOpen: false})} className="px-5 py-2.5 text-slate-700 bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={confirmarDesfazer} className="px-5 py-2.5 text-white bg-amber-600 rounded-lg">Sim, Reabrir</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-6 print:m-0 print:w-full">
        
        {/* Cabeçalho e Seletor de Loja */}
        <header className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <Store className="text-indigo-600 h-7 w-7" />
              PráticaLab - Controle de Óticas
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Controle de pagamentos, custos de produtos e resultados.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100 w-full md:w-auto">
            <span className="text-sm font-semibold text-indigo-800 whitespace-nowrap">Loja Ativa:</span>
            <div className="relative w-full md:w-64">
              <select
                value={lojaSelecionadaId}
                onChange={(e) => setLojaSelecionadaId(e.target.value)}
                disabled={lojas.length === 0}
                className="w-full appearance-none bg-white border border-indigo-200 text-indigo-900 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 pr-8 font-medium shadow-sm cursor-pointer disabled:bg-slate-100"
              >
                {lojas.length === 0 && <option value="" disabled>Cadastre uma Loja</option>}
                {lojas.map(loja => (
                  <option key={loja.id} value={loja.id}>{loja.nome}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-600">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* Navegação de Abas */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm border border-slate-200 overflow-x-auto print:hidden">
          <button onClick={() => setActiveTab('lancamentos')} className={`flex-1 flex items-center justify-center min-w-[120px] gap-2 px-4 py-3 font-medium text-sm rounded-md transition-all ${activeTab === 'lancamentos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <List className="w-4 h-4" /> Lançamentos
          </button>
          <button onClick={() => setActiveTab('resumo')} className={`flex-1 flex items-center justify-center min-w-[120px] gap-2 px-4 py-3 font-medium text-sm rounded-md transition-all ${activeTab === 'resumo' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Wallet className="w-4 h-4" /> Previsão Caixa
          </button>
          <button onClick={() => setActiveTab('resultados')} className={`flex-1 flex items-center justify-center min-w-[120px] gap-2 px-4 py-3 font-medium text-sm rounded-md transition-all ${activeTab === 'resultados' ? 'bg-green-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <TrendingUp className="w-4 h-4" /> Resultados (DRE)
          </button>
          <button onClick={() => setActiveTab('relatorios')} className={`flex-1 flex items-center justify-center min-w-[120px] gap-2 px-4 py-3 font-medium text-sm rounded-md transition-all ${activeTab === 'relatorios' ? 'bg-sky-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <FileSpreadsheet className="w-4 h-4" /> Relatórios
          </button>
          <button onClick={() => setActiveTab('config')} className={`flex-none flex items-center justify-center px-6 py-3 font-medium text-sm rounded-md transition-all ${activeTab === 'config' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
            <Settings className="w-4 h-4" /> <span className="hidden lg:inline ml-2">Configurações</span>
          </button>
        </div>

        {overdueCount > 0 && activeTab === 'lancamentos' && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm flex items-start gap-3 print:hidden">
            <AlertTriangle className="text-red-500 w-6 h-6 shrink-0" />
            <div>
              <h4 className="text-red-800 font-bold text-sm">Atenção! Existem parcelas vencidas.</h4>
              <p className="text-red-600 text-sm mt-1">A loja <strong>{lojaSelecionadaNome}</strong> possui {overdueCount} parcela(s) com data de vencimento ultrapassada e não paga(s).</p>
            </div>
          </div>
        )}

        {/* --- CONTEÚDO PRINCIPAL --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[500px] print:border-none print:shadow-none print:min-h-0">
          
          {/* TAB 1: LANÇAMENTOS */}
          {activeTab === 'lancamentos' && (
            <div className="p-6 print:hidden">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">Lançamentos de Custos: <span className="text-indigo-600">{lojaSelecionadaNome}</span></h2>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                {/* Formulário */}
                <div className="xl:col-span-1 bg-slate-50 p-5 rounded-xl border border-slate-200 h-fit">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-800">
                    <PlusCircle className="w-5 h-5 text-indigo-600" /> Nova Nota
                  </h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* Seletor de Tipo */}
                    <div className="bg-white p-1 rounded-lg border border-slate-300 flex flex-col gap-1 sm:flex-row">
                      <button type="button" onClick={() => setFormData(prev => ({...prev, tipoCusto: 'laboratorio'}))} className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-md transition-colors flex items-center justify-center gap-1 ${formData.tipoCusto === 'laboratorio' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Factory className="w-3.5 h-3.5" /> Lab
                      </button>
                      <button type="button" onClick={() => setFormData(prev => ({...prev, tipoCusto: 'armacao'}))} className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-md transition-colors flex items-center justify-center gap-1 ${formData.tipoCusto === 'armacao' ? 'bg-sky-100 text-sky-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <Tag className="w-3.5 h-3.5" /> Armação
                      </button>
                      <button type="button" onClick={() => setFormData(prev => ({...prev, tipoCusto: 'outros'}))} className={`flex-1 py-1.5 px-1 text-[11px] font-bold rounded-md transition-colors flex items-center justify-center gap-1 ${formData.tipoCusto === 'outros' ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <FileText className="w-3.5 h-3.5" /> Outros
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {formData.tipoCusto === 'laboratorio' ? 'Laboratório' : formData.tipoCusto === 'armacao' ? 'Fornecedor' : 'Fornecedor (Outros)'}
                      </label>
                      <div className="relative">
                        {formData.tipoCusto === 'laboratorio' ? <Factory className="w-4 h-4 absolute left-3 top-3 text-slate-400" /> : formData.tipoCusto === 'armacao' ? <Tag className="w-4 h-4 absolute left-3 top-3 text-slate-400" /> : <FileText className="w-4 h-4 absolute left-3 top-3 text-slate-400" />}
                        <select name="entidadeId" value={formData.entidadeId} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full appearance-none pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:bg-slate-100" required>
                          <option value="" disabled>Selecione...</option>
                          {formData.tipoCusto === 'laboratorio' 
                            ? laboratorios.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)
                            : formData.tipoCusto === 'armacao'
                            ? fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)
                            : outrosFornecedores.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)
                          }
                        </select>
                        <ChevronDown className="h-4 w-4 absolute right-3 top-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nº Nota / Fechamento</label>
                      <div className="relative">
                        <Receipt className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input type="text" name="numeroFechamento" value={formData.numeroFechamento} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Observação (Opcional)</label>
                      <input type="text" name="observacao" value={formData.observacao} onChange={handleInputChange} disabled={lojas.length === 0} placeholder="Detalhes do lançamento..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$)</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                        <input type="number" step="0.01" name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dt. Emissão</label>
                        <input type="date" name="dataEmissao" value={formData.dataEmissao} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full px-2 py-2.5 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Vencimento 1ª</label>
                        <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full px-2 py-2.5 border border-slate-300 rounded-lg text-xs disabled:bg-slate-100" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nº Parcelas</label>
                        <input type="number" min="1" name="installmentCount" value={formData.installmentCount} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-center text-sm disabled:bg-slate-100" required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Intervalo (Dias)</label>
                        <input type="number" min="1" name="intervalDays" value={formData.intervalDays} onChange={handleInputChange} disabled={lojas.length === 0} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-center text-sm disabled:bg-slate-100" required />
                      </div>
                    </div>

                    <button type="submit" disabled={lojas.length === 0} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-sm mt-4">
                      <PlusCircle className="w-4 h-4" /> Gerar Lançamento
                    </button>
                  </form>
                </div>

                {/* Tabela de Lançamentos */}
                <div className="xl:col-span-3 flex flex-col h-full border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-white border-b border-slate-200 p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Histórico de Parcelas</h3>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={exportarBackupCSV} className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-medium px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors" title="Exportar Backup de Lançamentos (Excel)">
                          <Download className="w-3 h-3" /> Backup Geral (CSV)
                        </button>
                        <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">{lancamentosFiltradosEOrdenados.length} registos</span>
                      </div>
                    </div>

                    {/* Filtros */}
                    <div className="mb-3">
                      <input type="text" placeholder="Busca rápida por observação, nº nota ou data (Ex: 15/05/2024)..." value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)} className="w-full text-xs py-2 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                        <select value={filtros.tipoCusto} onChange={(e) => setFiltros(prev => ({...prev, tipoCusto: e.target.value, entidadeId: ''}))} className="w-full text-xs py-2 px-2 border border-slate-300 rounded-lg">
                          <option value="">Todos</option>
                          <option value="laboratorio">Laboratório</option>
                          <option value="armacao">Armação</option>
                          <option value="outros">Outros Boletos</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Entidade</label>
                        <select value={filtros.entidadeId} onChange={(e) => setFiltros(prev => ({...prev, entidadeId: e.target.value}))} className="w-full text-xs py-2 px-2 border border-slate-300 rounded-lg">
                          <option value="">Todos</option>
                          {filtros.tipoCusto === '' || filtros.tipoCusto === 'laboratorio' ? laboratorios.map(l => <option key={l.id} value={l.id}>{l.nome}</option>) : null}
                          {filtros.tipoCusto === '' || filtros.tipoCusto === 'armacao' ? fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>) : null}
                          {filtros.tipoCusto === '' || filtros.tipoCusto === 'outros' ? outrosFornecedores.map(o => <option key={o.id} value={o.id}>{o.nome}</option>) : null}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
                        <select value={filtros.status} onChange={(e) => setFiltros(prev => ({...prev, status: e.target.value}))} className="w-full text-xs py-2 px-2 border border-slate-300 rounded-lg">
                          <option value="">Todos</option><option value="A Pagar">A Pagar</option><option value="Pago">Pago</option><option value="Vencido">Vencido</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Período (Vencimento)</label>
                        <input type="date" value={filtros.dataInicio} onChange={(e) => setFiltros(prev => ({...prev, dataInicio: e.target.value}))} className="w-full text-xs py-2 px-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div className="flex items-end gap-2">
                        <input type="date" value={filtros.dataFim} onChange={(e) => setFiltros(prev => ({...prev, dataFim: e.target.value}))} className="w-full text-xs py-2 px-2 border border-slate-300 rounded-lg" />
                        <button onClick={() => { setFiltros({tipoCusto: '', entidadeId: '', dataInicio: '', dataFim: '', status: ''}); setTermoBusca(''); }} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-100 rounded-lg" title="Limpar Filtros"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>

                  {selectedIds.length > 0 && (
                    <div className="bg-indigo-50 p-3 flex justify-between items-center border-b border-indigo-100">
                      <span className="text-sm font-medium text-indigo-800">{selectedIds.length} selecionadas</span>
                      <button onClick={() => abrirModalPagamento(selectedIds)} className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-1.5 px-4 rounded-md flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Baixar</button>
                    </div>
                  )}
                  
                  <div className="overflow-x-auto flex-1 bg-white">
                    {lancamentosFiltradosEOrdenados.length > 0 ? (
                      <table className="w-full min-w-[900px] text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-3 w-10"><input type="checkbox" checked={todosSelecionados} onChange={toggleSelectAll} className="w-4 h-4 rounded" disabled={numItensSelecionaveis === 0} /></th>
                            <th className="px-3 py-3 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('entidadeNome')}>
                              Tipo / Entidade {sortConfig.key === 'entidadeNome' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('numeroFechamento')}>
                              Nota/Emissão {sortConfig.key === 'numeroFechamento' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3 text-center cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('parcelaStr')}>
                              Parc. {sortConfig.key === 'parcelaStr' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3 cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('dueDate')}>
                              Vencimento {sortConfig.key === 'dueDate' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3 text-right cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('amount')}>
                              Valor {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3">Obs</th>
                            <th className="px-3 py-3 text-center cursor-pointer select-none hover:bg-slate-200 transition-colors" onClick={() => requestSort('status')}>
                              Estado {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-3 py-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {lancamentosPaginados.map((inst) => {
                            const dispStatus = getDisplayStatus(inst);
                            return (
                            <tr key={inst.id} className="hover:bg-slate-50">
                              <td className="px-3 py-3 text-center">{inst.status === 'A Pagar' && <input type="checkbox" checked={selectedIds.includes(inst.id)} onChange={() => toggleSelect(inst.id)} className="w-4 h-4 rounded" />}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  {inst.tipoCusto === 'laboratorio' ? <Factory className="w-4 h-4 text-indigo-400" /> : inst.tipoCusto === 'armacao' ? <Tag className="w-4 h-4 text-sky-400" /> : <FileText className="w-4 h-4 text-amber-500" />}
                                  <span className="font-bold text-slate-800">{inst.entidadeNome}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium">{inst.numeroFechamento}</span>
                                  <span className="text-[10px] text-slate-400">Emissão: {formatDate(inst.dataEmissao || inst.dueDate)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center font-medium">{inst.parcelaStr}</td>
                              <td className="px-3 py-3">
                                {editingId === inst.id ? <input type="date" value={editData.dueDate} onChange={(e) => setEditData(prev => ({...prev, dueDate: e.target.value}))} className="w-full px-1 text-sm border rounded" /> : <span className={inst.status === 'Pago' ? 'line-through text-slate-400' : ''}>{formatDate(inst.dueDate)}</span>}
                              </td>
                              <td className="px-3 py-3 text-right font-bold text-slate-900">
                                {editingId === inst.id ? <input type="number" step="0.01" value={editData.amount} onChange={(e) => setEditData(prev => ({...prev, amount: e.target.value}))} className="w-20 px-1 text-sm border rounded text-right ml-auto" /> : formatCurrency(inst.amount)}
                              </td>
                              <td className="px-3 py-3">
                                {editingId === inst.id ? (
                                  <input type="text" value={editData.observacao} onChange={(e) => setEditData(prev => ({...prev, observacao: e.target.value}))} className="w-full min-w-[120px] px-1 text-sm border rounded" placeholder="Obs..." />
                                ) : (
                                  <span className="text-xs text-slate-500 block max-w-[120px] truncate" title={inst.observacao}>{inst.observacao || '-'}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {dispStatus === 'Pago' && <div className="flex flex-col items-center"><span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">PAGO</span><span className="text-[10px] text-slate-500 mt-0.5">{formatDate(inst.paymentDate)}</span></div>}
                                {dispStatus === 'Vencido' && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">VENCIDO</span>}
                                {dispStatus === 'A Pagar' && <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">A PAGAR</span>}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {editingId === inst.id ? (
                                    <><button onClick={() => saveEditing(inst.id)} className="text-green-600 p-1"><Save className="w-4 h-4"/></button><button onClick={cancelEditing} className="text-slate-400 p-1"><X className="w-4 h-4"/></button></>
                                  ) : (
                                    <>
                                      {inst.status === 'A Pagar' ? (
                                        <><button onClick={() => abrirModalPagamento([inst.id])} className="text-slate-400 hover:text-green-600 p-1"><CheckCircle className="w-4 h-4"/></button><button onClick={() => startEditing(inst)} className="text-slate-400 hover:text-indigo-600 p-1"><Edit2 className="w-4 h-4"/></button></>
                                      ) : (<button onClick={() => solicitarDesfazer(inst.id)} className="text-slate-400 hover:text-amber-600 p-1"><RotateCcw className="w-4 h-4"/></button>)}
                                      <button onClick={() => solicitarExclusao(inst.id, inst.fechamentoGroupId)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );})}
                        </tbody>
                      </table>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400"><Receipt className="w-12 h-12 mb-3 text-slate-300" /><p className="font-medium text-slate-500">Nenhum lançamento encontrado.</p></div>
                    )}
                  </div>

                  {/* Controles de Paginação */}
                  {totalPaginas > 1 && (
                    <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                      <span className="text-xs text-slate-500">
                        Mostrando {indicePrimeiroItem + 1} a {Math.min(indiceUltimoItem, lancamentosFiltradosEOrdenados.length)} de {lancamentosFiltradosEOrdenados.length} registos
                      </span>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                          disabled={paginaAtual === 1}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition-colors"
                        >
                          Anterior
                        </button>
                        <span className="px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg flex items-center">
                          Página {paginaAtual} de {totalPaginas}
                        </span>
                        <button 
                          onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                          disabled={paginaAtual === totalPaginas}
                          className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 text-slate-600 transition-colors"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESUMO MENSAL (FLUXO DE CAIXA) */}
          {activeTab === 'resumo' && (
            <div className="p-6 print:hidden">
              <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="w-5 h-5 text-indigo-600"/> Previsão de Pagamentos (Caixa)</h2>
                  <p className="text-sm text-slate-500 mt-1">Valores a pagar no futuro baseados na <strong>Data de Vencimento</strong> das parcelas.</p>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <label className="text-sm font-medium text-slate-600 ml-2">Filtrar Visão:</label>
                  <select value={filtroResumoTipo} onChange={e => setFiltroResumoTipo(e.target.value)} className="bg-white border border-slate-300 text-sm rounded-md px-3 py-1.5 outline-none font-medium">
                    <option value="">Todos</option>
                    <option value="laboratorio">Apenas Laboratórios</option>
                    <option value="armacao">Apenas Armações</option>
                    <option value="outros">Apenas Outros Boletos</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl mt-4">
                {Object.keys(pivotData).length > 0 ? (
                  <table className="w-full min-w-[800px] text-sm text-left">
                    <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-800">Fornecedor / Lab</th>
                        {months.map(m => <th key={m.key} className="px-6 py-4 font-bold text-right text-slate-800">{m.label}</th>)}
                        <th className="px-6 py-4 font-black text-right bg-slate-200 border-l border-slate-300">Total Geral</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Object.entries(pivotData).map(([nome, dados]) => (
                        <tr key={nome} className="hover:bg-slate-50">
                          <td className="px-6 py-4 font-bold text-slate-800 flex items-center gap-2">
                            {dados.tipo === 'laboratorio' ? <Factory className="w-4 h-4 text-indigo-400"/> : dados.tipo === 'armacao' ? <Tag className="w-4 h-4 text-sky-400"/> : <FileText className="w-4 h-4 text-amber-500"/>}
                            {nome}
                          </td>
                          {months.map(m => (
                            <td key={m.key} className="px-6 py-4 text-right align-top">
                              {dados[m.key] && (dados[m.key].pendente > 0 || dados[m.key].pago > 0) ? (
                                <div className="flex flex-col gap-1 items-end">
                                  {dados[m.key].pendente > 0 && <span className="text-amber-600 font-medium">{formatCurrency(dados[m.key].pendente)}</span>}
                                  {dados[m.key].pago > 0 && <span className="text-green-600 font-medium text-xs bg-green-50 px-1.5 py-0.5 rounded">{formatCurrency(dados[m.key].pago)}</span>}
                                </div>
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                          ))}
                          <td className="px-6 py-4 text-right bg-slate-50 border-l border-slate-200 align-top">
                            <div className="flex flex-col gap-1 items-end">
                               {dados.totalPendente > 0 && <span className="text-amber-700 font-bold">{formatCurrency(dados.totalPendente)}</span>}
                               {dados.totalPago > 0 && <span className="text-green-700 font-bold text-xs bg-green-100 px-1.5 py-0.5 rounded">{formatCurrency(dados.totalPago)}</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-800 text-white">
                      <tr>
                        <td className="px-6 py-4 font-bold">Pendente no Mês</td>
                        {months.map(m => <td key={`pendente-${m.key}`} className="px-6 py-4 text-right font-bold text-amber-300">{colTotals[m.key]?.pendente > 0 ? formatCurrency(colTotals[m.key].pendente) : '-'}</td>)}
                        <td className="px-6 py-4 text-right font-black text-amber-400 border-l border-slate-700 text-base">{formatCurrency(grandTotalPendente)}</td>
                      </tr>
                      <tr className="bg-slate-900 border-t border-slate-700">
                        <td className="px-6 py-4 font-bold text-slate-300">Pago no Mês</td>
                        {months.map(m => <td key={`pago-${m.key}`} className="px-6 py-4 text-right font-bold text-green-400">{colTotals[m.key]?.pago > 0 ? formatCurrency(colTotals[m.key].pago) : '-'}</td>)}
                        <td className="px-6 py-4 text-right font-black text-green-400 border-l border-slate-700 text-base">{formatCurrency(grandTotalPago)}</td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="flex flex-col items-center justify-center p-16 text-slate-400 bg-slate-50"><BarChart3 className="w-16 h-16 mb-4 text-slate-300" /><p className="text-lg font-bold text-slate-500">Nenhum dado financeiro</p></div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: RESULTADOS E MARGEM (DRE) */}
          {activeTab === 'resultados' && (
            <div className="p-6 print:hidden">
              <div className="mb-8 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><PieChart className="w-5 h-5 text-green-600"/> Resultados e Margem de Lucro</h2>
                <p className="text-sm text-slate-500 mt-1">Apuração baseada em <strong>Competência</strong> (Total Vendido vs. Notas Emitidas no mês).</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                
                {/* Form de Vendas */}
                <div className="lg:col-span-1 bg-green-50/50 p-5 rounded-xl border border-green-100 h-fit">
                  <h3 className="text-base font-bold mb-4 text-green-800">Lançar Mês</h3>
                  <form onSubmit={handleSaveVenda} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Mês de Referência</label>
                      <input type="month" value={formVenda.mes} onChange={e => setFormVenda({...formVenda, mes: e.target.value})} disabled={lojas.length === 0} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Valor de Venda (R$)</label>
                      <input type="number" step="0.01" value={formVenda.valorVendaInfo} onChange={e => setFormVenda({...formVenda, valorVendaInfo: e.target.value})} disabled={lojas.length === 0} placeholder="Ex: 55000.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Efetivado (R$)</label>
                      <input type="number" step="0.01" value={formVenda.faturamento} onChange={e => setFormVenda({...formVenda, faturamento: e.target.value})} disabled={lojas.length === 0} placeholder="Ex: 50000.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Armação / Lente C. (R$)</label>
                      <input type="number" step="0.01" value={formVenda.armacaoLente} onChange={e => setFormVenda({...formVenda, armacaoLente: e.target.value})} disabled={lojas.length === 0} placeholder="Ex: 15000.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Outras Despesas (R$)</label>
                      <input type="number" step="0.01" value={formVenda.outrasDespesas} onChange={e => setFormVenda({...formVenda, outrasDespesas: e.target.value})} disabled={lojas.length === 0} placeholder="Ex: 5000.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100" required />
                    </div>
                    <button type="submit" disabled={lojas.length === 0} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 px-4 rounded-lg text-sm mt-2 transition-colors">Gravar Dados</button>
                  </form>
                </div>

                {/* Tabela de DRE */}
                <div className="lg:col-span-3">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                    {resultadosPorMes.length > 0 ? (
                      <table className="w-full min-w-[1000px] text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Mês</th>
                            <th className="px-4 py-3 text-right text-slate-500">Valor Venda</th>
                            <th className="px-4 py-3 text-right">Efetivado</th>
                            <th className="px-4 py-3 text-right text-slate-700 bg-slate-50">Custo Lab (Auto)</th>
                            <th className="px-4 py-3 text-right text-slate-700 bg-slate-50">Armação / Lente C.</th>
                            <th className="px-4 py-3 text-right text-slate-700 bg-slate-50">Outras Despesas</th>
                            <th className="px-4 py-3 text-right font-black text-slate-800 border-l border-slate-200">Lucro Líquido</th>
                            <th className="px-4 py-3 text-center font-black text-slate-800">% Margem</th>
                            <th className="px-4 py-3 text-center w-16">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {resultadosPorMes.map(res => {
                            const vendaObj = vendas.find(v => v.lojaId === lojaSelecionadaId && v.mes === res.mes);
                            
                            const pctLab = res.faturamento > 0 ? (res.lab / res.faturamento) * 100 : 0;
                            const isLabOver = pctLab > configMetas.metaLab;
                            
                            const pctArmacao = res.faturamento > 0 ? (res.armacaoLente / res.faturamento) * 100 : 0;
                            const isArmacaoOver = pctArmacao > configMetas.metaArmacao;
                            
                            return (
                            <tr key={res.mes} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-bold text-slate-800">{formatMonth(res.mes)}</td>
                              <td className="px-4 py-3 text-right font-medium text-slate-500">{formatCurrency(res.valorVendaInfo)}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(res.faturamento)}</td>
                              
                              <td className="px-4 py-3 text-right bg-slate-50/30">
                                <div className="flex flex-col items-end">
                                  <span className="font-medium text-slate-700">{formatCurrency(res.lab)}</span>
                                  {res.faturamento > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 mt-0.5 rounded ${isLabOver ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                      {pctLab.toFixed(1)}% (Meta: {configMetas.metaLab}%)
                                    </span>
                                  )}
                                </div>
                              </td>
                              
                              <td className="px-4 py-3 text-right bg-slate-50/30">
                                <div className="flex flex-col items-end">
                                  <span className="font-medium text-slate-700">{formatCurrency(res.armacaoLente)}</span>
                                  {res.faturamento > 0 && (
                                    <span className={`text-[10px] font-bold px-1.5 mt-0.5 rounded ${isArmacaoOver ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                      {pctArmacao.toFixed(1)}% (Meta: {configMetas.metaArmacao}%)
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-right bg-slate-50/30 font-medium text-slate-700">
                                {formatCurrency(res.outrasDespesas)}
                              </td>

                              <td className="px-4 py-3 text-right font-black text-slate-900 border-l border-slate-100">{formatCurrency(res.lucroBruto)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${res.margemPct >= 40 ? 'bg-green-100 text-green-800' : res.margemPct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                  {res.margemPct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {vendaObj && (
                                  <div className="flex items-center justify-center gap-2">
                                    <button onClick={() => handleEditVenda(vendaObj)} className="text-slate-400 hover:text-indigo-600" title="Editar Lançamento"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteVenda(vendaObj.id)} className="text-slate-400 hover:text-red-500" title="Excluir Lançamento"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )})}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-12 text-center text-slate-400">
                        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-slate-300"/>
                        <p>Nenhuma venda ou custo registado ainda.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 flex gap-3">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-blue-600"/>
                    <p><strong>Nota Fiscal por Competência:</strong> O custo de Laboratório exibido soma o valor das notas com <strong>Data de Emissão</strong> no respectivo mês (vindo da aba Lançamentos). O Custo de Armação e Outras Despesas são os valores que você digitou acima.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: RELATORIOS */}
          <div className={`${activeTab === 'relatorios' ? 'block' : 'hidden'} print:block p-6 print:p-0`}>
            
            <div className="mb-6 border-b border-slate-100 pb-4 print:hidden">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-sky-600"/> Geração de Relatórios</h2>
              <p className="text-sm text-slate-500 mt-1">Filtre as informações desejadas e exporte em Excel (CSV) ou imprima em PDF.</p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6 print:hidden">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Relatório</label>
                  <select value={relatorioTipo} onChange={(e) => setRelatorioTipo(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none">
                    <option value="a_pagar">Contas a Pagar</option>
                    <option value="pagas">Contas Pagas</option>
                    <option value="todos">Todos os Lançamentos</option>
                    <option value="dre">Resultados (DRE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Início</label>
                  <input type="date" value={relatorioDataInicio} onChange={(e) => setRelatorioDataInicio(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim</label>
                  <input type="date" value={relatorioDataFim} onChange={(e) => setRelatorioDataFim(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white outline-none" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={exportarRelatorioCSV} disabled={isGeneratingPDF} className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors" title="Exportar para Excel (CSV)">
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button type="button" onClick={gerarPDF} disabled={isGeneratingPDF} className="flex-1 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-500 text-white font-medium py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm transition-colors" title="Gerar PDF">
                    {isGeneratingPDF ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Printer className="w-4 h-4" />}
                    {isGeneratingPDF ? 'Gerando...' : 'Gerar PDF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Print Area - Visível na aba Relatórios ou ao Imprimir */}
            <div id="print-area" className="bg-white print:m-0 print:p-0">
              <div id="print-header" className="hidden print:block mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">PráticaLab - Relatório</h1>
                <h2 className="text-lg text-slate-600">
                  {relatorioTipo === 'a_pagar' ? 'Contas a Pagar' : relatorioTipo === 'pagas' ? 'Contas Pagas' : relatorioTipo === 'todos' ? 'Todos os Lançamentos' : 'Resultados (DRE)'} - Loja: {lojaSelecionadaNome}
                </h2>
                <p className="text-sm text-slate-500">Período: {formatDate(relatorioDataInicio)} a {formatDate(relatorioDataFim)}</p>
                <hr className="mt-4 border-slate-300" />
              </div>

              <div id="relatorio-table-container" className="border border-slate-200 rounded-lg overflow-x-auto print:border-none">
                {(relatorioTipo === 'a_pagar' || relatorioTipo === 'pagas' || relatorioTipo === 'todos') ? (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-600 uppercase bg-slate-100 border-b border-slate-200 print:bg-transparent print:border-b-2 print:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Tipo / Entidade</th>
                        <th className="px-4 py-3">Nota/Emissão</th>
                        <th className="px-4 py-3 text-center">Parc.</th>
                        <th className="px-4 py-3">Vencimento</th>
                        {(relatorioTipo === 'pagas' || relatorioTipo === 'todos') && <th className="px-4 py-3">Pagamento</th>}
                        <th className="px-4 py-3 text-right">Valor</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                      {dadosRelatorio.length > 0 ? dadosRelatorio.map(item => (
                        <tr key={item.id} className="break-inside-avoid">
                          <td className="px-4 py-3 font-medium text-slate-800">{item.tipoCusto === 'laboratorio' ? 'Lab' : item.tipoCusto === 'armacao' ? 'Armação' : 'Outros'} - {item.entidadeNome}</td>
                          <td className="px-4 py-3">{item.numeroFechamento} <span className="text-xs text-slate-400 block">Emissão: {formatDate(item.dataEmissao)}</span></td>
                          <td className="px-4 py-3 text-center">{item.parcelaStr}</td>
                          <td className="px-4 py-3">{formatDate(item.dueDate)}</td>
                          {(relatorioTipo === 'pagas' || relatorioTipo === 'todos') && <td className="px-4 py-3 text-green-700">{formatDate(item.paymentDate)}</td>}
                          <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.amount)}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs uppercase">{item.status}</td>
                        </tr>
                      )) : <tr><td colSpan="7" className="p-8 text-center text-slate-400">Nenhum dado encontrado neste período.</td></tr>}
                      {dadosRelatorio.length > 0 && (
                        <tr className="bg-slate-50 font-bold print:bg-transparent print:border-t-2 print:border-slate-800 break-inside-avoid">
                          <td colSpan={(relatorioTipo === 'pagas' || relatorioTipo === 'todos') ? 5 : 4} className="px-4 py-4 text-right">TOTAL {relatorioTipo === 'pagas' ? 'PAGO' : relatorioTipo === 'todos' ? 'GERAL' : 'A PAGAR'} NO PERÍODO:</td>
                          <td className="px-4 py-4 text-right text-lg">{formatCurrency(dadosRelatorio.reduce((acc, curr) => acc + curr.amount, 0))}</td>
                          <td></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-700 uppercase text-xs font-bold border-b border-slate-200 print:bg-transparent print:border-b-2 print:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Mês</th>
                        <th className="px-4 py-3 text-right">Valor Venda</th>
                        <th className="px-4 py-3 text-right">Efetivado</th>
                        <th className="px-4 py-3 text-right">Custo Lab</th>
                        <th className="px-4 py-3 text-right">Armação / Lente C.</th>
                        <th className="px-4 py-3 text-right">Outras Despesas</th>
                        <th className="px-4 py-3 text-right font-black">Lucro Líquido</th>
                        <th className="px-4 py-3 text-center">% Margem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                      {dadosRelatorio.length > 0 ? dadosRelatorio.map(res => (
                        <tr key={res.mes} className="break-inside-avoid">
                          <td className="px-4 py-3 font-bold">{formatMonth(res.mes)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(res.valorVendaInfo)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(res.faturamento)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(res.lab)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(res.armacaoLente)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(res.outrasDespesas)}</td>
                          <td className="px-4 py-3 text-right font-black border-l border-slate-100 print:border-slate-300">{formatCurrency(res.lucroBruto)}</td>
                          <td className="px-4 py-3 text-center">{res.margemPct.toFixed(1)}%</td>
                        </tr>
                      )) : <tr><td colSpan="8" className="p-8 text-center text-slate-400">Nenhum dado encontrado neste período.</td></tr>}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* TAB 4: CONFIGURAÇÕES */}
          {activeTab === 'config' && (
            <div className="p-6 print:hidden">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-800">Configurações Cadastrais</h2>
                <p className="text-sm text-slate-500">Gerir as filiais, laboratórios e fornecedores de armação, além das metas de custos.</p>
              </div>

              {/* --- Seção de Metas --- */}
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl mb-8">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-600" />
                  Metas de Custos Máximos (%)
                </h3>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">% Máximo - Laboratório</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={configMetas.metaLab} 
                        onChange={e => setConfigMetas({...configMetas, metaLab: Number(e.target.value)})} 
                        onBlur={handleMetaBlur}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">% Máximo - Armação / Lente</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={configMetas.metaArmacao} 
                        onChange={e => setConfigMetas({...configMetas, metaArmacao: Number(e.target.value)})} 
                        onBlur={handleMetaBlur}
                        className="w-full pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none" 
                      />
                      <span className="absolute right-3 top-2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">Esses valores são salvos automaticamente e usados para alertar (verde/vermelho) na aba Resultados caso a porcentagem do custo supere sua meta frente ao faturamento.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Lojas */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Store className="w-4 h-4 text-indigo-600" /> Lojas</h3>
                  <form onSubmit={handleAddLoja} className="flex gap-2 mb-4">
                    <input type="text" value={novaLoja} onChange={e => setNovaLoja(e.target.value)} placeholder="Nova loja..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <button type="submit" disabled={!novaLoja.trim()} className="bg-slate-800 text-white px-3 rounded-lg text-sm">Add</button>
                  </form>
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <ul className="divide-y max-h-[300px] overflow-y-auto">
                      {lojas.map(loja => (
                        <li key={loja.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                          <span className="font-bold text-sm text-slate-800">{loja.nome}</span>
                          <button onClick={() => handleDeleteLoja(loja.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Laboratórios */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Factory className="w-4 h-4 text-indigo-600" /> Laboratórios</h3>
                  <form onSubmit={handleAddLaboratorio} className="flex gap-2 mb-4">
                    <input type="text" value={novoLaboratorio} onChange={e => setNovoLaboratorio(e.target.value)} placeholder="Novo laboratório..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <button type="submit" disabled={!novoLaboratorio.trim()} className="bg-slate-800 text-white px-3 rounded-lg text-sm">Add</button>
                  </form>
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <ul className="divide-y max-h-[300px] overflow-y-auto">
                      {laboratorios.map(lab => (
                        <li key={lab.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                          <span className="font-bold text-sm text-slate-800">{lab.nome}</span>
                          <button onClick={() => handleDeleteLaboratorio(lab.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Fornecedores (Armações) */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-sky-500" /> Fornecedores de Armação</h3>
                  <form onSubmit={handleAddFornecedor} className="flex gap-2 mb-4">
                    <input type="text" value={novoFornecedor} onChange={e => setNovoFornecedor(e.target.value)} placeholder="Novo fornecedor..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <button type="submit" disabled={!novoFornecedor.trim()} className="bg-slate-800 text-white px-3 rounded-lg text-sm">Add</button>
                  </form>
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <ul className="divide-y max-h-[300px] overflow-y-auto">
                      {fornecedores.map(forn => (
                        <li key={forn.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                          <span className="font-bold text-sm text-slate-800">{forn.nome}</span>
                          <button onClick={() => handleDeleteFornecedor(forn.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Outros Fornecedores */}
                <div>
                  <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-amber-500" /> Outros Fornecedores</h3>
                  <form onSubmit={handleAddOutroFornecedor} className="flex gap-2 mb-4">
                    <input type="text" value={novoOutroFornecedor} onChange={e => setNovoOutroFornecedor(e.target.value)} placeholder="Novo credor..." className="w-full px-3 py-2 border rounded-lg text-sm" />
                    <button type="submit" disabled={!novoOutroFornecedor.trim()} className="bg-slate-800 text-white px-3 rounded-lg text-sm">Add</button>
                  </form>
                  <div className="bg-white border rounded-xl overflow-hidden">
                    <ul className="divide-y max-h-[300px] overflow-y-auto">
                      {outrosFornecedores.map(of => (
                        <li key={of.id} className="p-3 flex justify-between items-center hover:bg-slate-50">
                          <span className="font-bold text-sm text-slate-800">{of.nome}</span>
                          <button onClick={() => handleDeleteOutroFornecedor(of.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}