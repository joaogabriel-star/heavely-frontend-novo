import React, { useState, useEffect, useRef } from 'react';
import '../styles/Dashboardcoor.css';
import api, { eventoService, usuarioService, pontoService, notaFiscalService } from '../services/api';
import { LayoutDashboard, UserCheck, Users, FileText, User } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';
import { useAsyncAction } from '../hooks/useAsyncAction.js';

// Fonte única dos valores de Série — reaproveitada no formulário de evento e no
// filtro da Nota Fiscal, pra nunca ter duas listas que podem ficar dessincronizadas.
const SERIES_EF2 = [
  { value: '6EF2', label: '6º Ano – EF2' },
  { value: '7EF2', label: '7º Ano – EF2' },
  { value: '8EF2', label: '8º Ano – EF2' },
  { value: '9EF2', label: '9º Ano – EF2' },
];
const SERIES_EM = [
  { value: '1EM', label: '1º Ano – EM' },
  { value: '2EM', label: '2º Ano – EM' },
  { value: '3EM', label: '3º Ano – EM' },
];

export const DashboardCoord = () => {

  const { showToast } = useToast();
  const { run, isLoading } = useAsyncAction();
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
  const [relatorioModalAberto, setRelatorioModalAberto] = useState(false);
  const [relatorioForm, setRelatorioForm] = useState({ tipoPagamento: 'PorHora', valor: '' });
  const [nfFiltro, setNfFiltro] = useState({ dataInicio: '', dataFim: '', segmento: '', serie: '', idUsuario: '' });
  const [nfPreview, setNfPreview] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(localStorage.getItem('avatarUsuario') || '');
  const [eventoFormData, setEventoFormData] = useState({
    nome: '', serie: '', data: '', horario: '',
    duracao: '', vagas: '', vagasLedor: '', vagasFiscal: '', valor: '', tipoFuncao: 'Ledor', observacoes: ''
  });
  const [perfilFormData, setPerfilFormData] = useState({
    nome:           localStorage.getItem('nomeUsuario')  || '',
    email:          localStorage.getItem('emailUsuario') || '',
    telefone:       '',
    senhaAtual:     '',
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

  // Só a lista de eventos (o que alimenta a barra de ocupação) — separada do
  // resto pra poder rodar sozinha no intervalo de 30s, sem bater em
  // /usuarios/pendentes e /usuarios/ativos sem necessidade.
  const carregarEventosAdmin = async () => {
    try {
      const dadosEventos = await eventoService.listarEventos();
      const agora = new Date();

      setEventos(dadosEventos.map(e => {
        const dataProva   = new Date(e.dataProva.endsWith('Z') ? e.dataProva : e.dataProva + 'Z');
        const passou      = dataProva < agora;
        const vagasLedor  = e.totalVagasLedor  ?? e.vagasLedor  ?? 0;
        const vagasFiscal = e.totalVagasFiscal ?? e.vagasFiscal ?? 0;

        return {
          id:               e.idEvento,
          titulo:           e.nomeProva || e.tituloProva || 'Sem título',
          serie:            e.serie || '',
          valor:            e.valorHora != null ? e.valorHora.toString() : '37',
          observacoes:      e.observacoes || '',
          vagasTotais:      vagasLedor + vagasFiscal,
          vagasPreenchidas: e.vagasPreenchidas ?? 0,
          reservas:         0,

          vagasLedor,
          vagasFiscal,
          vagasLedorDisponiveis:  e.vagasLedorDisponiveis,
          vagasFiscalDisponiveis: e.vagasFiscalDisponiveis,

          data: dataProva.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit',
            year: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          dataPura: dataProva.toISOString(),
          status: e.statusEvento === 'CANCELADO' ? 'Cancelado'
                : passou                         ? 'Concluído'
                :                                  'Agendado',
        };
      }));
    } catch (error) { console.error('Erro ao carregar eventos:', error); }
  };

  const carregarDadosIniciais = async () => {
    try {
      await carregarEventosAdmin();

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
        experienciaProfissional: c.experienciaProfissional || 'N/A',
        linkDiplomaLedor: c.linkDiplomaLedor || null,
      })));

      await recarregarMembros();
    } catch (error) { console.error('Erro ao carregar dados:', error); }
  };

  useEffect(() => {
    carregarDadosIniciais();

    const radarDeEventos = setInterval(() => {
      carregarEventosAdmin();
    }, 30000);

    return () => clearInterval(radarDeEventos);
  }, []);

  // ── HANDLERS GERAIS ────────────────────────────────────────────
  const handlePerfilChange = (e) => { const { name, value } = e.target; setPerfilFormData(prev => ({ ...prev, [name]: value })); };
  const handleInputChange  = (e) => { const { name, value } = e.target; setEventoFormData(prev => ({ ...prev, [name]: value })); };
  
  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        localStorage.setItem('avatarUsuario', reader.result);
        setAvatarUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSalvarPerfil = () => {
    if (perfilFormData.novaSenha && perfilFormData.novaSenha !== perfilFormData.confirmarSenha) {
      showToast('As senhas não coincidem!', 'warning'); return;
    }
    if (perfilFormData.novaSenha && !perfilFormData.senhaAtual) {
      showToast('Informe sua senha atual para definir uma nova senha.', 'warning'); return;
    }

    run(async () => {
    try {
      const payloadPerfil = {};
      if (perfilFormData.nome?.trim())     payloadPerfil.NomeCompleto = perfilFormData.nome.trim();
      if (perfilFormData.telefone?.trim()) payloadPerfil.Celular      = perfilFormData.telefone.trim();

      await api.put('/usuarios/perfil', payloadPerfil);

      if (perfilFormData.novaSenha) {
        await api.put('/usuarios/senha', {
          SenhaAtual: perfilFormData.senhaAtual,
          NovaSenha: perfilFormData.novaSenha,
          ConfirmarNovaSenha: perfilFormData.confirmarSenha,
        });
        setPerfilFormData(prev => ({ ...prev, senhaAtual: '', novaSenha: '', confirmarSenha: '' }));
      }

      showToast('Perfil atualizado com sucesso!', 'success');
    } catch (error) {
      const msg = error.response?.data?.mensagem || 'Erro ao atualizar perfil.';
      showToast(msg, 'error');
    }
    });
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
      showToast('Candidato aprovado! Agora ele pode fazer login.', 'success');
    } catch (error) { showToast('Erro ao aprovar o candidato.', 'error'); console.error(error); }
  };

  const handleRecusarCandidato = async (idCandidato) => {
    if (!window.confirm('Tem certeza que deseja recusar este candidato?')) return;
    try {
      await usuarioService.recusarUsuario(idCandidato);
      setCandidatosPendentes(prev => prev.filter(c => c.id !== idCandidato));
      showToast('Candidato recusado.', 'success');
    } catch (error) { showToast('Erro ao recusar o candidato.', 'error'); console.error(error); }
  };

  // ── MEMBROS ────────────────────────────────────────────────────
  const handleMudancaFuncao     = (idMembro, novaFuncao) => setAlteracoesPendentes(prev => ({ ...prev, [idMembro]: novaFuncao }));
  const handleSalvarAlteracoes  = async () => {
    const ids = Object.keys(alteracoesPendentes);
    if (ids.length === 0) { showToast('Nenhuma alteração feita.', 'warning'); return; }
    try {
      await Promise.all(ids.map(id => usuarioService.alterarPerfil(id, alteracoesPendentes[id])));
      setMembrosAtivos(prev => prev.map(m => ({ ...m, funcao: alteracoesPendentes[m.id] || m.funcao })));
      setAlteracoesPendentes({});
      showToast('Funções atualizadas!', 'success');
    } catch (error) { showToast('Erro ao salvar alterações.', 'error'); }
  };

