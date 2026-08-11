import { useState } from 'react';
import { useAuth } from '../context/Authcontext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsyncAction } from '../hooks/useAsyncAction.js';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from "../components/Input.jsx";
import '../styles/Login.css';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();
  const { run, isLoading } = useAsyncAction();
  const navigate = useNavigate();

  const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

 const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    const resultado = await login(email, senha);

    if (!resultado || !resultado.success) {
      setErro(resultado?.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } else {
      // 🚀 A SOLUÇÃO FINAL: Desempacotar a Lista do C#
      try {
        // Apanha a string que o AuthContext acabou de guardar no navegador
        const userString = localStorage.getItem('user'); 
        
        if (userString) {
          // Transforma o texto num objeto Javascript
          const userDados = JSON.parse(userString);
          
          // O SEGREDO: Se for uma lista [ { ... } ], apanhamos a posição [0]
          const dadosDoUsuario = Array.isArray(userDados) ? userDados[0] : userDados;
          
          if (dadosDoUsuario && (dadosDoUsuario.idUsuario || dadosDoUsuario.id)) {
            const perfil = dadosDoUsuario.perfil || 'Candidato'; // Fallback para "Candidato" se não tiver perfil
            // Guarda o ID solto e de forma fácil para a Dashboard encontrar
            localStorage.setItem('idUsuario', dadosDoUsuario.idUsuario || dadosDoUsuario.id);
            localStorage.setItem('nomeUsuario', dadosDoUsuario.nomeCompleto || dadosDoUsuario.nome || 'Usuário');
            localStorage.setItem('perfilUsuario', dadosDoUsuario.perfil || 'Candidato');
            
            // Sucesso! Vai para a Dashboard
            if (perfil.toLowerCase() === 'admin' || perfil.toLowerCase() === 'coordenacao') {
            navigate('/dashboard-coordenacao'); 
          } else {
          navigate('/dashboard-candidato'); 
         }
         return;
         }
        }
      } catch (err) {
        console.error("Erro ao desempacotar dados:", err);
      }
      
      showToast("Erro crítico: O ID do usuário não foi encontrado na resposta do servidor.", 'error');
    }

    setCarregando(false);
  };

  return (
    <div className="login-layout"> 
      <div className="login-left">
        <div className="login-left-img" />
        <div className="login-left-content">
          <div className="logo-wrap">
            <div className="logo-left-img">
              <img src="./images/Logo_HEAVELY.png" alt="" />
            </div>
          </div>

          <div className="login-left-headline">
            <h1>
              Sistema de
              <em>Ledores</em>
            </h1>
            <p>
              Plataforma de gestão de ledores e fiscais para aplicação de provas da
              Heavenly International School.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT — formulário */}
      <div className="login-right">
        <div className="form-wrap">
          <div className="form-hero">
            <div className="his-monogram">
              H<span>.</span>I<span>.</span>S
            </div>
            <p className="form-subtitle">Acesse sua conta</p>
          </div>

          {erro && (
            <div className="error-box">
              <span>⚠️</span> {erro}
            </div>
          )}

          {/* TESTE TEMPORÁRIO DO useAsyncAction — remover depois de validar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', border: '1px dashed #cbd5e1', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                disabled={isLoading('acao-unica')}
                onClick={() => run(async () => { await esperar(2000); showToast('Ação única concluída!', 'success'); }, 'acao-unica')}
              >
                {isLoading('acao-unica') ? 'Processando...' : 'Testar ação única (2s)'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>clique 2x rápido pra testar a trava anti-duplo-clique</span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {['linha-1', 'linha-2', 'linha-3'].map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={isLoading(key)}
                  onClick={() => run(async () => { await esperar(2000); showToast(`${key} concluída!`, 'success'); }, key)}
                >
                  {isLoading(key) ? 'Gerando...' : key}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>clique em uma linha e, enquanto ela carrega, clique nas outras — só a clicada deve desabilitar</span>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label="E-mail"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />

            <div style={{ textAlign: 'right', marginBottom: '12px' }}>
              <Link to="/esqueci-senha" style={{ fontSize: '13px', color: '#64748b' }}>
                Esqueci minha senha
              </Link>
            </div>

            <button type="submit" className="btn btn-primary" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>

            <div className="divider">ou</div>

            <Link to="/cadastro" className="btn btn-outline">
              Criar conta
            </Link>
          </form>

          <div className="form-footer">
            <p className="we-are">
              WE ARE <span>HIS</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};