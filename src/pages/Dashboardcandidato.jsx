import React, { useState, useEffect, useRef } from 'react';
import '../styles/Dashboardcoor.css';
import '../styles/Dashboardcandidato.css';
import api, { eventoService, pontoService } from '../services/api';
import { LayoutDashboard, UserCheck, Users, FileText, User, FileCheck, Search, Wallet, Clock} from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useToast } from '../context/ToastContext.jsx';

export const DashboardCandidato = () => {
  const { showToast } = useToast();

  // ─── 1. NAVEGAÇÃO ────────────────────────────────────────────
  const [activeTab,    setActiveTab]    = useState('provas');
  const [activeSubTab, setActiveSubTab] = useState('comVagas');

  // ─── 2. MODAIS E DETALHES ────────────────────────────────────
  const [provaSelecionada,        setProvaSelecionada]        = useState(null);
  const [candidaturaEmDetalhe,    setCandidaturaEmDetalhe]    = useState(null);
  const [candidaturaParaCancelar, setCandidaturaParaCancelar] = useState(null);
  const [motivoCancelamento,      setMotivoCancelamento]      = useState('');
  const [provaParaRelatar,        setProvaParaRelatar]        = useState(null);
  const [relatoForm,              setRelatoForm]              = useState({ tipo: '', descricao: '' });

  // ─── 3. DADOS DO USUÁRIO ─────────────────────────────────────
  const usuarioLocal = JSON.parse(localStorage.getItem('usuario') || '{}');
  
  const nomeLogado   = usuarioLocal?.nome || localStorage.getItem('nomeUsuario')   || 'João Santos';
  const perfilLogado = usuarioLocal?.tipoUsuario || localStorage.getItem('perfilUsuario') || 'Ledor';
  const emailLogado  = usuarioLocal?.email || localStorage.getItem('emailUsuario')  || 'joao@email.com';

  const iniciais = nomeLogado && nomeLogado !== 'Candidato'
    ? nomeLogado.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'JS';

  // ─── 4. LISTAS DE DADOS ──────────────────────────────────────
  const [provasDisponiveis,  setProvasDisponiveis]  = useState([]);
  const [provasEmReserva,    setProvasEmReserva]    = useState([]);
  const [totalVagasLivres,   setTotalVagasLivres]   = useState(0);
  const [minhasCandidaturas, setMinhasCandidaturas] = useState([]);
  const [provasAplicadas,    setProvasAplicadas]    = useState([]);

  // ─── 5. PERFIL ───────────────────────────────────────────────
  const [perfilFormData, setPerfilFormData] = useState({
    nome: nomeLogado, email: emailLogado,
    cpf: '', celular: '',
    senhaAtual: '', novaSenha: '', confirmarSenha: ''
  });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  // ─── 6. PONTO ────────────────────────────────────────────────
  const [horaAtual,        setHoraAtual]       = useState(new Date());
  const [statusPonto,      setStatusPonto]     = useState('entrada');
  const [registrosDeHoje, setRegistrosDeHoje] = useState([]);
  const [scaneando,       setScaneando]       = useState(false);
  const scaneandoTokenRef = useRef(false); // trava contra chamadas duplicadas do onScan (várias por segundo)

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── HELPER: formata hora de string ISO ──────────────────────
  const formatarHora = (dataString) => {
    if (!dataString) return '--:--';
    try {
      const dataCorrigida = dataString.endsWith('Z') ? dataString : dataString + 'Z';
      return new Date(dataCorrigida).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '--:--'; }
  };

  const formatarData = (data) => {
    const f = data.toLocaleDateString('pt-BR', {
      weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    return f.charAt(0).toUpperCase() + f.slice(1);
  };

  // ─── HELPER: verifica se data é hoje ─────────────────────────
  const ehHoje = (data) => {
    if (!data) return false;
    const hoje = new Date();
    return data.getDate()     === hoje.getDate()     &&
           data.getMonth()    === hoje.getMonth()    &&
           data.getFullYear() === hoje.getFullYear();
  };

  // ─── 7. CARREGAR EVENTOS ─────────────────────────────────────
  const carregarEventos = async () => {
    try {
      const dadosEventos = await eventoService.listarEventos();
      const agora        = new Date();
      const comVagas     = [];
      const emReserva    = [];
      let   vagasLivres  = 0;

      dadosEventos.forEach(e => {
        if (e.statusEvento !== 'ATIVO') return;
        const dataDaProva = new Date(e.dataProva.endsWith('Z') ? e.dataProva : e.dataProva + 'Z');
        if (dataDaProva <= agora) return;

        const vagasLedor  = e.totalVagasLedor  ?? e.vagasLedor  ?? 0;
        const vagasFiscal = e.totalVagasFiscal ?? e.vagasFiscal ?? 0;

        if (perfilLogado === 'Fiscal' && vagasFiscal <= 0) return;
        if (perfilLogado === 'Ledor' && vagasLedor <= 0 && vagasFiscal <= 0) return;

        let papelConcorrencia = perfilLogado;
        if (perfilLogado === 'Ledor' && vagasLedor === 0 && vagasFiscal > 0) {
            papelConcorrencia = 'Fiscal';
        }

        let vagasTotaisParaMim = 0;
        let vagasDisponiveisParaMim = 0;

        if (papelConcorrencia === 'Ledor') {
            vagasTotaisParaMim = vagasLedor;
            vagasDisponiveisParaMim = Math.max(0, e.vagasLedorDisponiveis !== undefined && e.vagasLedorDisponiveis !== null ? e.vagasLedorDisponiveis : vagasLedor);
        } else {
            vagasTotaisParaMim = vagasFiscal;
            vagasDisponiveisParaMim = Math.max(0, e.vagasFiscalDisponiveis !== undefined && e.vagasFiscalDisponiveis !== null ? e.vagasFiscalDisponiveis : vagasFiscal);
        }

        const vagasPreenchidasParaMim = vagasTotaisParaMim - vagasDisponiveisParaMim;
        const temVaga = vagasDisponiveisParaMim > 0;

        if (temVaga) vagasLivres += vagasDisponiveisParaMim;

        const dia  = dataDaProva.getDate();
        const mes  = dataDaProva.toLocaleDateString('pt-BR', { month: 'long' });
        const hora = dataDaProva.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const titulo = e.nomeProva || e.tituloProva || 'Sem título';

        const provaFormatada = {
          id: e.idEvento, 
          titulo,
          funcaoInscricao: papelConcorrencia, 
          detalhes: `Vaga para: ${papelConcorrencia} · ${e.serie || 'HIS'}`,
          data: `${dia} de ${mes}, ${hora}`,
          vagasTotais: vagasTotaisParaMim,
          vagasPreenchidas: vagasPreenchidasParaMim,
          vagasDisponiveis: vagasDisponiveisParaMim,
          valor: e.valorHora != null ? `R$ ${e.valorHora}/hora` : 'R$ 37/hora',
          serie: e.serie || 'HIS',
          status: temVaga ? 'Aberta' : 'Na Reserva',
        };

        if (temVaga) comVagas.push(provaFormatada);
        else         emReserva.push(provaFormatada);
      });

      setProvasDisponiveis(comVagas);
      setProvasEmReserva(emReserva);
      setTotalVagasLivres(vagasLivres);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
    }
  };

  // ─── 8. CARREGAR CANDIDATURAS (BLINDADO) ─────────────────────
  const carregarMinhasCandidaturas = async () => {
    try {
      const [respostaAlocacoes, dadosEventos] = await Promise.all([
        api.get('/alocacoes/minhas'),
        eventoService.listarEventos(),
      ]);

      const pendentes = [];
      const historico = [];
      const registrosRestaurados = [];

      respostaAlocacoes.data.forEach(alocacao => {
        const idEvento    = alocacao.idEvento    ?? alocacao.id_evento    ?? alocacao.IdEvento;
        const papelEvento = alocacao.papelEvento ?? alocacao.papel_evento ?? alocacao.PapelEvento ?? 'N/A';
        const statusDB    = alocacao.statusParticipacao || alocacao.StatusParticipacao || 'Confirmado';

        const checkIn  = alocacao.checkInTime  || alocacao.CheckInTime  || null;
        const checkOut = alocacao.checkOutTime || alocacao.CheckOutTime || null;

        const horas = Number(alocacao.horasTrabalhadas ?? alocacao.HorasTrabalhadas ?? 0);
        const evento = dadosEventos.find(ev => Number(ev.idEvento) === Number(idEvento));

        let dataFormatada = 'Data não informada';
        let dataPura      = null;
        let horarioFimPura = null;

        if (evento?.dataProva) {
          const d = new Date(evento.dataProva.endsWith('Z') ? evento.dataProva : evento.dataProva + 'Z');
          dataPura = d;
          if (!isNaN(d.getTime())) {
            dataFormatada = `${d.getDate()} de ${d.toLocaleDateString('pt-BR', { month: 'long' })}, ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          }
        }

        if (evento?.horarioFim) {
          const hf = new Date(evento.horarioFim.endsWith('Z') ? evento.horarioFim : evento.horarioFim + 'Z');
          if (!isNaN(hf.getTime())) horarioFimPura = hf;
        }

        // Descobre o status correto a mostrar (Capturando o "Pago")
        let statusExibicao = 'Confirmado';
        if (statusDB.toLowerCase() === 'pago') statusExibicao = 'Pago 💰';
        else if (checkOut) statusExibicao = 'Concluída';
        else if (checkIn) statusExibicao = 'Em Andamento';

        const provaEstruturada = {
          id:              idEvento,
          titulo:          evento?.nomeProva || evento?.tituloProva || 'Prova sem título',
          data:            dataFormatada,
          dataPura,
          horarioFimPura,
          serie:           evento?.serie || 'HIS',
          funcao:          papelEvento,
          status:          statusExibicao,
          sala:            alocacao.salaDesignada || alocacao.SalaDesignada || '',
          observacoes:     alocacao.observacoes   || alocacao.Observacoes   || '',
          entrada:         formatarHora(checkIn),
          saida:           formatarHora(checkOut),
          horasTrabalhadas: horas,
        };

        const agora = new Date();
        const eventoJaPassou = dataPura && dataPura < agora;
        const horarioFimJaPassou = horarioFimPura && horarioFimPura < agora;

        // SELETOR BLINDADO: Impede sumiços!
        if (statusDB.toLowerCase() === 'cancelado') {
          // Ignora totalmente (Segurança extra caso o Back-end envie cancelados)
        } else if (checkOut || statusDB.toLowerCase() === 'pago') {
          // Fez checkout ou já foi pago -> Vai pro Histórico (Aplicadas)
          historico.push(provaEstruturada);
        } else if (checkIn && horarioFimJaPassou) {
          // Fez checkin, NUNCA fez checkout, e o horário da prova já encerrou ->
          // órfão: não pode ficar preso em "pendente" pra sempre (travaria o ponto
          // de provas novas). Migra pro Histórico com aviso.
          provaEstruturada.status = 'Saída Não Registrada';
          historico.push(provaEstruturada);
        } else if (checkIn) {
          // Fez checkin mas NÃO fez checkout, e a prova ainda está no horário -> Fica pendente
          pendentes.push(provaEstruturada);

          // RESTAURA estado do ponto se já bateu entrada hoje
          if (dataPura && ehHoje(dataPura)) {
            if (registrosRestaurados.length === 0) {
              registrosRestaurados.push({
                tipo:   'entrada',
                hora:   formatarHora(checkIn),
                status: '✅ Entrada registrada (restaurada do banco)',
              });
            }
          }
        } else if (!eventoJaPassou) {
          // Não bateu ponto, mas a prova ainda vai acontecer -> Fica Pendente
          pendentes.push(provaEstruturada);
        } else {
          // Data já passou e NUNCA bateu ponto -> Vai pro Histórico como "Faltou" para não sumir do ar!
          provaEstruturada.status = 'Ausente / Sem Ponto';
          historico.push(provaEstruturada);
        }
      });

      setMinhasCandidaturas(pendentes);
      setProvasAplicadas(historico);

      if (registrosRestaurados.length > 0) {
        setRegistrosDeHoje(registrosRestaurados);
        setStatusPonto('saida');
      }

    } catch (error) {
      console.error('Erro ao buscar candidaturas:', error);
    }
  };

  useEffect(() => {
    carregarEventos();
    carregarMinhasCandidaturas(); // MOVIDO PARA CIMA: Agora sim carrega ao abrir a página!

    const radarDeProvas = setInterval(() => {
      carregarEventos();
    }, 30000);

    return () => clearInterval(radarDeProvas);
  }, []);
  

  // ─── 9. FINANCEIRO ───────────────────────────────────────────
  const valorFixoHora         = 37;
  const totalHorasHistorico   = provasAplicadas.reduce((acc, p) => acc + (p.horasTrabalhadas || 0), 0);
  const totalReceberHistorico = totalHorasHistorico * valorFixoHora;

  const calcularProximoPagamento = () => {
    const hoje = new Date();
    const dia  = hoje.getDate();
    const mes  = hoje.getMonth();
    const ano  = hoje.getFullYear();
    return dia <= 15
      ? new Date(ano, mes, 15).toLocaleDateString('pt-BR')
      : new Date(ano, mes + 1, 0).toLocaleDateString('pt-BR');
  };

  const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

  // ─── HELPER: cor/texto do status em "Provas Aplicadas" ───────
  const statusAplicadaInfo = (status) => {
    if (status === 'Saída Não Registrada') {
      return { cor: '#92400e', texto: '⚠️ Entrada registrada, saída não batida' };
    }
    return { cor: status === 'Pago 💰' ? '#16a34a' : '#64748b', texto: status };
  };

  // ─── 10. ID DO EVENTO DE HOJE ────────────────────────────────
  // provaEmAndamento só pode vencer se também for de hoje — senão um check-in
  // aberto e esquecido de outro dia sequestra o ponto pra sempre (achado real
  // durante teste manual: fica impossível bater ponto em provas novas). Também
  // exige que o HorarioFim ainda não tenha passado — sem isso, um check-in cujo
  // horário de prova já encerrou continuaria travando idProvaAtiva até o próximo
  // refetch (carregarMinhasCandidaturas já move esses casos pro Histórico, mas
  // essa guarda extra cobre o intervalo entre o HorarioFim passar e o refetch
  // acontecer, já que horaAtual re-renderiza a cada segundo).
  const provaEmAndamento = minhasCandidaturas.find(c => c.entrada !== '--:--' && c.saida === '--:--' && c.dataPura && ehHoje(c.dataPura) && (!c.horarioFimPura || new Date() < c.horarioFimPura));
  const provaDeHoje = minhasCandidaturas.find(c => c.dataPura && ehHoje(c.dataPura));
  const idProvaAtiva = provaEmAndamento?.id || provaDeHoje?.id || null;

  // ─── 11. BATER PONTO ─────────────────────────────────────────
  const handleRegistrarPonto = async () => {
    if (!idProvaAtiva) {
      const primeiraConfirmada = minhasCandidaturas.find(c => c.status === 'Confirmado');
      if (!primeiraConfirmada) {
        showToast('Você não possui nenhuma prova confirmada para hoje.', 'warning');
        return;
      }
    }

    const idParaUsar = idProvaAtiva || minhasCandidaturas.find(c => c.status === 'Confirmado')?.id;

    try {
      if (statusPonto === 'entrada') {
        await pontoService.registrarEntrada(idParaUsar);

        setRegistrosDeHoje(prev => [...prev, {
          tipo:   'entrada',
          hora:   horaAtual.toLocaleTimeString('pt-BR'),
          status: '✅ Entrada salva no banco de dados',
        }]);
        setStatusPonto('saida');
        carregarMinhasCandidaturas();
      } else {
        scaneandoTokenRef.current = false;
        setScaneando(true);
      }
    } catch (error) {
      console.error('Erro checkin:', error.response?.data);
      const msg = error.response?.data?.mensagem
        || error.response?.data?.message
        || 'Erro ao registrar entrada. Você já registrou hoje?';
      showToast(msg, 'error');
    }
  };

  const confirmarScaneamentoQRCode = async (tokenQRCode) => {
    if (scaneandoTokenRef.current) return; // evita disparo duplicado por frame da câmera
    scaneandoTokenRef.current = true;

    if (!idProvaAtiva) {
      showToast('Nenhuma prova em andamento hoje — check-in não encontrado.', 'warning');
      scaneandoTokenRef.current = false;
      setScaneando(false);
      return;
    }

    const idParaUsar = idProvaAtiva;

    try {
      await pontoService.registrarSaida(idParaUsar, tokenQRCode);

      setRegistrosDeHoje(prev => [...prev, {
        tipo:   'saida',
        hora:   horaAtual.toLocaleTimeString('pt-BR'),
        status: '✅ Saída salva — horas calculadas pelo sistema',
      }]);
      setScaneando(false);
      setStatusPonto('concluido');

      await carregarMinhasCandidaturas();
    } catch (error) {
      console.error('Erro checkout:', error.response?.data);
      const msg = error.response?.data?.mensagem || 'Erro ao registrar saída.';
      showToast(msg, 'error');
      scaneandoTokenRef.current = false; // permite tentar de novo com outro QR
    }
  };

  // ─── 12. PERFIL ──────────────────────────────────────────────
  const handlePerfilChange = (e) => {
    const { name, value } = e.target;
    setPerfilFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSalvarPerfil = async () => {
    if (perfilFormData.novaSenha && perfilFormData.novaSenha !== perfilFormData.confirmarSenha) {
      showToast('As senhas não coincidem!', 'warning'); return;
    }
    if (perfilFormData.novaSenha && !perfilFormData.senhaAtual) {
      showToast('Informe sua senha atual para definir uma nova senha.', 'warning'); return;
    }

    setSalvandoPerfil(true);
    try {
      const payloadPerfil = {};
      if (perfilFormData.nome?.trim())      payloadPerfil.NomeCompleto = perfilFormData.nome.trim();
      if (perfilFormData.celular?.trim())   payloadPerfil.Celular      = perfilFormData.celular.trim();

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
    } finally {
      setSalvandoPerfil(false);
    }
  };

  // ─── 13. CANDIDATURA ─────────────────────────────────────────
  const confirmarCandidatura = async () => {
    try {
      await eventoService.inscreverEmEvento(provaSelecionada.id, { PapelEvento: provaSelecionada.funcaoInscricao });
      const nova = {
        id: provaSelecionada.id, titulo: provaSelecionada.titulo,
        data: provaSelecionada.data, dataPura: null,
        serie: provaSelecionada.serie || 'HIS',
        funcao: provaSelecionada.funcaoInscricao , 
        status: 'Confirmado',
      };
      setMinhasCandidaturas(prev => [...prev, nova]);
      carregarEventos();
      showToast('Inscrição confirmada com sucesso!', 'success');
      setProvaSelecionada(null);
      setActiveTab('candidaturas');
    } catch (error) {
      let msg = 'Erro ao se candidatar.';
      if (error.response?.data?.mensagem)                msg = error.response.data.mensagem;
      else if (error.response?.data?.errors)             msg = JSON.stringify(error.response.data.errors);
      else if (typeof error.response?.data === 'string') msg = error.response.data;
      showToast(msg, 'error');
    }
  };

  // ─── 14. CANCELAMENTO ────────────────────────────────────────
  const abrirModalCancelamento = (candidatura) => {
    setCandidaturaParaCancelar(candidatura);
    setMotivoCancelamento('');
  };

  const efetivarCancelamento = async () => {
    if (!motivoCancelamento) {
      showToast('Selecione um motivo.', 'warning');
      return;
    }

    try {
      await api.put(`/alocacoes/evento/${candidaturaParaCancelar.id}/cancelar`, {
        motivo: motivoCancelamento
      });

      setMinhasCandidaturas(prev => prev.filter(c => c.id !== candidaturaParaCancelar.id));
      showToast(`Inscrição cancelada: ${motivoCancelamento}`, 'success');
      setCandidaturaParaCancelar(null);
      carregarEventos();

    } catch (error) {
      console.error('Erro detalhado ao cancelar:', error.response?.data || error.message);
      showToast('Erro ao cancelar inscrição. Verifique o console (F12).', 'error');
    }
  };

  // ─── 15. RELATO ──────────────────────────────────────────────
  const abrirModalRelato  = (prova) => { setProvaParaRelatar(prova); setRelatoForm({ tipo: '', descricao: '' }); };
  const fecharModalRelato = ()       => setProvaParaRelatar(null);
  const enviarRelato = async () => {
    if (!relatoForm.tipo || !relatoForm.descricao) { showToast('Preencha tipo e descrição.', 'warning'); return; }
    try {
      await api.post(`/eventos/${provaParaRelatar.id}/ocorrencias`, {
        Tipo: relatoForm.tipo,
        Descricao: relatoForm.descricao,
      });
      showToast('✅ Relato enviado com sucesso à coordenação!', 'success');
      fecharModalRelato();
    } catch (error) {
      showToast(error.response?.data?.mensagem || 'Erro ao enviar relato. Tente novamente.', 'error');
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="dash-candidato-container">

      {/* NAVBAR */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-brand-icon">
            <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8"  y1="2" x2="8"  y2="6"/>
              <line x1="3"  y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          Gestão Ledores e Fiscais
          <div className="his-mark">H<span className="dot">·</span>I<span className="dot">·</span>S</div>
        </div>
        <div className="nav-actions">
          <button className={`nav-btn ${activeTab === 'provas' ? 'active' : ''}`} onClick={() => setActiveTab('provas')}>Provas</button>
          <button className={`nav-btn ${activeTab === 'ganhos' ? 'active' : ''}`} onClick={() => setActiveTab('ganhos')}>$ Ganhos</button>
          <div className="nav-sep"></div>
          <button className="nav-avatar-wrap" onClick={() => setActiveTab('perfil')}>
            <div className="avatar" style={{ background: '#2563eb' }}><span>{iniciais}</span></div>
            <div className="nav-user-info">
              <div className="nav-user-name">{nomeLogado}</div>
              <span className="nav-user-role">Candidato</span>
            </div>
          </button>
        </div>
      </nav>

      {/* TABS */}
      <div className="tabs-bar">
        <button className={`tab ${activeTab === 'aplicadas' ? 'active' : ''}`} onClick={() => { setActiveTab('aplicadas'); setCandidaturaEmDetalhe(null); }}>
          <div className="icon-container">
            <FileCheck size={24} strokeWidth={1.5} />
            {provasAplicadas.length > 0 && (
              <span className="badge-flutuante" style={{ backgroundColor: '#3b82f6' }}>{provasAplicadas.length}</span>
            )}
          </div>
          <span className="tab-label">Aplicadas</span>
        </button>

        <button className={`tab ${activeTab === 'candidaturas' ? 'active' : ''}`} onClick={() => { setActiveTab('candidaturas'); setCandidaturaEmDetalhe(null); }}>
          <div className="icon-container">
            <FileText size={24} strokeWidth={1.5} />
            {minhasCandidaturas.length > 0 && (
              <span className="badge-flutuante" style={{ backgroundColor: '#16a34a' }}>{minhasCandidaturas.length}</span>
            )}
          </div>
          <span className="tab-label">Candidaturas</span>
        </button>

        <button className={`tab ${activeTab === 'provas' ? 'active' : ''}`} onClick={() => { setActiveTab('provas'); setCandidaturaEmDetalhe(null); }}>
          <div className="icon-container">
            <Search size={24} strokeWidth={1.5} />
          </div>
          <span className="tab-label">Disponíveis</span>
        </button>

        <button className={`tab ${activeTab === 'ganhos' ? 'active' : ''}`} onClick={() => { setActiveTab('ganhos'); setCandidaturaEmDetalhe(null); }}>
          <div className="icon-container">
            <Wallet size={24} strokeWidth={1.5} />
          </div>
          <span className="tab-label">Ganhos</span>
        </button>

        <button className={`tab ${activeTab === 'ponto' ? 'active' : ''}`} onClick={() => { setActiveTab('ponto'); setCandidaturaEmDetalhe(null); setScaneando(false); }}>
          <div className="icon-container">
            <Clock size={24} strokeWidth={1.5} />
          </div>
          <span className="tab-label">Ponto</span>
        </button>

        <button className={`tab ${activeTab === 'perfil' ? 'active' : ''}`} style={{ marginLeft: 'auto' }} onClick={() => setActiveTab('perfil')}>
          <div className="icon-container">
            <User size={24} strokeWidth={1.5} />
          </div>
          <span className="tab-label">Perfil</span>
        </button>
      </div>

      <main className="page">

        {/* ── PROVAS DISPONÍVEIS ─────────────────────────────── */}
        {activeTab === 'provas' && (
          <div className="panel active">
            <div className="page-header">
              <div>
                <h1 className="page-title">Provas Disponíveis</h1>
                <p className="page-sub">Veja as provas abertas para <strong>{perfilLogado}</strong>, candidate-se e acompanhe sua reserva.</p>
              </div>
            </div>
            <div className="stats-candidato" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
              <div className="stat" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="stat-ico" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '24px' }}>📅</div>
                <div>
                  <div className="stat-lbl" style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>Provas Previstas</div>
                  <div className="stat-val" style={{ fontSize: '24px', fontWeight: '700', textAlign: 'center', color: '#0f172a' }}>{provasDisponiveis.length + provasEmReserva.length}</div>
                </div>
              </div>
              <div className="stat" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="stat-ico" style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', fontSize: '24px' }}>✅</div>
                <div>
                  <div className="stat-lbl" style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>Vagas Disponíveis</div>
                  <div className="stat-val" style={{ fontSize: '24px', fontWeight: '700', textAlign: 'center', color: '#0f172a' }}>{totalVagasLivres}</div>
                </div>
              </div>
              <div className="stat" style={{ padding: '20px', borderRadius: '12px', background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="stat-ico" style={{ background: '#fffbeb', padding: '12px', borderRadius: '8px', fontSize: '24px' }}>⏳</div>
                <div>
                  <div className="stat-lbl" style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>Lista de Reserva</div>
                  <div className="stat-val" style={{ fontSize: '24px', fontWeight: '700', textAlign: 'center',color: '#0f172a' }}>{provasEmReserva.length}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="sub-tabs" style={{ paddingTop: '10px', paddingLeft: '20px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '20px' }}>
                <button style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '14px', fontWeight: '600', color: activeSubTab === 'comVagas' ? '#2563eb' : '#64748b', borderBottom: activeSubTab === 'comVagas' ? '2px solid #2563eb' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setActiveSubTab('comVagas')}>⊕ Provas com Vagas</button>
                <button style={{ background: 'none', border: 'none', padding: '12px 0', fontSize: '14px', fontWeight: '600', color: activeSubTab === 'reserva' ? '#2563eb' : '#64748b', borderBottom: activeSubTab === 'reserva' ? '2px solid #2563eb' : '2px solid transparent', cursor: 'pointer' }} onClick={() => setActiveSubTab('reserva')}>👥 Vagas Preenchidas (Reserva)</button>
              </div>
              <div className="tbl-wrap" style={{ padding: '20px 0 0 0' }}>
                
                {/* ─── ABA: COM VAGAS ─── */}
                {activeSubTab === 'comVagas' && (
                  provasDisponiveis.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <div style={{ fontSize: '44px', marginBottom: '12px' }}>📭</div>
                      <h3 style={{ color: '#1e293b', marginBottom: '5px' }}>Nenhuma prova disponível para o seu perfil no momento</h3>
                      <p style={{ color: '#64748b', fontSize: '14px' }}>Aguardando o lançamento de novos eventos pela coordenação.</p>
                    </div>
                  ) : (
                    <>
                      {/* TABELA DESKTOP */}
                      <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>PROVA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>DATA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>OCUPAÇÃO ({perfilLogado.toUpperCase()})</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>VALOR/HORA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>STATUS</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>AÇÃO</th>
                        </tr></thead>
                        <tbody>
                          {provasDisponiveis.map(prova => (
                            <tr key={prova.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{prova.titulo}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{prova.detalhes}</div>
                              </td>
                              <td style={{ padding: '16px 24px', color: '#334155', fontSize: '14px' }}>{prova.data}</td>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '80px', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${prova.vagasTotais > 0 ? (prova.vagasPreenchidas / prova.vagasTotais) * 100 : 0}%`, height: '100%', background: '#3b82f6' }} />
                                  </div>
                                  <span style={{ fontSize: '13px' }}>{prova.vagasPreenchidas}/{prova.vagasTotais}</span>
                                </div>
                              </td>
                              <td style={{ padding: '16px 24px', color: '#334155', fontSize: '14px' }}>{prova.valor}</td>
                              <td style={{ padding: '16px 24px' }}>
                                <span style={{ border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' }}>{prova.status}</span>
                              </td>
                              <td style={{ padding: '16px 24px' }}>
                                <button onClick={() => setProvaSelecionada(prova)} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: '600', cursor: 'pointer' }}>Candidatar-se →</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* CARDS MOBILE */}
                      <div className="mobile-cards-container">
                        {provasDisponiveis.map(prova => {
                          const porcentagem = prova.vagasTotais > 0 ? (prova.vagasPreenchidas / prova.vagasTotais) * 100 : 0;
                          return (
                            <div className="prova-mobile-card" key={prova.id}>
                              <div className="prova-mobile-top">
                                <div className="prova-mobile-nome">{prova.titulo}
                                  <div className="prova-mobile-sub">{prova.detalhes}</div>
                                </div>
                                <span className="status-pill status-aberta">{prova.status}</span>
                              </div>
                              <div className="prova-mobile-data">📅 {prova.data} • {prova.valor}</div>
                              <div className="prova-mobile-bottom">
                                <div className="prova-mobile-progress">
                                  <div className="prova-mobile-bar">
                                    <div className="prova-mobile-bar-fill" style={{ width: `${porcentagem}%` }}></div>
                                  </div>
                                  <span className="prova-mobile-vagas">{prova.vagasPreenchidas}/{prova.vagasTotais}</span>
                                </div>
                                <button onClick={() => setProvaSelecionada(prova)} className="btn-candidatar-mobile">Candidatar-se →</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )
                )}

                {/* ─── ABA: RESERVA ─── */}
                {activeSubTab === 'reserva' && (
                  provasEmReserva.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <div style={{ fontSize: '44px', marginBottom: '12px' }}>⏳</div>
                      <h3 style={{ color: '#1e293b' }}>Nenhuma prova em lista de reserva para o seu perfil</h3>
                    </div>
                  ) : (
                    <>
                      {/* TABELA DESKTOP */}
                      <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>PROVA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>DATA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>OCUPAÇÃO</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>VALOR/HORA</th>
                          <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b' }}>AÇÃO</th>
                        </tr></thead>
                        <tbody>
                          {provasEmReserva.map(prova => (
                            <tr key={prova.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{prova.titulo}</div>
                                <div style={{ fontSize: '12px', color: '#64748b' }}>{prova.detalhes}</div>
                              </td>
                              <td style={{ padding: '16px 24px', color: '#334155', fontSize: '14px' }}>{prova.data}</td>
                              <td style={{ padding: '16px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ width: '80px', height: '6px', background: '#64748b', borderRadius: '4px' }} />
                                  <span style={{ fontSize: '13px' }}>{prova.vagasTotais}/{prova.vagasTotais}</span>
                                </div>
                              </td>
                              <td style={{ padding: '16px 24px', color: '#334155', fontSize: '14px' }}>{prova.valor}</td>
                              <td style={{ padding: '16px 24px' }}>
                                <button onClick={() => setProvaSelecionada(prova)} style={{ background: 'none', border: 'none', color: '#ca8a04', fontWeight: '600', cursor: 'pointer' }}>Entrar na Reserva →</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* CARDS MOBILE */}
                      <div className="mobile-cards-container">
                        {provasEmReserva.map(prova => (
                          <div className="prova-mobile-card" key={prova.id}>
                            <div className="prova-mobile-top">
                              <div className="prova-mobile-nome">{prova.titulo}
                                <div className="prova-mobile-sub">{prova.detalhes}</div>
                              </div>
                              <span className="status-pill status-reserva">{prova.status}</span>
                            </div>
                            <div className="prova-mobile-data">📅 {prova.data} • {prova.valor}</div>
                            <div className="prova-mobile-bottom">
                              <div className="prova-mobile-progress">
                                <div className="prova-mobile-bar" style={{ background: '#64748b' }}></div>
                                <span className="prova-mobile-vagas">{prova.vagasTotais}/{prova.vagasTotais}</span>
                              </div>
                              <button onClick={() => setProvaSelecionada(prova)} className="btn-candidatar-mobile" style={{ color: '#ca8a04' }}>Entrar na Reserva →</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                )}

              </div>
            </div>
          </div>
        )}

        {/* ── MINHAS CANDIDATURAS ────────────────────────────── */}
        {activeTab === 'candidaturas' && (
          <div className="panel active">
            {!candidaturaEmDetalhe ? (
              <>
                <div className="page-header">
                  <div>
                    <h1 className="page-title">Minhas Candidaturas</h1>
                    <p className="page-sub">Provas confirmadas e em reserva.</p>
                  </div>
                </div>
                <div className="card" style={{ padding: '24px' }}>
                  {minhasCandidaturas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <div style={{ fontSize: '44px', marginBottom: '12px' }}>📝</div>
                      <h3 style={{ color: '#475569', fontSize: '16px', fontWeight: '600' }}>Você ainda não possui candidaturas</h3>
                      <p style={{ color: '#64748b', fontSize: '14px' }}>Acesse <strong>"Provas Disponíveis"</strong> para se inscrever.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {minhasCandidaturas.map(cand => (
                        <div key={cand.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderLeft: '4px solid #10b981', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: '#0f172a', marginBottom: '8px' }}>{cand.titulo}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                              <span>📅 {cand.data}</span>
                              <span>{cand.serie}</span>
                              <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{cand.funcao}</span>
                              <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{cand.status}</span>
                              {cand.entrada && cand.entrada !== '--:--' && (
                                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                  🕐 Entrada: {cand.entrada}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <button onClick={() => setCandidaturaEmDetalhe(cand)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              🏠 Meu Dia de Prova
                            </button>
                            <button onClick={() => abrirModalCancelamento(cand)} style={{ background: 'transparent', color: '#ef4444', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              ❌ Cancelar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>
                <div style={{ marginBottom: '20px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button onClick={() => setCandidaturaEmDetalhe(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}>← Voltar</button>
                  <span style={{ color: '#cbd5e1' }}>/</span>
                  <span style={{ color: '#2563eb' }}>Meu Dia de Prova</span>
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '28px', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>{candidaturaEmDetalhe.titulo}</h2>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' }}>
                    <span>📅 {candidaturaEmDetalhe.data}</span>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>{candidaturaEmDetalhe.funcao}</span>
                  </div>
                </div>
                {candidaturaEmDetalhe.entrada && candidaturaEmDetalhe.entrada !== '--:--' && (
                  <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#15803d', marginBottom: '8px' }}>🕐 Registro de Ponto</h3>
                    <div style={{ display: 'flex', gap: '24px', fontSize: '14px' }}>
                      <span>Entrada: <strong style={{ color: '#16a34a' }}>{candidaturaEmDetalhe.entrada}</strong></span>
                      <span>Saída: <strong style={{ color: candidaturaEmDetalhe.saida !== '--:--' ? '#ef4444' : '#94a3b8' }}>{candidaturaEmDetalhe.saida}</strong></span>
                    </div>
                  </div>
                )}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>🏠 Sala Designada</h3>
                  {candidaturaEmDetalhe.sala ? (
                    <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontWeight: '600' }}>
                      {candidaturaEmDetalhe.sala}
                    </div>
                  ) : (
                    <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '13.5px' }}>⏳ Aguardando designação pela coordenação…</div>
                  )}
                </div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '12px' }}>📄 Observações da Coordenação</h3>
                  {candidaturaEmDetalhe.observacoes ? (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                      {candidaturaEmDetalhe.observacoes}
                    </div>
                  ) : (
                    <div style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: '13.5px' }}>Nenhuma observação registrada.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PROVAS APLICADAS ───────────────────────────────── */}
        {activeTab === 'aplicadas' && (
          <div className="panel active">
            <div className="page-header">
              <h1 className="page-title">Provas Aplicadas</h1>
              <p className="page-sub">Histórico com horários e valores calculados automaticamente.</p>
            </div>
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {provasAplicadas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: '44px', marginBottom: '12px' }}>🕒</div>
                  <h3 style={{ color: '#475569', fontSize: '16px', fontWeight: '600' }}>Nenhum histórico disponível</h3>
                  <p style={{ color: '#64748b', fontSize: '14px' }}>Provas aparecem aqui após você bater o ponto de saída.</p>
                </div>
              ) : (
                <>
                  {/* TABELA DESKTOP */}
                  <table className="desktop-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>PROVA</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>DATA</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>ENTRADA</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>SAÍDA</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>HORAS</th>
                        <th style={{ textAlign: 'center', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>STATUS / FUNÇÃO</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>VALOR</th>
                        <th style={{ textAlign: 'center', padding: '16px 24px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provasAplicadas.map(prova => (
                        <tr key={prova.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{prova.titulo}</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>{prova.serie}</div>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#334155', fontSize: '14px' }}>{prova.data}</td>
                          <td style={{ padding: '16px 24px', color: '#16a34a', fontSize: '14px', fontWeight: '600' }}>{prova.entrada}</td>
                          <td style={{ padding: '16px 24px', color: '#ef4444', fontSize: '14px', fontWeight: '600' }}>{prova.saida}</td>
                          <td style={{ padding: '16px 24px', color: '#0f172a', fontSize: '14px', fontWeight: '700' }}>
                            {prova.horasTrabalhadas > 0 ? `${prova.horasTrabalhadas.toFixed(1)}h` : '--'}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <span style={{ display: 'block', background: prova.funcao === 'Ledor' ? '#eff6ff' : '#f3e8ff', color: prova.funcao === 'Ledor' ? '#2563eb' : '#9333ea', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                              {prova.funcao}
                            </span>
                            <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: statusAplicadaInfo(prova.status).cor }}>
                              {statusAplicadaInfo(prova.status).texto}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', color: '#16a34a', fontSize: '14px', fontWeight: '700' }}>
                            {prova.horasTrabalhadas > 0 ? formatarMoeda(prova.horasTrabalhadas * valorFixoHora) : '--'}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <button onClick={() => abrirModalRelato(prova)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Relatar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* CARDS MOBILE */}
                  <div className="mobile-cards-container">
                    {provasAplicadas.map(prova => (
                      <div className="prova-mobile-card" key={prova.id} style={{ marginBottom: '16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
                        <div className="prova-mobile-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div className="prova-mobile-nome">
                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '15px' }}>{prova.titulo}</div>
                            <div className="prova-mobile-sub" style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{prova.serie}</div>
                          </div>
                          <span style={{ background: prova.funcao === 'Ledor' ? '#eff6ff' : '#f3e8ff', color: prova.funcao === 'Ledor' ? '#2563eb' : '#9333ea', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                            {prova.funcao}
                          </span>
                        </div>
                        <div className="prova-mobile-data" style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>
                          📅 {prova.data}
                          <strong style={{ color: statusAplicadaInfo(prova.status).cor, display: 'block', marginTop: '4px' }}>Status: {statusAplicadaInfo(prova.status).texto}</strong>
                        </div>
                        
                        <div className="prova-mobile-bottom" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', background: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px' }}>
                            <span>Entrada: <strong style={{ color: '#16a34a' }}>{prova.entrada}</strong></span>
                            <span>Saída: <strong style={{ color: '#ef4444' }}>{prova.saida}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                            <span style={{ fontSize: '13px', color: '#475569' }}>
                              Duração: <strong style={{ color: '#0f172a' }}>{prova.horasTrabalhadas > 0 ? `${prova.horasTrabalhadas.toFixed(1)}h` : '--'}</strong>
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: '#16a34a' }}>
                              {prova.horasTrabalhadas > 0 ? formatarMoeda(prova.horasTrabalhadas * valorFixoHora) : '--'}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                           <button onClick={() => abrirModalRelato(prova)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}>Relatar Ocorrência</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* RODAPÉ DE TOTAIS */}
                  <div style={{ background: '#f8fafc', padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', gap: '20px', flexWrap: 'wrap', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '14px', color: '#475569' }}>Total de horas: <strong style={{ color: '#0f172a' }}>{totalHorasHistorico.toFixed(1)}h</strong></div>
                    <div style={{ fontSize: '14px', color: '#475569' }}>Total a receber: <strong style={{ color: '#16a34a', fontSize: '16px' }}>{formatarMoeda(totalReceberHistorico)}</strong></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── CÁLCULO DE GANHOS ──────────────────────────────── */}
        {activeTab === 'ganhos' && (
          <div className="panel active">
            <div className="page-header">
              <h1 className="page-title">Cálculo de Ganhos</h1>
              <p className="page-sub">Acompanhe seus recebimentos e projeções.</p>
            </div>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
              <div className="card" style={{ flex: 1, padding: '32px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Total a Receber</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#16a34a' }}>{formatarMoeda(totalReceberHistorico)}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>{provasAplicadas.length} prova(s) concluída(s)</div>
              </div>
              <div className="card" style={{ flex: 1, padding: '32px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Próximo Pagamento</div>
                <div style={{ fontSize: '36px', fontWeight: '700', color: '#0f172a' }}>{formatarMoeda(totalReceberHistorico)}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>Previsto para {calcularProximoPagamento()}</div>
              </div>
            </div>
            {provasAplicadas.length > 0 && (
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                  Detalhamento por Prova
                </div>
                {provasAplicadas.map((prova, index) => (
                  <div key={prova.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px', borderBottom: index < provasAplicadas.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '15px', color: '#334155', fontWeight: '500' }}>{prova.titulo}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {prova.horasTrabalhadas > 0 ? prova.horasTrabalhadas.toFixed(1) : '0.0'}h × R$ {valorFixoHora} · {prova.data}
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                      {formatarMoeda(prova.horasTrabalhadas * valorFixoHora)}
                    </div>
                  </div>
                ))}
                <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: '#0f172a' }}>Total</strong>
                  <strong style={{ color: '#16a34a', fontSize: '18px' }}>{formatarMoeda(totalReceberHistorico)}</strong>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BATER PONTO ────────────────────────────────────── */}
        {activeTab === 'ponto' && (
          <div className="panel active">
            <div className="page-header">
              <h1 className="page-title">Bater Ponto</h1>
              <p className="page-sub">Registre sua entrada e saída no dia da prova.</p>
            </div>

            {/* Aviso se não tem prova hoje */}
            {!idProvaAtiva && minhasCandidaturas.length > 0 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde047', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
                ⚠️ Você não tem prova agendada para hoje.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px', gap: '24px' }}>
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '40px 60px', textAlign: 'center', width: '100%', maxWidth: '420px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                {statusPonto !== 'concluido' ? (
                  <>
                    <div style={{ fontSize: '48px', fontWeight: '800', color: '#0f172a', letterSpacing: '-1px', marginBottom: '12px' }}>
                      {horaAtual.toLocaleTimeString('pt-BR')}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '32px', fontWeight: '500' }}>
                      {formatarData(horaAtual)}
                    </div>
                    <button onClick={handleRegistrarPonto} disabled={scaneando || !idProvaAtiva}
                      style={{ width: '100%', background: (scaneando || !idProvaAtiva) ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', padding: '16px', borderRadius: '8px', fontSize: '15px', fontWeight: '700', textTransform: 'uppercase', cursor: (scaneando || !idProvaAtiva) ? 'default' : 'pointer', letterSpacing: '0.5px' }}>
                      {statusPonto === 'entrada' ? 'REGISTRAR PONTO' : 'REGISTRAR SAÍDA'}
                    </button>
                    {statusPonto === 'saida' && !scaneando && (
                      <p style={{ marginTop: '16px', fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>
                        Obrigatório escanear o QR Code da coordenação.
                      </p>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '20px 0' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                    <h3 style={{ color: '#16a34a', fontSize: '20px', marginBottom: '8px' }}>Turno Concluído!</h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Sua saída foi validada. Veja em "Provas Aplicadas".</p>
                  </div>
                )}
              </div>

              <div style={{ width: '100%', maxWidth: '800px' }}>
                {scaneando ? (
                  <div
                    onClick={(e) => e.stopPropagation()} 
                    style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', textAlign: 'center' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Escanear QR Code</h3>
                      <button onClick={() => setScaneando(false)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                        [ X ] Cancelar
                      </button>
                    </div>

                    {/* CAIXA DA CÂMERA BLINDADA */}
                    <div style={{ maxWidth: '300px', margin: '0 auto', overflow: 'hidden', borderRadius: '8px', border: '2px solid #3b82f6' }}>
                      <Scanner
                        onScan={(result) => {
                          if (result && result.length > 0) {
                            const textoLido = result[0].rawValue || result[0].text || "";
                            if (textoLido) confirmarScaneamentoQRCode(textoLido);
                          }
                        }}
                        onError={(error) => console.log("Câmera aguardando/Erro:", error?.message)}
                      />
                    </div>
                    
                    <p style={{ fontSize: '13px', color: '#64748b', marginTop: '16px' }}>
                      Aponte a câmera para o QR Code gerado pelo coordenador.
                    </p>
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>Registros de Hoje</h3>
                    {registrosDeHoje.length === 0 ? (
                      <div style={{ border: '1px dashed #e5e7eb', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
                        Nenhum ponto registrado hoje.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: '600' }}>TIPO</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: '600' }}>HORÁRIO</th>
                            <th style={{ textAlign: 'left', padding: '12px', color: '#64748b', fontWeight: '600' }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrosDeHoje.map((reg, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px', textTransform: 'capitalize', fontWeight: '600', color: reg.tipo === 'entrada' ? '#2563eb' : '#f59e0b' }}>{reg.tipo}</td>
                              <td style={{ padding: '12px', color: '#0f172a', fontWeight: '500' }}>{reg.hora}</td>
                              <td style={{ padding: '12px', color: '#64748b' }}>{reg.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MEU PERFIL ─────────────────────────────────────── */}
        {activeTab === 'perfil' && (
          <div className="panel active">
            <div className="page-header">
              <h1 className="page-title">Meu Perfil</h1>
              <p className="page-sub">Atualize seus dados e foto de perfil.</p>
            </div>
            <div className="card" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                <div style={{ width: '80px', height: '80px', fontSize: '28px', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontWeight: '700' }}>{iniciais}</div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '18px', color: '#111827', marginBottom: '4px' }}>{perfilFormData.nome}</div>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>{perfilLogado} · {perfilFormData.email}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {[
                  { label: 'NOME COMPLETO', name: 'nome',     type: 'text'  },
                  { label: 'CPF',           name: 'cpf',      type: 'text'  },
                  { label: 'E-MAIL',        name: 'email',    type: 'email' },
                  { label: 'CELULAR',       name: 'celular',  type: 'text'  },
                ].map(f => (
                  <div key={f.name}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '8px' }}>{f.label}</label>
                    <input type={f.type} name={f.name} value={perfilFormData[f.name]} onChange={handlePerfilChange}
                      style={{ border: '1px solid #d1d5db', padding: '12px', borderRadius: '8px', width: '100%', outline: 'none' }} />
                  </div>
                ))}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '8px' }}>SENHA ATUAL</label>
                  <input type="password" name="senhaAtual" placeholder="Necessária apenas para trocar a senha" value={perfilFormData.senhaAtual} onChange={handlePerfilChange}
                    style={{ border: '1px solid #d1d5db', padding: '12px', borderRadius: '8px', width: '100%', outline: 'none' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '8px' }}>NOVA SENHA</label>
                  <input type="password" name="novaSenha" placeholder="Deixe em branco para não alterar" value={perfilFormData.novaSenha} onChange={handlePerfilChange}
                    style={{ border: '1px solid #d1d5db', padding: '12px', borderRadius: '8px', width: '100%', outline: 'none' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#6b7280', display: 'block', marginBottom: '8px' }}>CONFIRMAR SENHA</label>
                  <input type="password" name="confirmarSenha" placeholder="Repita a nova senha" value={perfilFormData.confirmarSenha} onChange={handlePerfilChange}
                    style={{ border: '1px solid #d1d5db', padding: '12px', borderRadius: '8px', width: '100%', outline: 'none' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={handleSalvarPerfil} disabled={salvandoPerfil} style={{ padding: '12px 24px', border: 'none', background: '#2563eb', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: salvandoPerfil ? 'default' : 'pointer', opacity: salvandoPerfil ? 0.7 : 1 }}>
                  {salvandoPerfil ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL — CONFIRMAR CANDIDATURA */}
      {provaSelecionada && (
        <div className="overlay open" onClick={() => setProvaSelecionada(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ fontSize: '20px' }}>Confirmar Candidatura</h2>
            <p className="modal-sub">{provaSelecionada.titulo} · {provaSelecionada.data}</p>
            <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', marginTop: '16px', border: '1px solid #bfdbfe' }}>
              <strong style={{ display: 'block', color: '#1e40af', marginBottom: '4px' }}>Função: {perfilLogado} · {provaSelecionada.valor}</strong>
              <span style={{ color: '#1e3a8a', fontSize: '13px' }}>Ao confirmar, você constará na lista desta prova.</span>
            </div>
            <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn-outline" onClick={() => setProvaSelecionada(null)}>Cancelar</button>
              <button className="btn-primary" onClick={confirmarCandidatura}>Confirmar →</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — CANCELAMENTO */}
      {candidaturaParaCancelar && (
        <div className="overlay open" onClick={() => setCandidaturaParaCancelar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '500px', padding: '32px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#ef4444', marginBottom: '16px' }}>Cancelar Participação</h2>
            <div style={{ border: '1px solid #f97316', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
              <strong style={{ display: 'block', color: '#c2410c', fontSize: '13px', marginBottom: '4px' }}>Atenção antes de cancelar.</strong>
              <span style={{ color: '#4b5563', fontSize: '13px' }}>Cancelamentos com menos de <strong style={{ color: '#c2410c' }}>48 horas</strong> podem afetar sua avaliação.</span>
            </div>
            <strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px', color: '#1f2937' }}>Qual o motivo do cancelamento?</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {['Problema de saúde', 'Emergência familiar', 'Conflito de agenda', 'Problema de transporte', 'Outro motivo'].map(motivo => (
                <label key={motivo} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: `1px solid ${motivoCancelamento === motivo ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '8px', cursor: 'pointer', background: motivoCancelamento === motivo ? '#fef2f2' : '#fff' }}>
                  <input type="radio" name="motivo" value={motivo} checked={motivoCancelamento === motivo} onChange={e => setMotivoCancelamento(e.target.value)} style={{ accentColor: '#ef4444' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>{motivo}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setCandidaturaParaCancelar(null)} style={{ padding: '10px 16px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Manter inscrição</button>
              <button onClick={efetivarCancelamento} style={{ padding: '10px 16px', border: 'none', background: '#fee2e2', borderRadius: '6px', fontSize: '14px', fontWeight: '600', color: '#b91c1c', cursor: 'pointer' }}>Confirmar Cancelamento</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL — RELATAR */}
      {provaParaRelatar && (
        <div className="overlay open" onClick={fecharModalRelato}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '500px', padding: '32px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>Relatar Ocorrência</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>O relato será enviado à coordenação.</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Tipo</label>
              <select value={relatoForm.tipo} onChange={e => setRelatoForm({ ...relatoForm, tipo: e.target.value })}
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', color: '#334155', fontSize: '14px', backgroundColor: '#fff' }}>
                <option value="">Selecione</option>
                <option>Atraso de Candidato</option>
                <option>Falta de Material na Sala</option>
                <option>Problema de Infraestrutura</option>
                <option>Suspeita de Fraude</option>
                <option>Emergência Médica</option>
                <option>Outro</option>
              </select>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Descrição</label>
              <textarea value={relatoForm.descricao} onChange={e => setRelatoForm({ ...relatoForm, descricao: e.target.value })}
                placeholder="Descreva o que aconteceu..." rows="5"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', resize: 'none', color: '#334155', fontSize: '14px', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={fecharModalRelato} style={{ padding: '12px 24px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={enviarRelato} style={{ padding: '12px 24px', border: 'none', background: '#2563eb', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>Enviar Relato</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};