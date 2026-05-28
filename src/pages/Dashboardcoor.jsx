import React, { useState, useEffect, useRef } from 'react';
import '../styles/Dashboardcoor.css';
import api, { eventoService, usuarioService } from '../services/api'; 
import { LayoutDashboard, UserCheck, Users, FileText, User } from 'lucide-react';

export const DashboardCoord = () => {
  
  const [activeTab, setActiveTab]         = useState('dashboard');
  const [activeSubTab, setActiveSubTab]   = useState('todos');
  const [isModalOpen, setIsModalOpen]     = useState(false);
  const [eventos, setEventos]             = useState([]); 
  const [membrosAtivos, setMembrosAtivos] = useState([]);
  const [candidatosPendentes, setCandidatosPendentes] = useState([]);
  const [alteracoesPendentes, setAlteracoesPendentes] = useState({});
  const [eventoEmDetalhe, setEventoEmDetalhe]         = useState(null);
  const [alocacoesEvento, setAlocacoesEvento]         = useState([]);
  const [editMode, setEditMode]                       = useState(false);
  const [idEventoEditando, setIdEventoEditando]       = useState(null);

  const [cancelamentosEvento,   setCancelamentosEvento]   = useState([]);
  const [justificativasAbertas, setJustificativasAbertas] = useState(new Set());

  const [activeSubTabRelatorio, setActiveSubTabRelatorio] = useState('qrcode');
  const [qrInfo,        setQrInfo]        = useState(null);
  const [qrSegundos,    setQrSegundos]    = useState(0);
  const [qrModalAberto, setQrModalAberto] = useState(false);
  const [qrFullscreen,  setQrFullscreen]  = useState(false);
  const qrTimerRef = useRef(null);

  const [eventoFormData, setEventoFormData] = useState({
    nome: '', serie: '', data: '', horario: '',
    duracao: '', vagas: '', valor: '', tipoFuncao: 'Ledor', observacoes: ''
  });

  const [perfilFormData, setPerfilFormData] = useState({
    nome:           localStorage.getItem('nomeUsuario')  || '',
    email:          localStorage.getItem('emailUsuario') || '',
    telefone:       '',
    instituicao:    'Heavenly International School',
    novaSenha:      '',
    confirmarSenha: '',
  });

  const nomeLogado = localStorage.getItem('nomeUsuario') || 'Coordenador';
  const iniciais   = nomeLogado && nomeLogado !== 'Coordenador'
    ? nomeLogado.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'CO';

  useEffect(() => {
    return () => { if (qrTimerRef.current) clearInterval(qrTimerRef.current); };
  }, []);

  // ── CARREGAR DADOS ─────────────────────────────────────────────
  const recarregarMembros = async () => {
    try {
      const dadosAtivos = await usuarioService.listarAtivos();
      setMembrosAtivos(dadosAtivos.map(c => ({
        id: c.idUsuario, nome: c.nomeCompleto, email: c.email, cpf: c.cpf, funcao: c.perfil,
      })));
    } catch (error) { console.error('Erro ao carregar membros:', error); }
  };

  const carregarDadosIniciais = async () => {
    try {
      const dadosEventos = await eventoService.listarEventos();
      const agora = new Date();

      setEventos(dadosEventos.map(e => {
        const dataProva   = new Date(e.dataProva);
        const passou      = dataProva < agora;
        const vagasLedor  = e.totalVagasLedor  ?? e.vagasLedor  ?? 0;
        const vagasFiscal = e.totalVagasFiscal ?? e.vagasFiscal ?? 0;

        return {
          id:               e.idEvento,
          titulo:           e.nomeProva || e.tituloProva || 'Sem título',
          serie:            e.serie || '',
          valor:            e.valorHora ? e.valorHora.toString() : '37',
          vagasTotais:      vagasLedor + vagasFiscal,
          vagasPreenchidas: e.vagasPreenchidas ?? 0,
          reservas:         0,

          // ── MUDANÇA 1: guarda os campos brutos para o cálculo inteligente ──
          vagasLedor,
          vagasFiscal,
          vagasLedorDisponiveis:  e.vagasLedorDisponiveis,
          vagasFiscalDisponiveis: e.vagasFiscalDisponiveis,
          // ────────────────────────────────────────────────────────────────────

          data: dataProva.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit',
            year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          status: e.statusEvento === 'CANCELADO' ? 'Cancelado'
                : passou                         ? 'Concluído'
                :                                  'Agendado',
        };
      }));

      const dadosPendentes = await usuarioService.listarPendentes();
      setCandidatosPendentes(dadosPendentes.map(c => ({
        id:              c.idUsuario,
        nome:            c.nomeCompleto,
        perfil:          c.perfil,
        email:           c.email,
        celular:         c.celular,
        dataCadastro:    c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : 'Recente',
        cpf:             c.cpf            || 'Não informado',
        dataNascimento:  c.dataNascimento ? new Date(c.dataNascimento).toLocaleDateString('pt-BR') : 'Não informado',
        escolaridade:    c.escolaridade   || 'N/A',
        cursoFormacao:   c.cursoFormacao  || 'N/A',
        materias:        c.materiasFacilidade || 'N/A',
        linkDiplomaLedor: c.linkDiplomaLedor || null,
      })));

      await recarregarMembros();
    } catch (error) { console.error('Erro ao carregar dados:', error); }
  };

  useEffect(() => { carregarDadosIniciais(); }, []);

  // ── HANDLERS GERAIS ────────────────────────────────────────────
  const handlePerfilChange = (e) => { const { name, value } = e.target; setPerfilFormData(prev => ({ ...prev, [name]: value })); };
  const handleInputChange  = (e) => { const { name, value } = e.target; setEventoFormData(prev => ({ ...prev, [name]: value })); };
  const handleSalvarPerfil = () => {
    if (perfilFormData.novaSenha && perfilFormData.novaSenha !== perfilFormData.confirmarSenha) {
      alert('As senhas não coincidem!'); return;
    }
    alert('Perfil atualizado com sucesso!');
  };
  const getAvatarColor = (name) => {
    if (!name) return '#ef4444';
    const colors = ['#ef4444', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  // ── APROVAÇÃO ──────────────────────────────────────────────────
  const handleAprovarCandidato = async (idCandidato) => {
    if (!window.confirm('Tem certeza que deseja aprovar este candidato?')) return;
    try {
      await usuarioService.aprovarUsuario(idCandidato);
      setCandidatosPendentes(prev => prev.filter(c => c.id !== idCandidato));
      await recarregarMembros();
      alert('Candidato aprovado! Agora ele pode fazer login.');
    } catch (error) { alert('Erro ao aprovar o candidato.'); console.error(error); }
  };

  const handleRecusarCandidato = async (idCandidato) => {
    if (!window.confirm('Tem certeza que deseja recusar este candidato?')) return;
    try {
      await usuarioService.recusarUsuario(idCandidato);
      setCandidatosPendentes(prev => prev.filter(c => c.id !== idCandidato));
      alert('Candidato recusado.');
    } catch (error) { alert('Erro ao recusar o candidato.'); console.error(error); }
  };

  // ── MEMBROS ────────────────────────────────────────────────────
  const handleMudancaFuncao     = (idMembro, novaFuncao) => setAlteracoesPendentes(prev => ({ ...prev, [idMembro]: novaFuncao }));
  const handleSalvarAlteracoes  = async () => {
    const ids = Object.keys(alteracoesPendentes);
    if (ids.length === 0) { alert('Nenhuma alteração feita.'); return; }
    try {
      await Promise.all(ids.map(id => usuarioService.alterarPerfil(id, alteracoesPendentes[id])));
      setMembrosAtivos(prev => prev.map(m => ({ ...m, funcao: alteracoesPendentes[m.id] || m.funcao })));
      setAlteracoesPendentes({});
      alert('Funções atualizadas!');
    } catch (error) { alert('Erro ao salvar alterações.'); }
  };

  // ── EVENTOS: CRIAR ─────────────────────────────────────────────
  const handleCriarEvento = async (e) => {
    e.preventDefault();
    try {
      const dataInicioExata = `${eventoFormData.data}T${eventoFormData.horario}:00`;
      const [ano, mes, dia] = eventoFormData.data.split('-');
      const [hora, min]     = eventoFormData.horario.split(':');
      const duracao         = parseInt(eventoFormData.duracao) || 1;
      const horaFim         = parseInt(hora) + duracao;
      const dataFimExata    = `${ano}-${mes}-${dia}T${horaFim.toString().padStart(2,'0')}:${min}:00`;
      const vagas           = parseInt(eventoFormData.vagas) || 0;
      const dto = {
        TituloProva: eventoFormData.nome, Serie: eventoFormData.serie || 'HIS',
        LocalProva:  'Heavenly International School',
        DataProva:   dataInicioExata, HorarioFim: dataFimExata,
        ValorHora:   parseFloat(eventoFormData.valor) || 37,
        Observacoes: eventoFormData.observacoes || '',
        VagasLedor:  eventoFormData.tipoFuncao === 'Ledor'  ? vagas : (eventoFormData.tipoFuncao === 'Ambos' ? Math.ceil(vagas / 2)  : 0),
        VagasFiscal: eventoFormData.tipoFuncao === 'Fiscal' ? vagas : (eventoFormData.tipoFuncao === 'Ambos' ? Math.floor(vagas / 2) : 0),
      };
      const salvo = await eventoService.criarEvento(dto);

      const vl = salvo.vagasLedor  || 0;
      const vf = salvo.vagasFiscal || 0;

      setEventos(prev => [...prev, {
        id:               salvo.idEvento || Date.now(),
        titulo:           salvo.nomeProva || eventoFormData.nome,
        serie:            eventoFormData.serie || '',
        valor:            eventoFormData.valor || '37',
        vagasTotais:      vl + vf,
        vagasPreenchidas: salvo.vagasPreenchidas || 0,
        reservas:         0,

        // ── MUDANÇA 2: mesmos campos brutos no evento recém-criado ──
        vagasLedor:            vl,
        vagasFiscal:           vf,
        vagasLedorDisponiveis:  salvo.vagasLedorDisponiveis,
        vagasFiscalDisponiveis: salvo.vagasFiscalDisponiveis,
        // ────────────────────────────────────────────────────────────

        data: new Date(salvo.dataProva).toLocaleString('pt-BR', {
          day:'2-digit', month:'2-digit', year:'numeric',
          hour:'2-digit', minute:'2-digit'
        }),
        status: 'Agendado',
      }]);

      setIsModalOpen(false);
      setEventoFormData({ nome:'',serie:'',data:'',horario:'',duracao:'',vagas:'',valor:'',tipoFuncao:'Ledor',observacoes:'' });
      alert('Evento criado com sucesso!');
    } catch (error) {
      const msg = error.response?.data?.mensagem || (error.response?.data?.errors ? JSON.stringify(error.response?.data?.errors) : 'Verifique os dados e tente novamente.');
      alert(`Erro ao criar evento: ${msg}`); console.error(error);
    }
  };

  // ── EVENTOS: DETALHES ──────────────────────────────────────────
  const abrirDetalhesEvento = async (ev) => {
    setEventoEmDetalhe(ev);
    setJustificativasAbertas(new Set());
    setCancelamentosEvento([]);
    try {
      const resposta = await api.get(`/alocacoes/${ev.id}/lista`);
      const todas = resposta.data.map(a => ({
        id:               a.idAlocacao  || a.id,
        nome:             a.nomeUsuario || 'Nome não informado',
        email:            a.email       || 'Sem e-mail',
        funcao:           a.papelEvento || 'Ledor',
        sala:             a.salaDesignada || '',
        status:           a.statusParticipacao === 'Confirmado' ? 'Confirmado'
                        : a.statusParticipacao === 'Cancelado'  ? 'Cancelado'
                        :                                         'Na Reserva',
        horarioEntrada:   a.horarioEntrada || '',
        horarioSaida:     a.horarioSaida   || '',
        motivo:           a.motivoCancelamento           || '',
        justificativa:    a.justificativaCancelamento    || '',
        dataCancelamento: a.dataCancelamento
          ? (() => {
              const d = new Date(a.dataCancelamento);
              return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
            })()
          : '',
        antecedencia: a.antecedencia || '',
      }));
      setAlocacoesEvento(todas.filter(a => a.status !== 'Cancelado'));
      setCancelamentosEvento(todas.filter(a => a.status === 'Cancelado'));
    } catch (error) {
      console.error("Erro ao buscar inscritos:", error.response?.data || error.message);
      alert("Não foi possível carregar os inscritos do banco.");
      setAlocacoesEvento([]); setCancelamentosEvento([]);
    }
  };

  const getMotivoEstilo = (motivo) => {
    const map = {
      'Problema de saúde':      { bg: '#fce7f3', color: '#9d174d', emoji: '🏥' },
      'Emergência familiar':    { bg: '#fff7ed', color: '#c2410c', emoji: '🫂' },
      'Conflito de agenda':     { bg: '#f0fdf4', color: '#15803d', emoji: '📅' },
      'Problema de transporte': { bg: '#eff6ff', color: '#1d4ed8', emoji: '🚌' },
    };
    return map[motivo] || { bg: '#f1f3f6', color: '#64728a', emoji: '•' };
  };

  const toggleJustificativa = (id) => {
    setJustificativasAbertas(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const abrirModalEdicao = () => {
    if (!eventoEmDetalhe) return;
    try {
      const [dataPart, horaPart] = eventoEmDetalhe.data.split(', ');
      const [dia, mes, ano]      = dataPart.split('/');
      setEditMode(true); setIdEventoEditando(eventoEmDetalhe.id);
      setEventoFormData({ nome: eventoEmDetalhe.titulo, serie: eventoEmDetalhe.serie || '',
        data: `${ano}-${mes}-${dia}`, horario: horaPart, duracao: '4',
        vagas: eventoEmDetalhe.vagasTotais.toString(), valor: eventoEmDetalhe.valor, tipoFuncao: 'Ambos', observacoes: '' });
      setIsModalOpen(true);
    } catch (e) { console.error("Erro ao converter data:", e); setEditMode(true); setIdEventoEditando(eventoEmDetalhe.id); setIsModalOpen(true); }
  };

  const handleSalvarEdicao = async (e) => {
    e.preventDefault();
    try {
      const fusoBrasilia = "-03:00";
      const [ano, mes, dia] = eventoFormData.data.split('-');
      const [hora, min]     = eventoFormData.horario.split(':');
      const dataInicioExata = `${eventoFormData.data}T${eventoFormData.horario}:00${fusoBrasilia}`;
      const duracao  = parseInt(eventoFormData.duracao) || 1;
      const horaFim  = parseInt(hora) + duracao;
      const dataFimExata = `${ano}-${mes}-${dia}T${horaFim.toString().padStart(2,'0')}:${min}:00${fusoBrasilia}`;
      const vagas = parseInt(eventoFormData.vagas) || 0;
      const dto = {
        TituloProva: eventoFormData.nome, Serie: eventoFormData.serie || 'HIS',
        LocalProva: 'Heavenly International School',
        DataProva: dataInicioExata, HorarioFim: dataFimExata,
        ValorHora: parseFloat(eventoFormData.valor) || 37,
        Observacoes: eventoFormData.observacoes || '',
        VagasLedor:  eventoFormData.tipoFuncao === 'Ledor'  ? vagas : (eventoFormData.tipoFuncao === 'Ambos' ? Math.ceil(vagas / 2)  : 0),
        VagasFiscal: eventoFormData.tipoFuncao === 'Fiscal' ? vagas : (eventoFormData.tipoFuncao === 'Ambos' ? Math.floor(vagas / 2) : 0),
      };
      await api.put(`/eventos/${idEventoEditando}`, dto);
      const dataFormatadaPtBr = `${dia}/${mes}/${ano}, ${hora}:${min}`;
      setEventos(prev => prev.map(ev => ev.id === idEventoEditando ? { ...ev, titulo: dto.TituloProva, data: dataFormatadaPtBr, valor: `R$ ${dto.ValorHora}/hora` } : ev));
      setIsModalOpen(false);
      alert('✅ Evento atualizado com sucesso!');
    } catch (error) { console.error("Erro ao salvar edição:", error); alert("Erro ao editar."); }
  };

  const handleCancelarInscricao = async (inscrito) => {
    const idDaAlocacao    = inscrito.idAlocacao || inscrito.IdAlocacao || inscrito.id;
    const nomeDoCandidato = inscrito.nomeUsuario || inscrito.NomeUsuario || 'este candidato';
    if (!idDaAlocacao) { console.error("Dados:", inscrito); alert("Erro: ID não encontrado. Veja F12."); return; }
    if (!window.confirm(`Remover ${nomeDoCandidato}?`)) return;
    try {
      await api.delete(`/alocacoes/${idDaAlocacao}`);
      await carregarDetalhesDaProva(idEvento); 
      await carregarEventos();
      setAlocacoesEvento(prev => prev.filter(i => (i.idAlocacao || i.IdAlocacao || i.id) !== idDaAlocacao));
      alert("✅ Inscrição cancelada com sucesso!");
    } catch (error) { console.error("Erro ao cancelar:", error); alert("Erro ao cancelar a inscrição."); }
  };

  const atualizaSalaCandidato = (id, novaSala) => setAlocacoesEvento(prev => prev.map(a => a.id === id ? { ...a, sala: novaSala } : a));

  const handlePublicarSalas = async () => {
    try {
      await api.put('/alocacoes/salvar-salas', alocacoesEvento.map(a => ({ IdAlocacao: a.id, Sala: a.sala || '' })));
      alert('✅ Salas publicadas com sucesso!');
    } catch (error) { console.error("Erro ao publicar salas:", error); alert('Erro ao publicar as salas.'); }
  };

  // ── QR CODE ───────────────────────────────────────────────────
  const gerarToken    = () => Math.random().toString(36).substring(2, 10).toUpperCase();
  const formatarTimer = (s) => `${Math.floor(s/60).toString().padStart(2,'00')}:${(s%60).toString().padStart(2,'00')}`;

  const abrirQrEvento = (ev) => {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    const token   = gerarToken();
    const payload = `EVENTO:${ev.id}|NOME:${ev.titulo}|DATA:${ev.data}|TOKEN:${token}`;
    setQrInfo({ eventoId: ev.id, nome: ev.titulo, data: ev.data, payload });
    setQrSegundos(1800); setQrModalAberto(true);
    qrTimerRef.current = setInterval(() => {
      setQrSegundos(prev => { if (prev <= 0) { clearInterval(qrTimerRef.current); return 0; } return prev - 1; });
    }, 1000);
  };

  const fecharQrModal = () => { setQrModalAberto(false); setQrFullscreen(false); if (qrTimerRef.current) clearInterval(qrTimerRef.current); };
  const qrImageUrl    = (tam = 280) => qrInfo ? `https://api.qrserver.com/v1/create-qr-code/?size=${tam}x${tam}&data=${encodeURIComponent(qrInfo.payload)}&ecc=M&color=0d1428&bgcolor=FFFFFF` : '';

  const totalAgendados  = eventos.filter(e => e.status === 'Agendado').length;
  const totalConcluidos = eventos.filter(e => e.status === 'Concluído').length;

  // ──────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-container">

      {/* NAVBAR */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          Gestão Ledores e Fiscais
          <div className="his-mark">H<span className="dot">·</span>I<span className="dot">·</span>S</div>
        </div>
        <div className="nav-actions">
          <button className={`nav-btn ${activeTab !== 'relatorios' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setEventoEmDetalhe(null); }}>Eventos</button>
          <button className={`nav-btn ${activeTab === 'relatorios' ? 'active' : ''}`} onClick={() => { setActiveTab('relatorios'); setEventoEmDetalhe(null); }}>Relatórios</button>
          <div className="nav-sep"></div>
          <button className="nav-avatar-wrap" onClick={() => setActiveTab('perfil')}>
            <div className="avatar"><span>{iniciais}</span></div>
            <div className="nav-user-info">
              <div className="nav-user-name">{perfilFormData.nome || nomeLogado}</div>
              <span className="nav-user-role">Coordenação</span>
            </div>
          </button>
        </div>
      </nav>

      {/* TABS */}
      <div className="tabs-bar">
        <button className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setEventoEmDetalhe(null); }}>
          <div className="icon-container"><LayoutDashboard size={24} strokeWidth={1.5} /></div>
          <span className="tab-label">Dashboard</span>
        </button>
        <button className={`tab ${activeTab === 'aprovacao' ? 'active' : ''}`} onClick={() => setActiveTab('aprovacao')}>
          <div className="icon-container">
            <UserCheck size={24} strokeWidth={1.5} />
            {candidatosPendentes.length > 0 && <span className="badge-flutuante">{candidatosPendentes.length}</span>}
          </div>
          <span className="tab-label">Aprovar</span>
        </button>
        <button className={`tab ${activeTab === 'membros' ? 'active' : ''}`} onClick={() => setActiveTab('membros')}>
          <div className="icon-container"><Users size={24} strokeWidth={1.5} /></div>
          <span className="tab-label">Membros</span>
        </button>
        <button className={`tab ${activeTab === 'relatorios' ? 'active' : ''}`} onClick={() => setActiveTab('relatorios')}>
          <div className="icon-container"><FileText size={24} strokeWidth={1.5} /></div>
          <span className="tab-label">Relatórios</span>
        </button>
        <button className={`tab ${activeTab === 'perfil' ? 'active' : ''}`} onClick={() => setActiveTab('perfil')}>
          <div className="icon-container"><User size={24} strokeWidth={1.5} /></div>
          <span className="tab-label">Perfil</span>
        </button>
      </div>

      <main className="page">

        {/* ══ DASHBOARD ══ */}
        {activeTab === 'dashboard' && (
          <div className="panel active">
            {!eventoEmDetalhe ? (
              <>
                <div className="page-header">
                  <div><h1 className="page-title">Dashboard da Coordenação</h1><p className="page-sub">Gerencie dias de prova, ledores e fiscais.</p></div>
                  <button className="btn-primary" onClick={() => { setEditMode(false); setIsModalOpen(true); }}>+ Novo Evento</button>
                </div>
                <div className="stats">
                  <div className="stat"><div className="stat-ico si-blue">📅</div><div><div className="stat-lbl">Próximos Eventos</div><div className="stat-val">{totalAgendados}</div></div></div>
                  <div className="stat"><div className="stat-ico si-green">👥</div><div><div className="stat-lbl">Membros Ativos</div><div className="stat-val">{membrosAtivos.length}</div></div></div>
                  <div className="stat"><div className="stat-ico si-amber">⏳</div><div><div className="stat-lbl">Aguardando Aprovação</div><div className="stat-val">{candidatosPendentes.length}</div></div></div>
                  <div className="stat"><div className="stat-ico si-red">📈</div><div><div className="stat-lbl">Eventos Concluídos</div><div className="stat-val">{totalConcluidos}</div></div></div>
                </div>
                <div className="card">
                  <div className="card-head"><span className="card-title">Todos os Eventos</span></div>
                  <div className="sub-tabs">
                    <button className={`sub-tab ${activeSubTab==='todos'      ? 'active':''}`} onClick={() => setActiveSubTab('todos')}>Todos</button>
                    <button className={`sub-tab ${activeSubTab==='agendados'  ? 'active':''}`} onClick={() => setActiveSubTab('agendados')}>Agendados</button>
                    <button className={`sub-tab ${activeSubTab==='concluidos' ? 'active':''}`} onClick={() => setActiveSubTab('concluidos')}>Concluídos</button>
                  </div>
                  <div className="tbl-wrap" style={{ padding: '20px' }}>
                    {eventos.length === 0 ? (
                      <div style={{ textAlign:'center', padding:'40px 20px' }}>
                        <div style={{ fontSize:'40px', marginBottom:'10px' }}>📂</div>
                        <h3 style={{ color:'var(--gray-700)', marginBottom:'5px' }}>Nenhum evento cadastrado</h3>
                        <button className="btn-primary" onClick={() => { setEditMode(false); setIsModalOpen(true); }}>Criar meu primeiro evento</button>
                      </div>
                    ) : (
                      <table>
                        <thead>
                          <tr><th>EVENTO</th><th>DATA</th><th>OCUPAÇÃO</th><th>STATUS</th><th>AÇÃO</th></tr>
                        </thead>
                        <tbody>
                          {eventos.filter(ev => {
                            if (activeSubTab==='agendados')  return ev.status==='Agendado';
                            if (activeSubTab==='concluidos') return ev.status==='Concluído';
                            return true;
                          // ── MUDANÇA 3: map virou bloco para calcular ocupação antes do return ──
                          }).map(ev => {
                            // Cálculo inteligente de ocupação — ignora reservas e trata null do backend
                            const vl = ev.vagasLedor  ?? 0;
                            const vf = ev.vagasFiscal ?? 0;
                            const total      = vl + vf;
                            const ledorDisp  = Math.max(0, ev.vagasLedorDisponiveis  !== undefined && ev.vagasLedorDisponiveis  !== null ? ev.vagasLedorDisponiveis  : vl);
                            const fiscalDisp = Math.max(0, ev.vagasFiscalDisponiveis !== undefined && ev.vagasFiscalDisponiveis !== null ? ev.vagasFiscalDisponiveis : vf);
                            const ocupacao   = (vl - ledorDisp) + (vf - fiscalDisp);
                            const pct        = total > 0 ? (ocupacao / total) * 100 : 0;
                            // ────────────────────────────────────────────────────────────────────
                            return (
                              <tr key={ev.id}>
                                <td>
                                  <strong style={{ fontSize:'14px', color:'#1a1a1a' }}>{ev.titulo}</strong>
                                  <div style={{ fontSize:'12px', color:'#6b7280' }}>R$ {ev.valor}/hora</div>
                                </td>
                                <td style={{ fontSize:'14px', color:'#4b5563' }}>{ev.data}</td>
                                <td>
                                  {/* Coluna de ocupação agora usa o cálculo inteligente */}
                                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                                    <div style={{ width:'120px', height:'6px', backgroundColor:'#e5e7eb', borderRadius:'4px', overflow:'hidden' }}>
                                      <div style={{
                                        width: `${pct}%`,
                                        height: '100%',
                                        backgroundColor: pct >= 100 ? '#10b981' : '#3b82f6'
                                      }} />
                                    </div>
                                    <span style={{ fontSize:'13px' }}>{ocupacao}/{total}</span>
                                  </div>
                                  {ev.reservas > 0 && (
                                    <span style={{ fontSize:'11px', color:'#d97706' }}>+{ev.reservas} na reserva</span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ backgroundColor: ev.status==='Concluído'?'#d1fae5':ev.status==='Cancelado'?'#fee2e2':'#e0e7ff', color: ev.status==='Concluído'?'#065f46':ev.status==='Cancelado'?'#991b1b':'#4338ca', padding:'4px 12px', borderRadius:'9999px', fontSize:'12px', fontWeight:'500' }}>
                                    {ev.status}
                                  </span>
                                </td>
                                <td>
                                  <button onClick={() => abrirDetalhesEvento(ev)} style={{ background:'none', border:'none', color:'#2563eb', fontWeight:'600', cursor:'pointer', fontSize:'14px' }}>
                                    Detalhes →
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>

            ) : eventoEmDetalhe.status === 'Concluído' ? (
              <div>
                <div style={{ marginBottom:'20px', fontSize:'14px', fontWeight:'600', display:'flex', alignItems:'center', gap:'8px' }}>
                  <button onClick={() => setEventoEmDetalhe(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:0 }}>← Voltar ao Dashboard</button>
                  <span style={{ color:'#cbd5e1' }}>/</span>
                  <span style={{ color:'#2563eb' }}>{eventoEmDetalhe.titulo}</span>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'22px 24px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' }}>
                  <div>
                    <h1 style={{ fontSize:'22px', fontWeight:'800', color:'#0f172a', margin:'0 0 10px 0' }}>{eventoEmDetalhe.titulo}</h1>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'18px', fontSize:'13px', color:'#64748b', alignItems:'center' }}>
                      <span>📅 {eventoEmDetalhe.data}</span>
                      {eventoEmDetalhe.serie && <span><strong style={{ color:'#374151' }}>Série:</strong> {eventoEmDetalhe.serie}</span>}
                      <span>R$ {eventoEmDetalhe.valor}/hora</span>
                      <span style={{ background:'#d1fae5', color:'#065f46', padding:'3px 10px', borderRadius:'9999px', fontWeight:'600', fontSize:'12px' }}>Concluído</span>
                    </div>
                  </div>
                  <button onClick={() => alert('Exportando relatório...')} style={{ padding:'9px 18px', border:'1px solid #d1d5db', background:'#fff', borderRadius:'8px', color:'#374151', fontWeight:'600', cursor:'pointer', fontSize:'13.5px', display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Exportar Relatório
                  </button>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', marginBottom:'20px', overflow:'hidden' }}>
                  <div style={{ padding:'16px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'15px', fontWeight:'600', color:'#0f172a', display:'flex', alignItems:'center', gap:'7px' }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Equipe que Aplicou
                      </div>
                      <div style={{ fontSize:'12.5px', color:'#64748b', marginTop:'2px' }}>Membros que compareceram e registraram ponto</div>
                    </div>
                    {alocacoesEvento.filter(a => a.status === 'Confirmado').length > 0 && (
                      <span style={{ background:'#dcfce7', color:'#15803d', padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'700' }}>
                        {alocacoesEvento.filter(a => a.status === 'Confirmado').length} presentes
                      </span>
                    )}
                  </div>
                  <div style={{ background:'#f8f9fb', padding:'10px 22px', display:'grid', gridTemplateColumns:'1fr 120px 180px 100px 100px', gap:'16px', borderBottom:'1px solid #e5e7eb' }}>
                    {['MEMBRO','FUNÇÃO','SALA','ENTRADA','SAÍDA'].map(h => (
                      <span key={h} style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</span>
                    ))}
                  </div>
                  {alocacoesEvento.filter(a => a.status === 'Confirmado').length === 0 ? (
                    <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>Nenhum membro confirmou presença com ponto registrado.</div>
                  ) : (
                    alocacoesEvento.filter(a => a.status === 'Confirmado').map((m, i, arr) => (
                      <div key={m.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px 180px 100px 100px', gap:'16px', padding:'14px 22px', alignItems:'center', borderBottom: i < arr.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                        <div><div style={{ fontWeight:'600', color:'#0f172a', fontSize:'13.5px' }}>{m.nome}</div><div style={{ fontSize:'12px', color:'#94a3b8' }}>{m.email}</div></div>
                        <span style={{ background: m.funcao==='Ledor'?'#eff6ff':'#f3e8ff', color: m.funcao==='Ledor'?'#2563eb':'#9333ea', padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'700', display:'inline-block' }}>{m.funcao}</span>
                        <span style={{ fontSize:'13px', color:'#374151' }}>{m.sala || <span style={{ color:'#94a3b8', fontStyle:'italic' }}>—</span>}</span>
                        <span style={{ fontFamily:'monospace', fontSize:'13px', fontWeight:'600', color: m.horarioEntrada ? '#16a34a' : '#94a3b8' }}>{m.horarioEntrada || '—'}</span>
                        <span style={{ fontFamily:'monospace', fontSize:'13px', fontWeight:'600', color: m.horarioSaida ? '#dc2626' : '#94a3b8' }}>{m.horarioSaida || '—'}</span>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', overflow:'hidden', marginBottom:'20px' }}>
                  <div style={{ padding:'16px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'15px', fontWeight:'600', color:'#0f172a', display:'flex', alignItems:'center', gap:'7px' }}>
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        Cancelamentos
                      </div>
                      <div style={{ fontSize:'12.5px', color:'#64748b', marginTop:'2px' }}>Candidatos que se inscreveram e cancelaram antes da prova</div>
                    </div>
                    {cancelamentosEvento.length > 0 && (
                      <span style={{ background:'#fde8e6', color:'#c0392b', padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'700' }}>{cancelamentosEvento.length} cancelamentos</span>
                    )}
                  </div>
                  {cancelamentosEvento.length === 0 ? (
                    <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>Nenhum cancelamento registrado para esta prova.</div>
                  ) : (
                    cancelamentosEvento.map((c, i, arr) => {
                      const estiloMotivo = getMotivoEstilo(c.motivo);
                      const justAberta   = justificativasAbertas.has(c.id);
                      return (
                        <div key={c.id} style={{ padding:'16px 22px', borderBottom: i < arr.length-1 ? '1px solid #f1f5f9':'none' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
                            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: getAvatarColor(c.nome), color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>
                              {c.nome ? c.nome.substring(0,2).toUpperCase() : 'US'}
                            </div>
                            <div style={{ flex:1, minWidth:'140px' }}>
                              <div style={{ fontWeight:'600', fontSize:'13.5px', color:'#0f172a' }}>{c.nome}</div>
                              <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'1px' }}>
                                {c.dataCancelamento ? `Cancelou em ${c.dataCancelamento}` : 'Data não registrada'}
                                {c.antecedencia && <span style={{ marginLeft:'6px' }}>· {c.antecedencia}</span>}
                              </div>
                            </div>
                            <span style={{ background: c.funcao==='Ledor'?'#eff6ff':'#f3e8ff', color: c.funcao==='Ledor'?'#2563eb':'#9333ea', padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'700', flexShrink:0 }}>{c.funcao}</span>
                            {c.motivo && (
                              <span style={{ background: estiloMotivo.bg, color: estiloMotivo.color, padding:'4px 11px', borderRadius:'20px', fontSize:'12px', fontWeight:'600', display:'inline-flex', alignItems:'center', gap:'5px', flexShrink:0 }}>
                                <span>{estiloMotivo.emoji}</span>{c.motivo}
                              </span>
                            )}
                            {c.justificativa && (
                              <button onClick={() => toggleJustificativa(c.id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'#2563eb', fontWeight:'500', display:'flex', alignItems:'center', gap:'4px', flexShrink:0, fontFamily:'inherit' }}>
                                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform: justAberta ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                                {justAberta ? 'ocultar' : 'ver justificativa'}
                              </button>
                            )}
                          </div>
                          {justAberta && c.justificativa && (
                            <div style={{ marginTop:'10px', padding:'12px 14px', background:'#f8f9fb', border:'1px solid #f1f5f9', borderRadius:'8px', fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>{c.justificativa}</div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div style={{ padding:'12px 22px', background:'#f8f9fb', borderTop:'1px solid #f1f5f9', display:'flex', flexWrap:'wrap', gap:'8px', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.05em', marginRight:'4px' }}>Legenda:</span>
                    {[{ label:'Problema de saúde', bg:'#fce7f3', color:'#9d174d' },{ label:'Emergência familiar', bg:'#fff7ed', color:'#c2410c' },{ label:'Conflito de agenda', bg:'#f0fdf4', color:'#15803d' },{ label:'Problema de transporte', bg:'#eff6ff', color:'#1d4ed8' },{ label:'Outro', bg:'#f1f3f6', color:'#64728a' }].map(l => (
                      <span key={l.label} style={{ background:l.bg, color:l.color, padding:'3px 10px', borderRadius:'20px', fontSize:'11.5px', fontWeight:'600' }}>{l.label}</span>
                    ))}
                  </div>
                </div>
              </div>

            ) : (
              <div className="detalhes-evento-view">
                <div style={{ marginBottom:'20px', fontSize:'14px', fontWeight:'600' }}>
                  <button onClick={() => setEventoEmDetalhe(null)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', padding:0 }}>&lt; Voltar ao Dashboard</button>
                  <span style={{ color:'#cbd5e1', margin:'0 8px' }}>/</span>
                  <span style={{ color:'#2563eb' }}>{eventoEmDetalhe.titulo}</span>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'24px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
                  <div>
                    <h1 style={{ fontSize:'24px', fontWeight:'800', color:'#0f172a', margin:'0 0 16px 0' }}>{eventoEmDetalhe.titulo}</h1>
                    <div style={{ display:'flex', gap:'24px', fontSize:'13px', color:'#64748b' }}>
                      <span>📅 {eventoEmDetalhe.data}</span>
                      <span>💲 R$ {eventoEmDetalhe.valor}/h</span>
                      <span style={{ background:'#eff6ff', color:'#2563eb', padding:'4px 10px', borderRadius:'12px', fontWeight:'600' }}>{eventoEmDetalhe.status}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'12px' }}>
                    <button onClick={abrirModalEdicao} style={{ padding:'10px 20px', border:'1px solid #d1d5db', background:'#fff', borderRadius:'8px', color:'#475569', fontWeight:'600', cursor:'pointer' }}>Editar Evento</button>
                    <button onClick={handlePublicarSalas} style={{ padding:'10px 20px', border:'none', background:'#2563eb', borderRadius:'8px', color:'#fff', fontWeight:'600', cursor:'pointer' }}>Publicar Salas</button>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'24px', marginBottom:'24px' }}>
                  <h2 style={{ fontSize:'18px', fontWeight:'700', color:'#0f172a', margin:'0 0 4px 0' }}>Distribuição de Salas</h2>
                  <p style={{ fontSize:'13px', color:'#64748b', margin:'0 0 24px 0' }}>Selecione a sala para cada ledor ou aplicador designado.</p>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom:'1px solid #e5e7eb', textAlign:'left' }}>
                        {['MEMBRO','FUNÇÃO','SALA DESIGNADA','STATUS','AÇÕES'].map((h,i) => <th key={h} style={{ padding:'12px 0', fontSize:'11px', color:'#94a3b8', fontWeight:'700', textAlign: i===4?'right':undefined }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {alocacoesEvento.length === 0 ? (
                        <tr><td colSpan="5" style={{ padding:'30px', textAlign:'center', color:'#64748b', fontSize:'14px' }}>Nenhum candidato inscrito nesta prova ainda.</td></tr>
                      ) : (
                        alocacoesEvento.map((candidato, index) => (
                          <tr key={candidato.id} style={{ borderBottom: index < alocacoesEvento.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                            <td style={{ padding:'16px 0' }}>
                              <div style={{ fontWeight:'700', color: candidato.status==='Cancelado'?'#94a3b8':'#0f172a', textDecoration: candidato.status==='Cancelado'?'line-through':'none' }}>{candidato.nome}</div>
                              <div style={{ color:'#94a3b8', fontSize:'12px' }}>{candidato.email}</div>
                            </td>
                            <td style={{ padding:'16px 0' }}>
                              <span style={{ background: candidato.funcao==='Ledor'?'#eff6ff':'#f3e8ff', color: candidato.funcao==='Ledor'?'#3b82f6':'#a855f7', padding:'4px 16px', borderRadius:'12px', fontSize:'12px', fontWeight:'700', opacity: candidato.status==='Cancelado'?0.5:1 }}>{candidato.funcao}</span>
                            </td>
                            <td style={{ padding:'16px 0' }}>
                              {candidato.status === 'Confirmado' ? (
                                <input type="text" placeholder="Ex: Sala 101 - Bloco A" value={candidato.sala||''} onChange={e => atualizaSalaCandidato(candidato.id, e.target.value)} style={{ padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:'6px', fontSize:'13px', width:'220px', outline:'none', color:'#334155' }} />
                              ) : (
                                <span style={{ color:'#94a3b8', fontSize:'13px', fontStyle:'italic' }}>— {candidato.status==='Cancelado'?'Vaga devolvida':'Reserva, aguardando'}</span>
                              )}
                            </td>
                            <td style={{ padding:'16px 0' }}>
                              <span style={{ color: candidato.status==='Confirmado'?'#2563eb':candidato.status==='Na Reserva'?'#64748b':'#ef4444', fontSize:'13px', fontWeight:'700' }}>{candidato.status}</span>
                            </td>
                            <td style={{ padding:'16px 0', textAlign:'right' }}>
                              {candidato.status === 'Confirmado' && (
                                <button onClick={() => handleCancelarInscricao(candidato)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Cancelar Inscrição</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'24px' }}>
                    <button onClick={() => alert('Salas salvas!')} style={{ padding:'10px 24px', background:'#2563eb', color:'#fff', border:'none', borderRadius:'8px', fontWeight:'600', cursor:'pointer' }}>✓ Salvar Salas</button>
                  </div>
                </div>
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'24px' }}>
                  <h2 style={{ fontSize:'18px', fontWeight:'700', color:'#0f172a', margin:'0 0 4px 0' }}>Observações da Prova</h2>
                  <textarea placeholder="Descreva ocorrências, ajustes ou informações relevantes..." rows="4" style={{ width:'100%', padding:'16px', border:'1px solid #e2e8f0', borderRadius:'8px', resize:'none', fontSize:'14px', fontFamily:'inherit', outline:'none', color:'#334155' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ APROVAÇÃO ══ */}
        {activeTab === 'aprovacao' && (
          <div className="panel active">
            <div className="page-header"><div><h1 className="page-title">Aprovar Candidatos</h1><p className="page-sub">Libere o acesso de pessoas que se cadastraram na plataforma.</p></div></div>
            <div className="card">
              <div className="card-head"><span className="card-title">Aguardando Liberação</span>{candidatosPendentes.length>0&&<span className="badge bc-red">{candidatosPendentes.length} pendentes</span>}</div>
              {candidatosPendentes.length===0?(
                <div style={{ textAlign:'center', padding:'50px 20px' }}><div style={{ fontSize:'40px', marginBottom:'10px' }}>✨</div><h3 style={{ color:'var(--gray-700)' }}>Tudo limpo por aqui!</h3><p style={{ color:'var(--gray-500)', fontSize:'14px' }}>Nenhum candidato aguardando aprovação.</p></div>
              ):(
                <div>{candidatosPendentes.map(candidato=>(
                  <div className="aprov-item" key={candidato.id}>
                    <div className="aprov-av" style={{ background:getAvatarColor(candidato.nome), color:'#fff' }}>{candidato.nome?candidato.nome.substring(0,2).toUpperCase():'US'}</div>
                    <div className="aprov-info">
                      <div className="aprov-header">
                        <div className="aprov-title-area">
                          <div className="aprov-name">{candidato.nome}<span className={`role-badge ${candidato.perfil==='Ledor'?'rb-ledor':'rb-fiscal'}`}>{candidato.perfil}</span></div>
                          <div className="aprov-meta">Cadastrado em {candidato.dataCadastro}</div>
                        </div>
                        <div className="aprov-actions">
                          <button className="btn-success-small" onClick={()=>handleAprovarCandidato(candidato.id)}>✓ Aprovar</button>
                          <button className="btn-danger-small"  onClick={()=>handleRecusarCandidato(candidato.id)}>✕ Recusar</button>
                        </div>
                      </div>
                      <div className="aprov-fields">
                        <div className="aprov-field-item"><span className="aprov-field-label">CPF</span><span className="aprov-field-val">{candidato.cpf}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">DATA DE NASC.</span><span className="aprov-field-val">{candidato.dataNascimento}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">CELULAR</span><span className="aprov-field-val">{candidato.celular}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">E-MAIL</span><span className="aprov-field-val">{candidato.email}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">ESCOLARIDADE</span><span className="aprov-field-val">{candidato.escolaridade}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">CURSO</span><span className="aprov-field-val">{candidato.cursoFormacao}</span></div>
                        <div className="aprov-field-item" style={{ gridColumn:'1/-1' }}><span className="aprov-field-label">MATÉRIAS</span><span className="aprov-field-val">{candidato.materias}</span></div>
                      </div>
                    </div>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {/* ══ MEMBROS ══ */}
        {activeTab === 'membros' && (
          <div className="panel active">
            <div className="page-header"><div><h1 className="page-title">Membros e Funções</h1><p className="page-sub">Altere a função dos membros e salve ao finalizar.</p></div></div>
            <div className="card">
              <div className="card-head"><span className="card-title">Membros Ativos</span><span style={{ color:'#3b82f6', fontWeight:'600', fontSize:'14px' }}>{membrosAtivos.length} membros</span></div>
              {membrosAtivos.length===0?(
                <div style={{ textAlign:'center', padding:'50px 20px' }}><div style={{ fontSize:'40px', marginBottom:'10px' }}>👥</div><h3 style={{ color:'var(--gray-700)' }}>Nenhum membro ativo</h3><p style={{ color:'var(--gray-500)', fontSize:'14px' }}>Aprovados aparecerão aqui.</p></div>
              ):(
                <>
                  <div className="tbl-wrap">
                    <table className="members-table">
                      <thead><tr><th>NOME</th><th>E-MAIL</th><th>CPF</th><th>FUNÇÃO ATUAL</th><th>ALTERAR PARA</th></tr></thead>
                      <tbody>{membrosAtivos.map(membro=>{
                        const valorSelect=alteracoesPendentes[membro.id]||membro.funcao;
                        return(
                          <tr key={membro.id}>
                            <td><div style={{ display:'flex', alignItems:'center', gap:'12px' }}><div className="avatar" style={{ background:getAvatarColor(membro.nome), color:'#fff', width:'36px', height:'36px', fontSize:'13px' }}>{membro.nome?membro.nome.substring(0,2).toUpperCase():'US'}</div><span style={{ fontWeight:'600', color:'#111827' }}>{membro.nome}</span></div></td>
                            <td style={{ color:'#4b5563', fontSize:'14px' }}>{membro.email}</td>
                            <td style={{ color:'#4b5563', fontSize:'14px' }}>{membro.cpf}</td>
                            <td><span className={`role-badge ${membro.funcao==='Ledor'?'rb-ledor':membro.funcao==='Fiscal'?'rb-fiscal':'rb-ambos'}`}>{membro.funcao}</span></td>
                            <td><select className="role-select" value={valorSelect} onChange={e=>handleMudancaFuncao(membro.id,e.target.value)}><option value="Ledor">Ledor</option><option value="Fiscal">Fiscal / Aplicador</option><option value="Ambos">Ambos</option></select></td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                  <div className="members-footer">
                    <button className="btn-outline" onClick={()=>setAlteracoesPendentes({})}>Cancelar</button>
                    <button className="btn-primary" onClick={handleSalvarAlteracoes} disabled={Object.keys(alteracoesPendentes).length===0}>✓ Salvar Alterações</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ PERFIL ══ */}
        {activeTab === 'perfil' && (
          <div className="panel active">
            <div className="page-header"><div><h1 className="page-title">Meu Perfil</h1><p className="page-sub">Atualize suas informações.</p></div></div>
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:'20px', padding:'20px 24px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-100)' }}>
                <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'var(--blue-dark)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', fontWeight:'700', color:'#fff' }}>{iniciais}</div>
                <div><div style={{ fontWeight:'700', fontSize:'16px' }}>{perfilFormData.nome||nomeLogado}</div><div style={{ fontSize:'13px', color:'var(--gray-500)', marginTop:'3px' }}>{perfilFormData.email}</div></div>
              </div>
              <div style={{ padding:'28px 24px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div className="field-grp"><label>NOME COMPLETO</label><input type="text" name="nome" value={perfilFormData.nome} onChange={handlePerfilChange}/></div>
                  <div className="field-grp"><label>E-MAIL</label><input type="email" name="email" value={perfilFormData.email} onChange={handlePerfilChange}/></div>
                  <div className="field-grp"><label>TELEFONE</label><input type="text" name="telefone" value={perfilFormData.telefone} onChange={handlePerfilChange}/></div>
                  <div className="field-grp"><label>INSTITUIÇÃO</label><input type="text" name="instituicao" value={perfilFormData.instituicao} onChange={handlePerfilChange}/></div>
                  <div className="field-grp" style={{ gridColumn:'1/-1' }}><label>NOVA SENHA</label><input type="password" name="novaSenha" value={perfilFormData.novaSenha} onChange={handlePerfilChange} placeholder="Deixe em branco para não alterar"/></div>
                  <div className="field-grp" style={{ gridColumn:'1/-1' }}><label>CONFIRMAR SENHA</label><input type="password" name="confirmarSenha" value={perfilFormData.confirmarSenha} onChange={handlePerfilChange} placeholder="Repita a nova senha"/></div>
                </div>
                <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}><button className="btn-outline">Cancelar</button><button className="btn-primary" onClick={handleSalvarPerfil}>Salvar Alterações</button></div>
              </div>
            </div>
          </div>
        )}

        {/* ══ RELATÓRIOS ══ */}
        {activeTab === 'relatorios' && (
          <div className="panel active">
            <div className="page-header"><div><h1 className="page-title">Relatórios</h1><p className="page-sub">Geração de QR Codes para registro de saída e Notas Fiscais quinzenais.</p></div></div>
            <div style={{ display:'flex', borderBottom:'2px solid #e5e7eb', marginBottom:'24px' }}>
              {[{ key:'qrcode', label:'Gerar QR Code', icon:'⬛' },{ key:'notafiscal', label:'Nota Fiscal', icon:'📄' }].map(st=>(
                <button key={st.key} onClick={()=>setActiveSubTabRelatorio(st.key)} style={{ padding:'12px 20px', background:'none', border:'none', borderBottom: activeSubTabRelatorio===st.key?'2.5px solid #c0392b':'2.5px solid transparent', color: activeSubTabRelatorio===st.key?'#0d1428':'#64748b', fontWeight: activeSubTabRelatorio===st.key?'700':'500', fontSize:'13.5px', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'7px', marginBottom:'-2px' }}>
                  <span>{st.icon}</span>{st.label}
                </button>
              ))}
            </div>
            {activeSubTabRelatorio === 'qrcode' && (
              <div>
                <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'12px', padding:'16px 20px', marginBottom:'24px', display:'flex', gap:'14px', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'20px', flexShrink:0 }}>ℹ️</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'600', color:'#1d4ed8', marginBottom:'4px' }}>Como funciona</div>
                    <div style={{ fontSize:'13px', color:'#1e40af', lineHeight:'1.7' }}>
                      1. Clique em <strong>"Gerar QR Code"</strong> ao encerrar a prova.&nbsp;·&nbsp;
                      2. Exiba o QR Code na saída da sala.&nbsp;·&nbsp;
                      3. Cada ledor/fiscal escaneia com o celular no painel <strong>"Bater Ponto → Saída"</strong>.&nbsp;·&nbsp;
                      4. O QR expira em <strong>30 minutos</strong>.
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><span className="card-title">Eventos para Geração de QR Code</span><span style={{ fontSize:'12.5px', color:'#64748b' }}>Clique em "Gerar" ao encerrar a aplicação</span></div>
                  <div className="tbl-wrap">
                    {eventos.length===0?(
                      <div style={{ textAlign:'center', padding:'48px 20px' }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div><p style={{ color:'#64748b', fontSize:'14px' }}>Nenhum evento cadastrado ainda.</p></div>
                    ):(
                      <table>
                        <thead><tr><th>EVENTO</th><th>DATA</th><th>VAGAS</th><th>STATUS</th><th>QR CODE</th></tr></thead>
                        <tbody>{eventos.map(ev=>(
                          <tr key={ev.id}>
                            <td><div style={{ fontWeight:'600', color:'#0f172a', fontSize:'14px' }}>{ev.titulo}</div><div style={{ fontSize:'12px', color:'#64748b' }}>R$ {ev.valor}/hora</div></td>
                            <td style={{ fontSize:'13.5px', color:'#334155', fontFamily:'monospace' }}>{ev.data}</td>
                            <td style={{ fontSize:'13.5px', color:'#334155' }}>{ev.vagasPreenchidas}/{ev.vagasTotais}</td>
                            <td><span style={{ backgroundColor: ev.status==='Concluído'?'#d1fae5':ev.status==='Cancelado'?'#fee2e2':'#e0e7ff', color: ev.status==='Concluído'?'#065f46':ev.status==='Cancelado'?'#991b1b':'#4338ca', padding:'4px 12px', borderRadius:'9999px', fontSize:'12px', fontWeight:'500' }}>{ev.status}</span></td>
                            <td>{ev.status==='Cancelado'?(<span style={{ fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>Evento cancelado</span>):(<button onClick={()=>abrirQrEvento(ev)} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'8px', fontFamily:'inherit', fontSize:'12.5px', fontWeight:'600', cursor:'pointer' }}>⬛ Gerar QR Code</button>)}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeSubTabRelatorio === 'notafiscal' && (
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'48px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize:'48px', marginBottom:'16px' }}>📄</div>
                <h2 style={{ fontSize:'20px', fontWeight:'700', color:'#0f172a', marginBottom:'8px' }}>Nota Fiscal Quinzenal</h2>
                <p style={{ fontSize:'14px', color:'#64748b', maxWidth:'480px', margin:'0 auto 24px', lineHeight:'1.7' }}>
                  A nota fiscal será gerada com base nos registros de <strong>Provas Aplicadas</strong>, agrupados por série (EF / EM) a cada 15 dias.<br/><br/>
                  <strong style={{ color:'#2563eb' }}>Em ajuste</strong> — a coordenação está finalizando o layout antes de ativar.
                </p>
                <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'#fef3c7', border:'1px solid #fde68a', color:'#92400e', padding:'10px 18px', borderRadius:'8px', fontSize:'13px', fontWeight:'500' }}>
                  ⏳ Esta aba será ativada em breve
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* MODAL NOVO EVENTO / EDIÇÃO */}
      {isModalOpen && (
        <div className="overlay open" onClick={e=>{ if(e.target.className.includes('overlay')) setIsModalOpen(false); }}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{editMode?'Editar Evento':'Novo Evento'}</div>
            <div className="modal-sub">{editMode?'Modifique os parâmetros da prova selecionada.':'Preencha os dados da prova ou aplicação.'}</div>
            <div className="modal-grid">
              <div className="field-grp full"><label>NOME DO EVENTO *</label><input type="text" name="nome" value={eventoFormData.nome} onChange={handleInputChange} placeholder="Ex: Prova de Matemática – 3º Ano"/></div>
              <div className="field-grp full"><label>SÉRIE / TURMA</label><select name="serie" value={eventoFormData.serie} onChange={handleInputChange}><option value="">Selecione</option><option value="1EF">1º Ano – EF</option><option value="2EF">2º Ano – EF</option><option value="3EF">3º Ano – EF</option><option value="1EM">1º Ano – EM</option><option value="2EM">2º Ano – EM</option><option value="3EM">3º Ano – EM</option></select></div>
              <div className="field-grp"><label>DATA *</label><input type="date" name="data" value={eventoFormData.data} onChange={handleInputChange}/></div>
              <div className="field-grp"><label>HORÁRIO *</label><input type="time" name="horario" value={eventoFormData.horario} onChange={handleInputChange}/></div>
              <div className="field-grp"><label>DURAÇÃO (HORAS) *</label><input type="number" name="duracao" value={eventoFormData.duracao} onChange={handleInputChange} placeholder="Ex: 4"/></div>
              <div className="field-grp"><label>VAGAS *</label><input type="number" name="vagas" value={eventoFormData.vagas} onChange={handleInputChange} placeholder="Ex: 5"/></div>
              <div className="field-grp"><label>VALOR / HORA (R$)</label><input type="number" name="valor" value={eventoFormData.valor} onChange={handleInputChange} placeholder="Ex: 37"/></div>
              <div className="field-grp"><label>TIPO DE FUNÇÃO</label><select name="tipoFuncao" value={eventoFormData.tipoFuncao} onChange={handleInputChange}><option value="Ledor">Ledor</option><option value="Fiscal">Fiscal / Aplicador</option><option value="Ambos">Ambos</option></select></div>
              <div className="field-grp full"><label>OBSERVAÇÕES</label><input type="text" name="observacoes" value={eventoFormData.observacoes} onChange={handleInputChange} placeholder="Informações adicionais"/></div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={()=>{ setIsModalOpen(false); setEditMode(false); }}>Cancelar</button>
              <button className="btn-primary" onClick={editMode?handleSalvarEdicao:handleCriarEvento}>{editMode?'Salvar Alterações':'Criar Evento'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR CODE */}
      {qrModalAberto && qrInfo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={fecharQrModal}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'32px', width:'420px', maxWidth:'96vw', boxShadow:'0 8px 32px rgba(0,0,0,.2)', textAlign:'center' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>{qrInfo.nome}</div>
            <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'20px' }}>{qrInfo.data}</div>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:'14px' }}>
              <img src={qrImageUrl(260)} alt="QR Code de saída" style={{ border:'6px solid #f1f3f6', borderRadius:'10px', display:'block' }} width={260} height={260}/>
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'22px', fontWeight:'700', color: qrSegundos<=300?'#c0392b':'#0d1428', background: qrSegundos<=300?'#fde8e6':'#eff6ff', border:`1px solid ${qrSegundos<=300?'#fca5a5':'#bfdbfe'}`, padding:'8px 20px', borderRadius:'8px', display:'inline-block', marginBottom:'6px' }}>
              {formatarTimer(qrSegundos)}
            </div>
            <div style={{ fontSize:'11.5px', color:'#94a3b8', marginBottom:'14px' }}>{qrSegundos===0?'⚠️ QR Code expirado — gere um novo':'Expira em 30 minutos'}</div>
            <div style={{ background:'#f8f9fb', border:'1px solid #f1f3f6', borderRadius:'8px', padding:'12px 14px', fontSize:'12.5px', color:'#64728a', lineHeight:'1.7', textAlign:'left', marginBottom:'18px' }}>
              <strong style={{ color:'#374151' }}>Instruções para o aplicador:</strong><br/>
              1. Abra o painel <em>Bater Ponto</em> no celular<br/>
              2. Selecione <em>Registrar Saída</em><br/>
              3. Aponte a câmera para este QR Code<br/>
              4. O horário de saída será registrado automaticamente
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:'10px' }}>
              <button onClick={fecharQrModal} style={{ padding:'9px 18px', border:'1.5px solid #e4e7ed', background:'#fff', borderRadius:'8px', fontFamily:'inherit', fontSize:'13px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>Fechar</button>
              <button onClick={()=>setQrFullscreen(true)} style={{ padding:'9px 18px', border:'none', background:'#0d1428', borderRadius:'8px', fontFamily:'inherit', fontSize:'13px', fontWeight:'600', color:'#fff', cursor:'pointer' }}>⛶ Tela Cheia</button>
              <button onClick={()=>{ if(qrTimerRef.current) clearInterval(qrTimerRef.current); abrirQrEvento(eventos.find(e=>e.id===qrInfo.eventoId)||eventos[0]); }} style={{ padding:'9px 18px', border:'none', background:'#2563eb', borderRadius:'8px', fontFamily:'inherit', fontSize:'13px', fontWeight:'600', color:'#fff', cursor:'pointer' }}>↺ Novo QR</button>
            </div>
          </div>
        </div>
      )}

      {/* QR TELA CHEIA */}
      {qrFullscreen && qrInfo && (
        <div style={{ position:'fixed', inset:0, background:'#0d1428', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:300 }}>
          <button onClick={()=>setQrFullscreen(false)} style={{ position:'absolute', top:'20px', right:'20px', background:'rgba(255,255,255,.1)', border:'none', color:'#fff', padding:'10px 18px', borderRadius:'8px', fontFamily:'inherit', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>✕ Fechar tela cheia</button>
          <div style={{ fontSize:'22px', fontWeight:'700', color:'#fff', marginBottom:'4px' }}>{qrInfo.nome}</div>
          <div style={{ fontSize:'15px', color:'rgba(255,255,255,.5)', marginBottom:'28px' }}>{qrInfo.data}</div>
          <img src={qrImageUrl(380)} alt="QR Code tela cheia" style={{ background:'#fff', padding:'14px', borderRadius:'12px', display:'block' }} width={380} height={380}/>
          <div style={{ fontFamily:'monospace', fontSize:'32px', fontWeight:'700', marginTop:'24px', color: qrSegundos<=300?'#f87171':'#fff' }}>{qrSegundos===0?'EXPIRADO':formatarTimer(qrSegundos)}</div>
          <div style={{ fontSize:'14px', color:'rgba(255,255,255,.45)', marginTop:'10px' }}>Aponte a câmera do celular para registrar saída</div>
        </div>
      )}

    </div>
  );
};