// ── EVENTOS: CRIAR ─────────────────────────────────────────────
  const handleCriarEvento = () => {
    // Trava anti evento duplicado (Compara Nome e a Data Exata)
    const [ano, mes, dia] = eventoFormData.data.split('-');
    const [hora, min]     = eventoFormData.horario.split(':');
    
    const dataInicioLocal = new Date(ano, mes - 1, dia, hora, min);
    
    const eventoDuplicado = eventos.some(ev => {
      const mesmoNome = ev.titulo.trim().toLowerCase() === eventoFormData.nome.trim().toLowerCase();
      const mesmaData = new Date(ev.dataPura).getTime() === dataInicioLocal.getTime();
      return mesmoNome && mesmaData;
    });

    if (eventoDuplicado) {
      showToast('⚠️ Ops! Já existe uma prova com este exato nome e horário na plataforma.', 'warning');
      return;
    }

    run(async () => {
    try {
      const dataInicioExata = `${eventoFormData.data}T${eventoFormData.horario}:00`;

      const duracao = parseInt(eventoFormData.duracao) || 1;
      const horaFim = parseInt(hora) + duracao;
      const dataFimExata = `${ano}-${mes}-${dia}T${horaFim.toString().padStart(2,'0')}:${min}:00`;

      const vagas = parseInt(eventoFormData.vagas) || 0;
      const vagasLedorInput  = parseInt(eventoFormData.vagasLedor)  || 0;
      const vagasFiscalInput = parseInt(eventoFormData.vagasFiscal) || 0;

      const dto = {
        TituloProva: eventoFormData.nome, Serie: eventoFormData.serie || 'HIS',
        LocalProva:  'Heavenly International School',
        DataProva:   dataInicioExata, HorarioFim: dataFimExata,
        ValorHora:   eventoFormData.valor === '' ? 37 : parseFloat(eventoFormData.valor),
        Observacoes: eventoFormData.observacoes || '',
        VagasLedor:  eventoFormData.tipoFuncao === 'Ambos' ? vagasLedorInput  : (eventoFormData.tipoFuncao === 'Ledor'  ? vagas : 0),
        VagasFiscal: eventoFormData.tipoFuncao === 'Ambos' ? vagasFiscalInput : (eventoFormData.tipoFuncao === 'Fiscal' ? vagas : 0),
      };

      await eventoService.criarEvento(dto);
      await carregarDadosIniciais();

      setIsModalOpen(false);
      setEventoFormData({ nome:'',serie:'',data:'',horario:'',duracao:'',vagas:'',vagasLedor:'',vagasFiscal:'',valor:'',tipoFuncao:'Ledor',observacoes:'' });
      showToast('✅ Evento criado com sucesso!', 'success');
    } catch (error) {
      const msg = error.response?.data?.mensagem || (error.response?.data?.errors ? JSON.stringify(error.response?.data?.errors) : 'Verifique os dados e tente novamente.');
      showToast(`Erro ao criar evento: ${msg}`, 'error');
      console.error(error);
    }
    }, 'evento-modal');
  };

  // ── EVENTOS: DETALHES ──────────────────────────────────
  const abrirDetalhesEvento = async (ev) => {
    setEventoEmDetalhe(ev);
    setJustificativasAbertas(new Set());
    setCancelamentosEvento([]);
    try {
      const resposta = await api.get(`/alocacoes/${ev.id}/lista`);
      const todas = resposta.data.map(a => {
        const statusFiltrado = (a.statusParticipacao === 'Confirmado' || a.statusParticipacao === 'Presente') ? 'Confirmado'
                             : a.statusParticipacao === 'Cancelado'  ? 'Cancelado'
                             :                                         'Na Reserva';

        const formatarHoraBatida = (isoString) => {
          if (!isoString) return '';
          try {
            const d = new Date(isoString.endsWith('Z') ? isoString : isoString + 'Z');
            return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          } catch { return ''; }
        };

        return {
          id:               a.idAlocacao  || a.id,
          nome:             a.nomeUsuario || 'Nome não informado',
          email:            a.email       || 'Sem e-mail',
          funcao:           a.papelEvento || 'Ledor',
          sala:             a.salaDesignada || '',
          status:           statusFiltrado,
          horarioEntrada:   formatarHoraBatida(a.checkInTime),
          horarioSaida:     formatarHoraBatida(a.checkOutTime),
          motivo:           a.motivoCancelamento           || '',
          justificativa:    a.justificativaCancelamento    || '',
          dataCancelamento: a.dataCancelamento
            ? (() => {
                const d = new Date(a.dataCancelamento);
                return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
              })()
            : '',
          antecedencia: a.antecedencia || '',
        };
      });
      setAlocacoesEvento(todas.filter(a => a.status !== 'Cancelado'));
      setCancelamentosEvento(todas.filter(a => a.status === 'Cancelado'));
    } catch (error) {
      console.error("Erro ao buscar inscritos:", error.response?.data || error.message);
      showToast("Não foi possível carregar os inscritos do banco.", 'error');
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
      const d = new Date(eventoEmDetalhe.dataPura);
      const ano = d.getFullYear();
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');

      setEditMode(true); 
      setIdEventoEditando(eventoEmDetalhe.id);
      
      setEventoFormData({ 
        nome: eventoEmDetalhe.titulo, 
        serie: eventoEmDetalhe.serie || '',
        data: `${ano}-${mes}-${dia}`, 
        horario: `${hora}:${min}`,
        duracao: '4',
        vagas: eventoEmDetalhe.vagasTotais.toString(),
        vagasLedor: (eventoEmDetalhe.vagasLedor ?? 0).toString(),
        vagasFiscal: (eventoEmDetalhe.vagasFiscal ?? 0).toString(),
        valor: eventoEmDetalhe.valor,
        tipoFuncao: 'Ambos',
        observacoes: eventoEmDetalhe.observacoes || ''
      });
      setIsModalOpen(true);
    } catch (e) { 
      console.error("Erro ao abrir edição:", e); 
      setEditMode(true); 
      setIdEventoEditando(eventoEmDetalhe.id); 
      setIsModalOpen(true); 
    }
  };

  // ── EDICAO CORRIGIDA ──────────────────────
