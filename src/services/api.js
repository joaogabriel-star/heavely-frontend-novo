import axios from 'axios';

// 1. Configuração do Axios
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5074/api'
});

// Interceptor para o Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Funções de autenticação
export const authService = {
  login: async (email, senha) => {
    const response = await api.post('/auth/login', { email, senha });
    return response.data;
  },
  cadastrar: async (dados) => {
    const response = await api.post('/auth/cadastro', dados);
    return response.data;
  },
  cadastrarAdmin: async (dados) => {
    const response = await api.post('/auth/cadastro-admin', dados);
    return response.data;
  },
};


export const eventoService = {
  listarEventos: async () => {
    const { data } = await api.get('/eventos');
    return data;
  },

  criarEvento: async (dto) => {
    const { data } = await api.post('/eventos', dto);
    return data;
  },

  candidatar: async (idEvento) => {
    const token = localStorage.getItem('token');
    const response = await api.post(`/eventos/${idEvento}/candidatar`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  }, 

  listarMinhasCandidaturas: async () => {
    const token = localStorage.getItem('token');
    // Busca as candidaturas do usuário (vai dar 404 até fazermos no C#)
    const response = await api.get('/eventos/minhas-candidaturas', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  listarHistorico: async () => {
    const token = localStorage.getItem('token');
    const response = await api.get('/ponto/historico', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  inscreverEmEvento: async (idEvento, dadosDaInscricao) => {
    const response = await api.post(`/alocacoes/${idEvento}/inscrever`, dadosDaInscricao);
    return response.data;
  },

};


export const pontoService = {

  registrarEntrada: async (idEvento) => {
    const { data } = await api.post('/ponto/entrada', { idEvento, tipo: 'entrada' });
    return data;
  },

  registrarSaida: async (idEvento, tokenQRCode) => {
    const { data } = await api.post('/ponto/saida', {
      idEvento,
      tipo: 'saida',
      tokenQRCode
    });
    return data;
  },

  obterQRCode: async (idEvento) => {
    const { data } = await api.get(`/ponto/qrcode/${idEvento}`);
    return data;
  },
};

export const usuarioService = {
  // Puxa a lista de quem está aguardando aprovação
  listarPendentes: async () => {
    // Atenção: Ajuste esta rota para a rota correta do seu C#
    const response = await api.get('/usuarios/pendentes'); 
    return response.data;
  },
  
  // Aprova o usuário
  aprovarUsuario: async (id) => {
    const response = await api.put(`/usuarios/${id}/aprovar`);
    return response.data;
  },

  // Recusa/Exclui o usuário
  recusarUsuario: async (id) => {
    const response = await api.delete(`/usuarios/${id}/recusar`);
    return response.data;
  },
  listarAtivos: async () => {
    const response = await api.get('/usuarios/ativos');
    return response.data;
  },
  
  alterarPerfil: async (id, perfil) => {
    const response = await api.put(`/usuarios/${id}/perfil?perfil=${perfil}`);
    return response.data;
  }
};

export const alocacaoService = {
    buscarMinhasInscricoes: () => api.get('/alocacoes/minhas')
  }

export default api;