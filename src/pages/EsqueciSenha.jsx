import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../components/Input.jsx';
import { authService } from '../services/api.js';
import '../styles/Login.css';

export const EsqueciSenha = () => {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setEnviando(true);

    try {
      await authService.esqueciSenha(email);
      // A API sempre responde com a mesma mensagem genérica, exista ou não o
      // email — não há como (nem deve haver) diferenciar isso aqui na tela.
      setEnviado(true);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível processar o pedido agora. Tente novamente.');
    } finally {
      setEnviando(false);
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
            <p className="form-subtitle">Esqueci minha senha</p>
          </div>

          {erro && (
            <div className="error-box">
              <span>⚠️</span> {erro}
            </div>
          )}

          {enviado ? (
            <div>
              <p style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' }}>
                Se o email <strong>{email}</strong> existir em nosso sistema, enviamos um link de recuperação —
                confira sua caixa de entrada (e o spam). O link expira em 1 hora.
              </p>
              <Link to="/login" className="btn btn-outline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
                Informe o email da sua conta. Enviaremos um link pra você definir uma nova senha.
              </p>

              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <button type="submit" className="btn btn-primary" disabled={enviando}>
                {enviando ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <div className="divider">ou</div>

              <Link to="/login" className="btn btn-outline">
                Voltar para o login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