const handleSalvarEdicao = () => {
    run(async () => {
    try {
      const [ano, mes, dia] = eventoFormData.data.split('-');
      const [hora, min]     = eventoFormData.horario.split(':');
      
      const dataInicioExata = `${eventoFormData.data}T${eventoFormData.horario}:00`;
      const duracao  = parseInt(eventoFormData.duracao) || 1;
      const horaFim  = parseInt(hora) + duracao;
      const dataFimExata = `${ano}-${mes}-${dia}T${horaFim.toString().padStart(2,'0')}:${min}:00`;
      
      const vagas = parseInt(eventoFormData.vagas) || 0;
      const vagasLedorInput  = parseInt(eventoFormData.vagasLedor)  || 0;
      const vagasFiscalInput = parseInt(eventoFormData.vagasFiscal) || 0;
      const dto = {
        TituloProva: eventoFormData.nome, Serie: eventoFormData.serie || 'HIS',
        LocalProva: 'Heavenly International School',
        DataProva: dataInicioExata, HorarioFim: dataFimExata,
        ValorHora: eventoFormData.valor === '' ? 37 : parseFloat(eventoFormData.valor),
        Observacoes: eventoFormData.observacoes || '',
        VagasLedor:  eventoFormData.tipoFuncao === 'Ambos' ? vagasLedorInput  : (eventoFormData.tipoFuncao === 'Ledor'  ? vagas : 0),
        VagasFiscal: eventoFormData.tipoFuncao === 'Ambos' ? vagasFiscalInput : (eventoFormData.tipoFuncao === 'Fiscal' ? vagas : 0),
      };
      
      await api.put(`/eventos/${idEventoEditando}`, dto);
      
      await carregarDadosIniciais();
      
      setIsModalOpen(false);
      setEventoEmDetalhe(null);
      showToast('✅ Evento atualizado com sucesso!', 'success');
    } catch (error) {
      console.error("Erro ao salvar edição:", error);
      showToast("Erro ao editar.", 'error');
    }
    }, 'evento-modal');
  };

  const handleCancelarInscricao = async (inscrito) => {
    const idDaAlocacao    = inscrito.idAlocacao || inscrito.IdAlocacao || inscrito.id;
    const nomeDoCandidato = inscrito.nomeUsuario || inscrito.NomeUsuario || 'este candidato';
    if (!idDaAlocacao) { console.error("Dados:", inscrito); showToast("Erro: ID não encontrado. Veja F12.", 'error'); return; }
    if (!window.confirm(`Remover ${nomeDoCandidato}?`)) return;
    try {
      await api.delete(`/alocacoes/${idDaAlocacao}`);
      setAlocacoesEvento(prev => prev.filter(i => (i.idAlocacao || i.IdAlocacao || i.id) !== idDaAlocacao));
      showToast("✅ Inscrição cancelada com sucesso!", 'success');
    } catch (error) { console.error("Erro ao cancelar:", error); showToast("Erro ao cancelar a inscrição.", 'error'); }
  };

  const atualizaSalaCandidato = (id, novaSala) => setAlocacoesEvento(prev => prev.map(a => a.id === id ? { ...a, sala: novaSala } : a));

  const handlePublicarSalas = async () => {
    try {
      await api.put('/alocacoes/salvar-salas', alocacoesEvento.map(a => ({ IdAlocacao: a.id, Sala: a.sala || '' })));
      showToast('✅ Salas publicadas com sucesso!', 'success');
    } catch (error) { console.error("Erro ao publicar salas:", error); showToast('Erro ao publicar as salas.', 'error'); }
  };

  // ── QR CODE ───────────────────────────────────────────────────
  const formatarTimer = (s) => `${Math.floor(s/60).toString().padStart(2,'00')}:${(s%60).toString().padStart(2,'00')}`;

  // Aproximação client-side de "válido até meia-noite" (a validade de verdade é checada no backend a cada scan)
  const segundosAteMeiaNoite = () => {
    const agora = new Date();
    const meiaNoite = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59);
    return Math.max(0, Math.floor((meiaNoite.getTime() - agora.getTime()) / 1000));
  };

  const abrirQrEvento = (ev) => {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    run(async () => {
    try {
      const resposta = await pontoService.obterQRCode(ev.id);
      setQrInfo({ eventoId: ev.id, nome: ev.titulo, data: ev.data, token: resposta.token, expiraEm: resposta.expiraEm });
      setQrSegundos(segundosAteMeiaNoite());
      setQrModalAberto(true);
      qrTimerRef.current = setInterval(() => {
        setQrSegundos(prev => { if (prev <= 0) { clearInterval(qrTimerRef.current); return 0; } return prev - 1; });
      }, 1000);
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error);
      showToast(error.response?.data?.mensagem || 'Erro ao gerar QR Code.', 'error');
    }
    }, `qr-${ev.id}`);
  };

  const fecharQrModal = () => { setQrModalAberto(false); setQrFullscreen(false); if (qrTimerRef.current) clearInterval(qrTimerRef.current); };
  const qrImageUrl    = (tam = 280) => qrInfo ? `https://api.qrserver.com/v1/create-qr-code/?size=${tam}x${tam}&data=${encodeURIComponent(qrInfo.token)}&ecc=M&color=0d1428&bgcolor=FFFFFF` : '';

  // ── RELATÓRIO PDF ────────────────────────────────────────────────
  const abrirModalRelatorio = () => {
    setRelatorioForm({ tipoPagamento: 'PorHora', valor: eventoEmDetalhe.valor || '' });
    setRelatorioModalAberto(true);
  };

  const handleBaixarRelatorio = () => {
    run(async () => {
    try {
      const params = { TipoPagamento: relatorioForm.tipoPagamento };
      if (relatorioForm.tipoPagamento === 'PorHora') params.ValorPorHora = relatorioForm.valor || 0;
      else params.ValorFixo = relatorioForm.valor || 0;

      const resposta = await api.get(`/relatorios/${eventoEmDetalhe.id}/pdf`, { params, responseType: 'blob' });

      const url = window.URL.createObjectURL(new Blob([resposta.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio_pagamento_${eventoEmDetalhe.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setRelatorioModalAberto(false);
    } catch (error) {
      let msg = 'Erro ao gerar relatório.';
      if (error.response?.data instanceof Blob) {
        try {
          const texto = await error.response.data.text();
          msg = JSON.parse(texto).mensagem || msg;
        } catch { /* mantém msg padrão */ }
      } else if (error.response?.data?.mensagem) {
        msg = error.response.data.mensagem;
      }
      showToast(msg, 'error');
    }
    }, 'relatorio-pdf');
  };

  // ── NOTA FISCAL AGREGADA ─────────────────────────────────────────
  const handleNfFiltroChange = (e) => {
    const { name, value } = e.target;
    setNfFiltro(prev => {
      const novo = { ...prev, [name]: value };
      if (name === 'segmento') novo.serie = ''; // reseta Série ao trocar Segmento
      return novo;
    });
    setNfPreview(null); // invalida a prévia anterior ao mudar qualquer filtro
  };

  const montarParamsNf = () => {
    const params = { DataInicio: nfFiltro.dataInicio, DataFim: nfFiltro.dataFim };
    if (nfFiltro.segmento) params.Segmento = nfFiltro.segmento;
    if (nfFiltro.serie) params.Serie = nfFiltro.serie;
    if (nfFiltro.idUsuario) params.IdUsuario = nfFiltro.idUsuario;
    return params;
  };

  const validarPeriodoNf = () => {
    if (!nfFiltro.dataInicio || !nfFiltro.dataFim) {
      showToast('⚠️ Preencha Data Início e Data Fim.', 'warning');
      return false;
    }
    if (nfFiltro.dataFim < nfFiltro.dataInicio) {
      showToast('⚠️ Data Fim não pode ser antes de Data Início.', 'warning');
      return false;
    }
    return true;
  };

  const handleBuscarPreviaNotaFiscal = () => {
    if (!validarPeriodoNf()) return;
    run(async () => {
    try {
      const dados = await notaFiscalService.buscarDados(montarParamsNf());
      setNfPreview(dados);
    } catch (error) {
      showToast(error.response?.data?.mensagem || 'Erro ao buscar prévia da Nota Fiscal.', 'error');
      setNfPreview(null);
    }
    }, 'nf-previa');
  };

  const handleBaixarNotaFiscalPdf = () => {
    if (!validarPeriodoNf()) return;
    run(async () => {
    try {
      const blob = await notaFiscalService.baixarPdf(montarParamsNf());
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `nota_fiscal_${nfFiltro.dataInicio}_${nfFiltro.dataFim}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      let msg = 'Erro ao gerar PDF da Nota Fiscal.';
      if (error.response?.data instanceof Blob) {
        try {
          const texto = await error.response.data.text();
          msg = JSON.parse(texto).mensagem || msg;
        } catch { /* mantém msg padrão */ }
      } else if (error.response?.data?.mensagem) {
        msg = error.response.data.mensagem;
      }
      showToast(msg, 'error');
    }
    }, 'nf-pdf');
  };

  const totalAgendados  = eventos.filter(e => e.status === 'Agendado').length;
  const totalConcluidos = eventos.filter(e => e.status === 'Concluído').length;

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
            <div className="avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span>{iniciais}</span>
              )}
            </div>
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
                      <>
                        {/* ── TABELA DESKTOP ── */}
                        <table className="desktop-table">
                          <thead>
                            <tr><th>EVENTO</th><th>DATA</th><th>OCUPAÇÃO</th><th>STATUS</th><th>AÇÃO</th></tr>
                          </thead>
                          <tbody>
                            {eventos.filter(ev => {
                              if (activeSubTab === 'agendados')  return ev.status === 'Agendado';
                              if (activeSubTab === 'concluidos') return ev.status === 'Concluído';
                              return true;
                            }).map(ev => {
                              const total    = ev.vagasTotais;
                              const ocupacao = ev.vagasPreenchidas;
                              const pct      = total > 0 ? (ocupacao / total) * 100 : 0;
                              return (
                                <tr key={ev.id}>
                                  <td>
                                    <strong style={{ fontSize: '14px', color: '#1a1a1a' }}>{ev.titulo}</strong>
                                    <div style={{ fontSize: '12px', color: '#6b7280' }}>R$ {ev.valor}/hora</div>
                                  </td>
                                  <td style={{ fontSize: '14px', color: '#4b5563' }}>{ev.data}</td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: '120px', height: '6px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                          width: `${pct}%`,
                                          height: '100%',
                                          backgroundColor: pct >= 100 ? '#10b981' : '#3b82f6'
                                        }} />
                                      </div>
                                      <span style={{ fontSize: '13px' }}>{ocupacao}/{total}</span>
                                    </div>
                                    {ev.reservas > 0 && (
                                      <span style={{ fontSize: '11px', color: '#d97706' }}>+{ev.reservas} na reserva</span>
                                    )}
                                  </td>
                                  <td>
                                    <span style={{ backgroundColor: ev.status === 'Concluído' ? '#d1fae5' : ev.status === 'Cancelado' ? '#fee2e2' : '#e0e7ff', color: ev.status === 'Concluído' ? '#065f46' : ev.status === 'Cancelado' ? '#991b1b' : '#4338ca', padding: '4px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500' }}>
                                      {ev.status}
                                    </span>
                                  </td>
                                  <td>
                                    <button onClick={() => run(() => abrirDetalhesEvento(ev), `detalhes-${ev.id}`)} disabled={isLoading(`detalhes-${ev.id}`)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                                      {isLoading(`detalhes-${ev.id}`) ? 'Carregando...' : 'Detalhes →'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* ── CARDS MOBILE ── */}
                        <div className="mobile-cards-container">
                          {eventos.filter(ev => {
                            if (activeSubTab === 'agendados')  return ev.status === 'Agendado';
                            if (activeSubTab === 'concluidos') return ev.status === 'Concluído';
                            return true;
                          }).map(ev => {
                            const total    = ev.vagasTotais;
                            const ocupacao = ev.vagasPreenchidas;
                            const pct      = total > 0 ? (ocupacao / total) * 100 : 0;
                            
                            // Define cores da tag de status no mobile
                            let statusBg = '#e0e7ff';
                            let statusColor = '#4338ca';
                            if (ev.status === 'Concluído') { statusBg = '#d1fae5'; statusColor = '#065f46'; }
                            if (ev.status === 'Cancelado') { statusBg = '#fee2e2'; statusColor = '#991b1b'; }

                            return (
                              <div className="prova-mobile-card" key={ev.id}>
                                <div className="prova-mobile-top">
                                  <div className="prova-mobile-nome">
                                    {ev.titulo}
                                    <div className="prova-mobile-sub">R$ {ev.valor}/hora</div>
                                  </div>
                                  <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                    {ev.status}
                                  </span>
                                </div>
                                <div className="prova-mobile-data">📅 {ev.data}</div>
                                <div className="prova-mobile-bottom">
                                  <div className="prova-mobile-progress">
                                    <div className="prova-mobile-bar">
                                      <div className="prova-mobile-bar-fill" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#10b981' : '#3b82f6' }}></div>
                                    </div>
                                    <span className="prova-mobile-vagas">{ocupacao}/{total}</span>
                                  </div>
                                  <button onClick={() => run(() => abrirDetalhesEvento(ev), `detalhes-${ev.id}`)} disabled={isLoading(`detalhes-${ev.id}`)} className="btn-candidatar-mobile">{isLoading(`detalhes-${ev.id}`) ? 'Carregando...' : 'Detalhes →'}</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
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
                  <button onClick={abrirModalRelatorio} style={{ padding:'9px 18px', border:'1px solid #d1d5db', background:'#fff', borderRadius:'8px', color:'#374151', fontWeight:'600', cursor:'pointer', fontSize:'13.5px', display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
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
                    {alocacoesEvento.length > 0 && (
                      <span style={{ background:'#dcfce7', color:'#15803d', padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'700' }}>
                        {alocacoesEvento.length} presentes
                      </span>
                    )}
                  </div>
                  <div style={{ background:'#f8f9fb', padding:'10px 22px', display:'grid', gridTemplateColumns:'1fr 120px 180px 100px 100px', gap:'16px', borderBottom:'1px solid #e5e7eb' }}>
                    {['MEMBRO','FUNÇÃO','SALA','ENTRADA','SAÍDA'].map(h => (
                      <span key={h} style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</span>
                    ))}
                  </div>
                  {alocacoesEvento.length === 0 ? (
                    <div style={{ padding:'32px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>Nenhum membro confirmou presença com ponto registrado.</div>
                  ) : (
                    alocacoesEvento.map((m, i, arr) => (
                      <div key={m.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px 180px 100px 100px', gap:'16px', padding:'14px 22px', alignItems:'center', borderBottom: i < arr.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                        <div>
                          <div style={{ fontWeight:'600', color:'#0f172a', fontSize:'13.5px' }}>{m.nome}</div>
                          <div style={{ fontSize:'12px', color:'#94a3b8' }}>{m.email}</div>
                          {m.horarioEntrada && !m.horarioSaida && (
                            <span style={{ display:'inline-block', marginTop:'4px', background:'#fef3c7', color:'#92400e', padding:'2px 8px', borderRadius:'10px', fontSize:'10.5px', fontWeight:'700' }}>
                              ⚠️ Sem saída registrada
                            </span>
                          )}
                        </div>
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
                    <button onClick={() => run(handlePublicarSalas, 'publicar-salas')} disabled={isLoading('publicar-salas')} style={{ padding:'10px 20px', border:'none', background:'#2563eb', borderRadius:'8px', color:'#fff', fontWeight:'600', cursor:'pointer' }}>{isLoading('publicar-salas') ? 'Publicando...' : 'Publicar Salas'}</button>
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
                                <button onClick={() => run(() => handleCancelarInscricao(candidato), `cancelar-inscricao-${candidato.id}`)} disabled={isLoading(`cancelar-inscricao-${candidato.id}`)} style={{ background:'none', border:'none', color:'#ef4444', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>{isLoading(`cancelar-inscricao-${candidato.id}`) ? 'Cancelando...' : 'Cancelar Inscrição'}</button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                          <button className="btn-success-small" onClick={()=>run(() => handleAprovarCandidato(candidato.id), `candidato-${candidato.id}`)} disabled={isLoading(`candidato-${candidato.id}`)}>{isLoading(`candidato-${candidato.id}`) ? '...' : '✓ Aprovar'}</button>
                          <button className="btn-danger-small"  onClick={()=>run(() => handleRecusarCandidato(candidato.id), `candidato-${candidato.id}`)} disabled={isLoading(`candidato-${candidato.id}`)}>{isLoading(`candidato-${candidato.id}`) ? '...' : '✕ Recusar'}</button>
                        </div>
                      </div>
                      <div className="aprov-fields">
                        <div className="aprov-field-item"><span className="aprov-field-label">CPF</span><span className="aprov-field-val">{candidato.cpf}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">DATA DE NASC.</span><span className="aprov-field-val">{candidato.dataNascimento}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">CELULAR</span><span className="aprov-field-val">{candidato.celular}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">E-MAIL</span><span className="aprov-field-val">{candidato.email}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">ESCOLARIDADE</span><span className="aprov-field-val">{candidato.escolaridade}</span></div>
                        <div className="aprov-field-item"><span className="aprov-field-label">CURSO</span><span className="aprov-field-val">{candidato.cursoFormacao}</span></div>
                        <div className="aprov-field-item" style={{ gridColumn:'1/-1' }}><span className="aprov-field-label">EXPERIÊNCIA</span><span className="aprov-field-val">{candidato.experienciaProfissional}</span></div>
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
                    <button className="btn-primary" onClick={() => run(handleSalvarAlteracoes, 'salvar-membros')} disabled={Object.keys(alteracoesPendentes).length===0 || isLoading('salvar-membros')}>{isLoading('salvar-membros') ? 'Salvando...' : '✓ Salvar Alterações'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ PERFIL (FOTO DE PERFIL ADICIONADA) ══ */}
        {activeTab === 'perfil' && (
          <div className="panel active">
            <div className="page-header"><div><h1 className="page-title">Meu Perfil</h1><p className="page-sub">Atualize suas informações.</p></div></div>
            <div className="card">
              <div style={{ display:'flex', alignItems:'center', gap:'20px', padding:'20px 24px', background:'var(--gray-50)', borderBottom:'1px solid var(--gray-100)' }}>
                
                {/* Zona de Upload da Imagem */}
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label htmlFor="perfil-foto-input" style={{ cursor: 'pointer' }}>
                    <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:'var(--blue-dark)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'26px', fontWeight:'700', color:'#fff', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        iniciais
                      )}
                    </div>
                  </label>
                  <input type="file" id="perfil-foto-input" accept="image/*" onChange={handleFotoChange} style={{ display: 'none' }} />
                  <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '500', marginTop: '6px', cursor: 'pointer' }}>Alterar foto</span>
                </div>

                <div><div style={{ fontWeight:'700', fontSize:'16px' }}>{perfilFormData.nome||nomeLogado}</div><div style={{ fontSize:'13px', color:'var(--gray-500)', marginTop:'3px' }}>{perfilFormData.email}</div></div>
              </div>
              <div style={{ padding:'28px 24px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                  <div className="field-grp"><label>NOME COMPLETO</label><input type="text" name="nome" value={perfilFormData.nome} onChange={handlePerfilChange}/></div>
                  <div className="field-grp"><label>E-MAIL</label><input type="email" name="email" value={perfilFormData.email} onChange={handlePerfilChange}/></div>
                  <div className="field-grp"><label>TELEFONE</label><input type="text" name="telefone" value={perfilFormData.telefone} onChange={handlePerfilChange}/></div>
                  <div className="field-grp" style={{ gridColumn:'1/-1' }}><label>SENHA ATUAL</label><input type="password" name="senhaAtual" value={perfilFormData.senhaAtual} onChange={handlePerfilChange} placeholder="Necessária apenas para trocar a senha"/></div>
                  <div className="field-grp" style={{ gridColumn:'1/-1' }}><label>NOVA SENHA</label><input type="password" name="novaSenha" value={perfilFormData.novaSenha} onChange={handlePerfilChange} placeholder="Deixe em branco para não alterar"/></div>
                  <div className="field-grp" style={{ gridColumn:'1/-1' }}><label>CONFIRMAR SENHA</label><input type="password" name="confirmarSenha" value={perfilFormData.confirmarSenha} onChange={handlePerfilChange} placeholder="Repita a nova senha"/></div>
                </div>
                <div style={{ display:'flex', gap:'10px', marginTop:'20px' }}><button className="btn-outline" disabled={isLoading()}>Cancelar</button><button className="btn-primary" onClick={handleSalvarPerfil} disabled={isLoading()}>{isLoading() ? 'Salvando...' : 'Salvar Alterações'}</button></div>
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
                      4. O QR expira à <strong>meia-noite</strong> do dia da prova.
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-head"><span className="card-title">Eventos para Geração de QR Code</span><span style={{ fontSize:'12.5px', color:'#64748b' }}>Clique em "Gerar" ao encerrar a aplicação</span></div>
                  <div className="tbl-wrap">
                    {eventos.length===0?(
                      <div style={{ textAlign:'center', padding:'48px 20px' }}><div style={{ fontSize:'36px', marginBottom:'10px' }}>📋</div><p style={{ color:'#64748b', fontSize:'14px' }}>Nenhum evento cadastrado ainda.</p></div>
                    ):(
                      <>
                        {/* ── TABELA DESKTOP ── */}
                        <table className="desktop-table">
                          <thead><tr><th>EVENTO</th><th>DATA</th><th>VAGAS</th><th>STATUS</th><th>QR CODE</th></tr></thead>
                          <tbody>{eventos.map(ev=>(
                            <tr key={ev.id}>
                              <td><div style={{ fontWeight:'600', color:'#0f172a', fontSize:'14px' }}>{ev.titulo}</div><div style={{ fontSize:'12px', color:'#64748b' }}>R$ {ev.valor}/hora</div></td>
                              <td style={{ fontSize:'13.5px', color:'#334155', fontFamily:'monospace' }}>{ev.data}</td>
                              <td style={{ fontSize:'13.5px', color:'#334155' }}>{ev.vagasPreenchidas}/{ev.vagasTotais}</td>
                              <td><span style={{ backgroundColor: ev.status==='Concluído'?'#d1fae5':ev.status==='Cancelado'?'#fee2e2':'#e0e7ff', color: ev.status==='Concluído'?'#065f46':ev.status==='Cancelado'?'#991b1b':'#4338ca', padding:'4px 12px', borderRadius:'9999px', fontSize:'12px', fontWeight:'500' }}>{ev.status}</span></td>
                              <td>{ev.status==='Cancelado'?(<span style={{ fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>Evento cancelado</span>):(<button onClick={()=>abrirQrEvento(ev)} disabled={isLoading(`qr-${ev.id}`)} style={{ background:'#2563eb', color:'#fff', border:'none', padding:'7px 14px', borderRadius:'8px', fontFamily:'inherit', fontSize:'12.5px', fontWeight:'600', cursor: isLoading(`qr-${ev.id}`)?'default':'pointer', opacity: isLoading(`qr-${ev.id}`)?0.7:1 }}>⬛ {isLoading(`qr-${ev.id}`)?'Gerando...':'Gerar QR Code'}</button>)}</td>
                            </tr>
                          ))}</tbody>
                        </table>

                        {/* ── CARDS MOBILE ── */}
                        <div className="mobile-cards-container">
                          {eventos.map(ev => {
                            let statusBg = '#e0e7ff';
                            let statusColor = '#4338ca';
                            if (ev.status === 'Concluído') { statusBg = '#d1fae5'; statusColor = '#065f46'; }
                            if (ev.status === 'Cancelado') { statusBg = '#fee2e2'; statusColor = '#991b1b'; }
                            
                            const pct = ev.vagasTotais > 0 ? (ev.vagasPreenchidas / ev.vagasTotais) * 100 : 0;

                            return (
                              <div className="prova-mobile-card" key={ev.id}>
                                <div className="prova-mobile-top">
                                  <div className="prova-mobile-nome">
                                    {ev.titulo}
                                    <div className="prova-mobile-sub">R$ {ev.valor}/hora</div>
                                  </div>
                                  <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                                    {ev.status}
                                  </span>
                                </div>
                                <div className="prova-mobile-data">📅 {ev.data}</div>
                                <div className="prova-mobile-bottom">
                                  <div className="prova-mobile-progress">
                                    <div className="prova-mobile-bar">
                                      <div className="prova-mobile-bar-fill" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#10b981' : '#3b82f6' }}></div>
                                    </div>
                                    <span className="prova-mobile-vagas">{ev.vagasPreenchidas}/{ev.vagasTotais} vagas</span>
                                  </div>
                                  {ev.status === 'Cancelado' ? (
                                    <span style={{ fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>Evento cancelado</span>
                                  ) : (
                                    <button onClick={() => abrirQrEvento(ev)} disabled={isLoading(`qr-${ev.id}`)} className="btn-candidatar-mobile" style={{ background: '#2563eb', color: '#fff', border: 'none', opacity: isLoading(`qr-${ev.id}`)?0.7:1 }}>
                                      ⬛ {isLoading(`qr-${ev.id}`)?'Gerando...':'Gerar QR Code'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeSubTabRelatorio === 'notafiscal' && (
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,.07)' }}>
                <div style={{ fontSize:'16px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Nota Fiscal — Relatório Agregado</div>
                <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'20px' }}>Filtre o período e gere o relatório agrupado por segmento (EF2 / EM).</div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'14px', marginBottom:'18px' }}>
                  <div>
                    <label style={{ display:'block', fontSize:'11.5px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>DATA INÍCIO *</label>
                    <input type="date" name="dataInicio" value={nfFiltro.dataInicio} onChange={handleNfFiltroChange} style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #d1d5db', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11.5px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>DATA FIM *</label>
                    <input type="date" name="dataFim" value={nfFiltro.dataFim} onChange={handleNfFiltroChange} style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #d1d5db', boxSizing:'border-box' }}/>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11.5px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>SEGMENTO</label>
                    <select name="segmento" value={nfFiltro.segmento} onChange={handleNfFiltroChange} style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #d1d5db', boxSizing:'border-box' }}>
                      <option value="">Todos</option>
                      <option value="EF2">EF2</option>
                      <option value="EM">EM</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11.5px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>SÉRIE (opcional)</label>
                    <select name="serie" value={nfFiltro.serie} onChange={handleNfFiltroChange} disabled={!nfFiltro.segmento} style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #d1d5db', boxSizing:'border-box', background: !nfFiltro.segmento ? '#f3f4f6' : '#fff' }}>
                      <option value="">Todas</option>
                      {(nfFiltro.segmento === 'EF2' ? SERIES_EF2 : nfFiltro.segmento === 'EM' ? SERIES_EM : []).map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'11.5px', fontWeight:'600', color:'#374151', marginBottom:'4px' }}>PESSOA (opcional)</label>
                    <select name="idUsuario" value={nfFiltro.idUsuario} onChange={handleNfFiltroChange} style={{ width:'100%', padding:'9px 10px', borderRadius:'8px', border:'1px solid #d1d5db', boxSizing:'border-box' }}>
                      <option value="">Todas</option>
                      {membrosAtivos.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button onClick={handleBuscarPreviaNotaFiscal} disabled={isLoading('nf-previa')} style={{ padding:'10px 20px', border:'none', background:'#2563eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', color:'#fff', cursor: isLoading('nf-previa') ? 'default' : 'pointer', opacity: isLoading('nf-previa') ? 0.7 : 1 }}>
                  {isLoading('nf-previa') ? 'Buscando...' : '🔍 Buscar Prévia'}
                </button>

                {nfPreview && (
                  <div style={{ marginTop:'24px', borderTop:'1px solid #e5e7eb', paddingTop:'20px' }}>
                    {nfPreview.eventosSemSerieClassificavel > 0 && (
                      <div style={{ background:'#fef3c7', border:'1px solid #fde68a', color:'#92400e', padding:'10px 14px', borderRadius:'8px', fontSize:'13px', marginBottom:'16px' }}>
                        ⚠ {nfPreview.eventosSemSerieClassificavel} evento(s) no período não têm Série classificável em EF2/EM — revise manualmente.
                      </div>
                    )}

                    {nfPreview.segmentos.length === 0 && (
                      <p style={{ color:'#64748b', fontSize:'13.5px' }}>Nenhum registro encontrado para esse filtro.</p>
                    )}

                    {nfPreview.segmentos.map(seg => (
                      <div key={seg.nomeSegmento} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f1f3f6', fontSize:'13.5px' }}>
                        <span style={{ fontWeight:'600', color:'#0f172a' }}>{seg.nomeSegmento}</span>
                        <span style={{ color:'#64748b' }}>{seg.pessoas.length} pessoa(s) · {seg.totalSegmentoHoras.toFixed(1)}h</span>
                        <span style={{ fontWeight:'700', color:'#0f172a' }}>R$ {seg.totalSegmentoValor.toFixed(2)}</span>
                      </div>
                    ))}

                    {nfPreview.segmentos.length > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', padding:'14px 0 20px', fontSize:'15px', fontWeight:'700', color:'#0f172a' }}>
                        <span>TOTAL GERAL</span>
                        <span>R$ {nfPreview.totalGeralValor.toFixed(2)}</span>
                      </div>
                    )}

                    <button onClick={handleBaixarNotaFiscalPdf} disabled={isLoading('nf-pdf')} style={{ padding:'10px 20px', border:'none', background:'#27AE60', borderRadius:'8px', fontSize:'13px', fontWeight:'600', color:'#fff', cursor: isLoading('nf-pdf') ? 'default' : 'pointer', opacity: isLoading('nf-pdf') ? 0.7 : 1 }}>
                      {isLoading('nf-pdf') ? 'Gerando...' : '⬇ Baixar PDF'}
                    </button>
                  </div>
                )}
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
              <div className="field-grp full"><label>SÉRIE / TURMA</label><select name="serie" value={eventoFormData.serie} onChange={handleInputChange}><option value="">Selecione</option>{SERIES_EF2.map(s=>(<option key={s.value} value={s.value}>{s.label}</option>))}{SERIES_EM.map(s=>(<option key={s.value} value={s.value}>{s.label}</option>))}</select></div>
              <div className="field-grp"><label>DATA *</label><input type="date" name="data" value={eventoFormData.data} onChange={handleInputChange}/></div>
              <div className="field-grp"><label>HORÁRIO *</label><input type="time" name="horario" value={eventoFormData.horario} onChange={handleInputChange}/></div>
              <div className="field-grp"><label>DURAÇÃO (HORAS) *</label><input type="number" name="duracao" value={eventoFormData.duracao} onChange={handleInputChange} placeholder="Ex: 4"/></div>
              <div className="field-grp"><label>VALOR / HORA (R$)</label><input type="number" name="valor" value={eventoFormData.valor} onChange={handleInputChange} placeholder="Ex: 37"/></div>
              <div className="field-grp"><label>TIPO DE FUNÇÃO</label><select name="tipoFuncao" value={eventoFormData.tipoFuncao} onChange={handleInputChange}><option value="Ledor">Ledor</option><option value="Fiscal">Fiscal / Aplicador</option><option value="Ambos">Ambos</option></select></div>
              {eventoFormData.tipoFuncao === 'Ambos' ? (
                <>
                  <div className="field-grp"><label>VAGAS LEDOR *</label><input type="number" name="vagasLedor" value={eventoFormData.vagasLedor} onChange={handleInputChange} placeholder="Ex: 3"/></div>
                  <div className="field-grp"><label>VAGAS FISCAL *</label><input type="number" name="vagasFiscal" value={eventoFormData.vagasFiscal} onChange={handleInputChange} placeholder="Ex: 2"/></div>
                </>
              ) : (
                <div className="field-grp"><label>VAGAS *</label><input type="number" name="vagas" value={eventoFormData.vagas} onChange={handleInputChange} placeholder="Ex: 5"/></div>
              )}
              <div className="field-grp full"><label>OBSERVAÇÕES</label><input type="text" name="observacoes" value={eventoFormData.observacoes} onChange={handleInputChange} placeholder="Informações adicionais"/></div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-outline"
                onClick={()=>{ setIsModalOpen(false); setEditMode(false); }}
                disabled={isLoading('evento-modal')}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={editMode ? handleSalvarEdicao : handleCriarEvento}
                disabled={isLoading('evento-modal')}
                style={{ opacity: isLoading('evento-modal') ? 0.7 : 1, cursor: isLoading('evento-modal') ? 'not-allowed' : 'pointer' }}
              >
                {isLoading('evento-modal') ? 'Salvando...' : (editMode ? 'Salvar Alterações' : 'Criar Evento')}
              </button>
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
            <div style={{ fontSize:'11.5px', color:'#94a3b8', marginBottom:'14px' }}>{qrSegundos===0?'⚠️ QR Code expirado — gere um novo':qrInfo.expiraEm}</div>
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
              <button onClick={()=>{ if(qrTimerRef.current) clearInterval(qrTimerRef.current); abrirQrEvento(eventos.find(e=>e.id===qrInfo.eventoId)||eventos[0]); }} disabled={isLoading(`qr-${qrInfo.eventoId}`)} style={{ padding:'9px 18px', border:'none', background:'#2563eb', borderRadius:'8px', fontFamily:'inherit', fontSize:'13px', fontWeight:'600', color:'#fff', cursor:'pointer', opacity: isLoading(`qr-${qrInfo.eventoId}`)?0.7:1 }}>{isLoading(`qr-${qrInfo.eventoId}`) ? 'Gerando...' : '↺ Novo QR'}</button>
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

      {/* MODAL EXPORTAR RELATÓRIO */}
      {relatorioModalAberto && eventoEmDetalhe && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }} onClick={() => setRelatorioModalAberto(false)}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'32px', width:'420px', maxWidth:'96vw', boxShadow:'0 8px 32px rgba(0,0,0,.2)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:'17px', fontWeight:'700', color:'#0f172a', marginBottom:'4px' }}>Exportar Relatório</div>
            <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'20px' }}>{eventoEmDetalhe.titulo}</div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize:'12px', fontWeight:'700', color:'#6b7280', display:'block', marginBottom:'8px' }}>TIPO DE PAGAMENTO</label>
              <select value={relatorioForm.tipoPagamento} onChange={e => setRelatorioForm(prev => ({ ...prev, tipoPagamento: e.target.value }))} style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid #d1d5db' }}>
                <option value="PorHora">Por hora trabalhada</option>
                <option value="ValorFixo">Valor fixo por pessoa</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize:'12px', fontWeight:'700', color:'#6b7280', display:'block', marginBottom:'8px' }}>
                {relatorioForm.tipoPagamento === 'PorHora' ? 'VALOR / HORA (R$)' : 'VALOR FIXO POR PESSOA (R$)'}
              </label>
              <input type="number" value={relatorioForm.valor} onChange={e => setRelatorioForm(prev => ({ ...prev, valor: e.target.value }))} placeholder="Ex: 37" style={{ width:'100%', padding:'10px 12px', borderRadius:'8px', border:'1px solid #d1d5db' }} />
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px' }}>
              <button onClick={() => setRelatorioModalAberto(false)} disabled={isLoading('relatorio-pdf')} style={{ padding:'9px 18px', border:'1.5px solid #e4e7ed', background:'#fff', borderRadius:'8px', fontSize:'13px', fontWeight:'500', color:'#374151', cursor:'pointer' }}>Cancelar</button>
              <button onClick={handleBaixarRelatorio} disabled={isLoading('relatorio-pdf')} style={{ padding:'9px 18px', border:'none', background:'#2563eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', color:'#fff', cursor: isLoading('relatorio-pdf') ? 'default' : 'pointer', opacity: isLoading('relatorio-pdf') ? 0.7 : 1 }}>
                {isLoading('relatorio-pdf') ? 'Gerando...' : '⬇ Baixar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};