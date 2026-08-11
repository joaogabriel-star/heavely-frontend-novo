// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { useNavigate } from 'react-router-dom';

// Cria o contexto
const AuthContext = createContext({});

// Hook customizado para usar o contexto facilmente
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
};

// Provider — envolve toda a aplicação
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Ao carregar a página, verifica se tem dados salvos para manter a sessão ativa
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userSalvo = localStorage.getItem('user');

    if (token && userSalvo) {
      try {
        setUser(JSON.parse(userSalvo));
      } catch (e) {
        console.error("Erro ao ler usuário do localStorage", e);
      }
    }
    setLoading(false);
  }, []);

  // Função de login
  const login = async (email, senha) => {
    try {
      // 1. Faz a chamada ao serviço de autenticação
      const response = await authService.login(email, senha);
      
      // 2. Extrai os dados (ajusta se vier de um objeto 'data' do Axios ou direto)
      const payload = response.data || response;

      // Mapeia os campos exatamente como o seu C# envia
      const token = payload.token;
      const nome = payload.nomeCompleto;
      const emailLogado = payload.email;
      const perfil = payload.perfil;

      // 3. Salva no localStorage para que o nome e as iniciais apareçam nas telas
      if (token) localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(payload));
      if (nome) localStorage.setItem('nomeUsuario', nome); 
      if (emailLogado) localStorage.setItem('emailUsuario', emailLogado);

      // 4. Atualiza o estado global do usuário
      setUser(payload);

      // 5. Redireciona com base no perfil retornado pelo banco
      if (perfil === 'Admin' || perfil === 'Coordenacao' || perfil === 'Coordenador') {
        navigate('/dashboard-coordenacao'); 
      } else {
        navigate('/dashboard-candidato');
      }

      return { success: true };
    } catch (error) {
      console.error('Erro no login:', error);
      return {
        success: false,
        message: error.response?.data?.mensagem || 'Erro ao fazer login',
      };
    }
  };

  // Função de logout - Limpa toda a memória
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('nomeUsuario');
    localStorage.removeItem('emailUsuario');
    localStorage.removeItem('idUsuario');
    localStorage.removeItem('perfilUsuario');
    localStorage.removeItem('avatarUsuario');
    setUser(null);
    navigate('/login');
  };

  // Enquanto verifica o localStorage, mostra uma tela de carregamento
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};