import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Input } from '../components/Input.jsx';
import { authService } from '../services/api.js';
import '../styles/Login.css';

export const RedefinirSenha = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [statusToken, setStatusToken] = useState('verificando'); // verificando | valido | invalido
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resultado = await authService.validarTokenReset(token);
        if (ativo) setStatusToken(resultado.valido ? 'valido' : 'invalido');
      } catch {
        if (ativo) setStatusToken('invalido');
      }
    })();
    return () => { ativo = false; };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');

    if (novaSenha !== confirmarNovaSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setSalvando(true);
    try {
      await authService.redefinirSenha(token, novaSenha, confirmarNovaSenha);
      setSucesso(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível redefinir a senha. O link pode ter expirado.');
      setStatusToken('invalido');
    } finally {
      setSalvando(false);
    }
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

      <div className="login-right">
        <div className="form-wrap">
          <div className="form-hero">
            <div className="his-monogram">
              H<span>.</span>I<span>.</span>S
            </div>
            <p className="form-subtitle">Definir nova senha</p>
          </div>

          {statusToken === 'verificando' && (
            <p style={{ color: '#64748b', fontSize: '14px' }}>Verificando o link...</p>
          )}

          {statusToken === 'invalido' && (
            <div>
              <div className="error-box">
                <span>⚠️</span> Este link é inválido ou já expirou.
              </div>
              <Link to="/esqueci-senha" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', marginTop: '12px' }}>
                Pedir um novo link
              </Link>
            </div>
          )}

          {statusToken === 'valido' && !sucesso && (
            <form onSubmit={handleSubmit}>
              {erro && (
                <div className="error-box">
                  <span>⚠️</span> {erro}
                </div>
              )}

              <Input
                label="Nova senha"
                type="password"
                placeholder="••••••••"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />

              <Input
                label="Confirmar nova senha"
                type="password"
                placeholder="••••••••"
                value={confirmarNovaSenha}
                onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                required
              />

              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          )}

          {sucesso && (
            <p style={{ color: '#16a34a', fontSize: '14px', lineHeight: '1.6' }}>
              ✅ Senha redefinida com sucesso! Redirecionando para o login...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
