import React, { useState, useEffect } from 'react';

import { Link } from 'react-router-dom';

import '../styles/Cadastro.css';

import { authService } from '../services/api';





export const Cadastro = () => {

  // Estado para controlar o tipo de conta selecionado

  const [tipoConta, setTipoConta] = useState('');

  const [erro, setErro] = useState('');

  const [carregando, setCarregando] = useState(false);

  const [arquivoNadaConsta, setArquivoNadaConsta] = useState(null);

  const [arquivoDiploma, setArquivoDiploma] = useState(null);

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const acordarServidor = async () => {
      try {
        console.log("Pingando servidor...");
        await api.get('/usuarios/health'); // Ou a rota exata que você criou
        console.log("Servidor acordado!");
      } catch (err) {
        console.log("Servidor ainda a acordar...");
      }
    };
    
    acordarServidor();
  }, []);

 

  // Estado unificado para todos os campos do formulário

  const [formData, setFormData] = useState({

    nomeCompleto: '',

    cpf: '',

    dataNascimento: '',

    celular: '',

    email: '',

    endereco: '',

    escolaridadeNivel: '',

    escolaridadeStatus: '',

    cursoFormacao: '',

    nivelIngles: 'Nenhum',

    nivelEspanhol: 'Nenhum',

    materias: [],

    experienciaProfissional: '',

    senha: '',

    confirmarSenha: '',

    aceiteTermos: false,

    // Arquivos (armazenaremos os objetos File)

    certificadoLedor: null,

    nadaConsta: null,

  });



  // Listas de opções para os botões (chips)

  const niveisIdioma = ['Nenhum', 'Básico', 'Intermediário', 'Avançado'];

  const materiasList = [

    'Matemática', 'Português', 'Física', 'Química', 'Biologia',

    'História', 'Geografia', 'Filosofia', 'Sociologia', 'Literatura',

    'Inglês', 'Espanhol', 'Arte', 'Ed. Física', 'Redação'

  ];



  // Função para lidar com a digitação nos inputs normais

  const handleChange = (e) => {

    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({

      ...prev,

      [name]: type === 'checkbox' ? checked : value,

    }));

  };



  // Função para selecionar/deselecionar matérias

  const toggleMateria = (materia) => {

    setFormData((prev) => {

      const jaSelecionada = prev.materias.includes(materia);

      return {

        ...prev,

        materias: jaSelecionada

          ? prev.materias.filter((m) => m !== materia)

          : [...prev.materias, materia],

      };

    });

  };



  // Função disparada ao clicar em "Criar minha conta"

const handleSubmit = async (e) => {

    e.preventDefault();

   



    // 1. Validação simples

    if (formData.senha !== formData.confirmarSenha) {

      setErro('As senhas não coincidem.');

      return;

    }



    if (!tipoConta) {

      setErro('Por favor, selecione um tipo de conta.');

      return;

    }



    setCarregando(true);



    try {

      // 2. O Desvio: Envia para a porta certa baseado no "tipoConta"

      if (tipoConta === 'Coordenadores' || tipoConta === 'Coordenador') {

       

        await authService.cadastrarAdmin({

          NomeCompleto: formData.nomeCompleto,

          Cpf: formData.cpf,

          Celular: formData.celular,

          Email: formData.email,

          DataNascimento: formData.dataNascimento,

          EmailInstitucional: formData.email, // Usando o email pessoal como institucional por enquanto

          Senha: formData.senha,

          ConfirmarSenha: formData.confirmarSenha,

          CargoInstituicao: "Coordenador Geral"

        });



      } else {

       

        await authService.cadastrar({

          NomeCompleto: formData.nomeCompleto,

          Cpf: formData.cpf,

          DataNascimento: formData.dataNascimento,

          Celular: formData.celular,

          Email: formData.email,

          Endereco: formData.endereco || "Não informado",

          EscolaridadeNivel: formData.escolaridadeNivel || "Não informado",

          EscolaridadeStatus: formData.escolaridadeStatus || "Não informado",

          InstituicaoEnsino: formData.instituicaoEnsino || "Não informado",

          NivelIngles: formData.nivelIngles || "Básico",

          NivelEspanhol: formData.nivelEspanhol || "Básico",

          ExperienciaProfissional: formData.experienciaProfissional || "Nenhuma",

          Materias: formData.materias || "Geral",

          Senha: formData.senha,

          ConfirmarSenha: formData.confirmarSenha,

          PossuiCertificadoLedor: tipoConta === 'Ledor'

        });



      }



      // 3. Sucesso!

      alert('Cadastro realizado com sucesso!');

      navigate('/login'); // Redireciona para a tela de login



    } catch (error) {

      console.error('Erro no cadastro:', error);

      // Pega a mensagem de erro que vem do C# (ex: "CPF já cadastrado")

      setErro(error.response?.data?.mensagem || error.message || 'Erro ao realizar o cadastro. Tente novamente.');

    } finally {

      setCarregando(false);

    }

  };



  const handleCadastro = async (e) => {

  e.preventDefault();

 

  // DETETIVE 1: Vemos se o botão pelo menos disparou a função

  console.log("1. Botão clicado! Iniciando validação...");



  // (Suas validações de senhas, campos, etc. vêm aqui...)



  // Avisa a tela para mostrar o "Carregando..."

  setSalvando(true);



  try {

    const formData = new FormData();

    // ... os seus formData.append() aqui ...



    console.log("2. Enviando requisição para a API...");

   

    await api.post('/usuarios/cadastro', formData);

   

    console.log("3. Sucesso! A API respondeu.");

    alert('Cadastro realizado com sucesso!');

   

    // Redireciona para o login ou limpa a tela...

   

  } catch (error) {

    console.error("ERRO NO CADASTRO:", error);

    alert('Erro ao criar conta. Verifique o console.');

  } finally {

    // Tira o carregando da tela, quer tenha dado certo ou erro

    setSalvando(false);

  }

};



  return (

    <div className="cadastro-container">

      {/* Cabeçalho superior */}

      <header className="cadastro-header">

        <div className="logo-placeholder"></div>

        <Link to="/login" className="btn-voltar">← Voltar ao login</Link>

      </header>



      <main className="cadastro-content">

        <div className="cadastro-titles">

          <span className="badge-novo">NOVO CADASTRO</span>

          <h1>Criar sua conta</h1>

          <p>Preencha os dados abaixo para se cadastrar como ledor ou fiscal no sistema da Heavenly International School.</p>

        </div>



        {/* Stepper Visual */}

        <div className="stepper">

          <div className="step active"><span className="step-num">1</span> Tipo de conta</div>

          <div className="step-line"></div>

          <div className="step"><span className="step-num">2</span> Dados pessoais</div>

          <div className="step-line"></div>

          <div className="step"><span className="step-num">3</span> Formação</div>

          <div className="step-line"></div>

          <div className="step"><span className="step-num">4</span> Acesso</div>

        </div>



        <form onSubmit={handleSubmit} className="cadastro-form">

         

          {/* SEÇÃO 1: TIPO DE CONTA */}

          <section className="form-section">

            <h2 className="section-title"><span className="section-num">0</span> Tipo de conta</h2>

            <p className="section-subtitle">Selecione como você irá atuar nas provas</p>

           

            <div className="cards-conta">

              <div

                className={`card-conta ${tipoConta === 'Ledor' ? 'active' : ''}`}

                onClick={() => setTipoConta('Ledor')}

              >

                <div className="card-icon">📖</div>

                <h3>Ledor</h3>

                <p>Realiza leitura das questões para candidatos. Requer certificado.</p>

                {tipoConta === 'Ledor' && <div className="dot-active"></div>}

              </div>



              <div

                className={`card-conta ${tipoConta === 'Fiscal' ? 'active' : ''}`}

                onClick={() => setTipoConta('Fiscal')}

              >

                <div className="card-icon">📋</div>

                <h3>Fiscal</h3>

                <p>Auxilia na aplicação e fiscalização das provas. Não exige certificado.</p>

                {tipoConta === 'Fiscal' && <div className="dot-active"></div>}

              </div>



              <div

                className={`card-conta ${tipoConta === 'Coordenador' ? 'active' : ''}`}

                onClick={() => setTipoConta('Coordenador')}

              >

                <div className="card-icon">🏢</div>

                <h3>Coordenadores</h3>

                <p>Cria aplicação e a organização das provas.</p>

                {tipoConta === 'Coordenador' && <div className="dot-active"></div>}

              </div>

            </div>



{/* Upload de Certificado (Aparece SÓ para Ledor) */}

{tipoConta === 'Ledor' && (

  <div className="upload-box mt-20">

    <label>CERTIFICADO DE LEDOR *</label>

    <div className="dropzone">

      <span className="file-icon">📄</span>

      <p>Clique para enviar o certificado</p>

      <small>Formatos aceitos: PDF — Max. 5MB</small>

     

      {/* 1. ATUALIZADO: Adicionado o onChange para salvar o arquivo no estado */}

      <input

        type="file"

        name="certificadoLedor"

        accept=".pdf, image/jpeg, image/png"

        onChange={(e) => setArquivoDiploma(e.target.files[0])}

      />

    </div>



    {arquivoDiploma && (

      <p style={{ color: '#10b981', fontSize: '12.5px', fontWeight: '600', marginTop: '8px', textAlign: 'center' }}>

        ✓ {arquivoDiploma.name}

      </p>

    )}

  </div>

)}

</section>

          {/* O restante do formulário só aparece se o usuário já escolheu um tipo de conta */}

          {tipoConta && (

            <>

              {/* SEÇÃO 2: DADOS PESSOAIS */}

              <section className="form-section mt-40">

                <h2 className="section-title"><span className="section-num">1</span> Dados pessoais</h2>

               

                <div className="form-grid">

                  <div className="input-group full-width">

                    <label>NOME COMPLETO *</label>

                    <input type="text" name="nomeCompleto" value={formData.nomeCompleto} onChange={handleChange} placeholder="Seu nome completo" required />

                  </div>



                  <div className="input-group">

                    <label>CPF *</label>

                    <input type="text" name="cpf" value={formData.cpf} onChange={handleChange} placeholder="000.000.000-00" required />

                  </div>



                  <div className="input-group">

                    <label>DATA DE NASCIMENTO *</label>

                    <input type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} required />

                  </div>



                  <div className="input-group">

                    <label>CELULAR / WHATSAPP *</label>

                    <input type="text" name="celular" value={formData.celular} onChange={handleChange} placeholder="(00) 90000-0000" required />

                  </div>



                  <div className="input-group">

                    <label>E-MAIL *</label>

                    <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="seu@email.com" required />

                  </div>



                  {/* Endereço e Nada Consta não aparecem para Coordenação */}

                  {tipoConta !== 'Coordenador' && (

                    <>

                      <div className="input-group full-width">

                        <label>ENDEREÇO</label>

                        <input type="text" name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Rua, número, bairro, cidade" />

                      </div>



                      <div className="upload-box full-width">

                        <label>NADA CONSTA (CERTIDÃO)</label>

                        <div className="dropzone">

                          <span className="file-icon">📄</span>

                          <p>Clique para enviar o nada consta</p>

                          <small>Formatos aceitos: PDF — Max. 5MB</small>

                          <input type="file" name="nadaconsta" accept=".pdf" onChange={(e) => setArquivoNadaConsta(e.target.files[0])} />

                        </div>

                      </div>

                      <div>

                        {arquivoNadaConsta && (

                          <p style={{ color: '#10b981', fontSize: '12.5px', fontWeight: '600', marginTop: '8px', textAlign: 'center' }}>

                            ✓ {arquivoNadaConsta.name}

                          </p>

                        )}

                      </div>

                     

                    </>

                  )}

                </div>

              </section>



              {/* SEÇÃO 3: FORMAÇÃO ACADÊMICA (Só para Ledor e Fiscal) */}

              {tipoConta !== 'Coordenador' && (

                <section className="form-section mt-40">

                  <h2 className="section-title"><span className="section-num">2</span> Formação acadêmica</h2>

                 

                  <div className="form-grid">

                    <div className="input-group">

                      <label>NÍVEL DE ESCOLARIDADE</label>

                      <select name="escolaridadeNivel" value={formData.escolaridadeNivel} onChange={handleChange}>

                        <option value="">Selecione</option>

                        <option value="Ensino Médio">Ensino Médio</option>

                        <option value="Ensino Superior">Ensino Superior</option>

                        <option value="Pós-graduação">Pós-graduação</option>

                      </select>

                    </div>



                    <div className="input-group">

                      <label>STATUS</label>

                      <select name="escolaridadeStatus" value={formData.escolaridadeStatus} onChange={handleChange}>

                        <option value="">Selecione</option>

                        <option value="Cursando">Cursando</option>

                        <option value="Concluído">Concluído</option>

                      </select>

                    </div>



                    <div className="input-group full-width">

                      <label>Curso de Formação</label>

                      <input type="text" name="cursoFormacao" value={formData.cursoFormacao} onChange={handleChange} placeholder="Nome do curso" />

                    </div>

                  </div>



                  {/* Chips de Idiomas */}

                  <div className="chips-container mt-20">

                    <label>NÍVEL DE INGLÊS</label>

                    <div className="chips-row">

                      {niveisIdioma.map(nivel => (

                        <button type="button" key={`en-${nivel}`}

                          className={`chip ${formData.nivelIngles === nivel ? 'active' : ''}`}

                          onClick={() => setFormData({...formData, nivelIngles: nivel})}>

                          {nivel}

                        </button>

                      ))}

                    </div>

                  </div>



                  <div className="chips-container mt-20">

                    <label>NÍVEL DE ESPANHOL</label>

                    <div className="chips-row">

                      {niveisIdioma.map(nivel => (

                        <button type="button" key={`es-${nivel}`}

                          className={`chip ${formData.nivelEspanhol === nivel ? 'active' : ''}`}

                          onClick={() => setFormData({...formData, nivelEspanhol: nivel})}>

                          {nivel}

                        </button>

                      ))}

                    </div>

                  </div>



                  {/* Chips de Matérias (Múltipla escolha) */}

                  <div className="chips-container mt-20">

                    <label>MATÉRIAS COM FACILIDADE</label>

                    <div className="chips-row multi-wrap">

                      {materiasList.map(materia => (

                        <button type="button" key={materia}

                          className={`chip ${formData.materias.includes(materia) ? 'active' : ''}`}

                          onClick={() => toggleMateria(materia)}>

                          {materia}

                        </button>

                      ))}

                    </div>

                  </div>



                  <div className="input-group full-width mt-20">

                    <label>EXPERIÊNCIA PROFISSIONAL</label>

                    <textarea name="experienciaProfissional" rows="4" value={formData.experienciaProfissional} onChange={handleChange} placeholder="Descreva brevemente suas experiências anteriores como ledor ou fiscal, se houver..."></textarea>

                  </div>

                </section>

              )}



              {/* SEÇÃO 4: DADOS DE ACESSO (Todos precisam de senha) */}

              <section className="form-section mt-40">

                <h2 className="section-title"><span className="section-num">{tipoConta === 'Coordenador' ? '2' : '3'}</span> Dados de acesso</h2>

                <p className="section-subtitle">Crie sua senha para entrar no sistema</p>

               

                <div className="form-grid">

                  <div className="input-group">

                    <label>SENHA *</label>

                    <input type="password" name="senha" value={formData.senha} onChange={handleChange} placeholder="Mínimo 8 caracteres" required />

                  </div>

                  <div className="input-group">

                    <label>CONFIRMAR SENHA *</label>

                    <input type="password" name="confirmarSenha" value={formData.confirmarSenha} onChange={handleChange} placeholder="Repita a senha" required />

                  </div>

                </div>



                <div className="checkbox-group mt-20">

                  <input type="checkbox" id="termos" name="aceiteTermos" checked={formData.aceiteTermos} onChange={handleChange} required />

                  <label htmlFor="termos">Declaro que li e concordo com os Termos de Uso e a Política de Privacidade do Sistema de Ledores da Heavenly International School.</label>

                </div>



                <div className="submit-area mt-40">

                  <button type="submit" disabled={salvando} className="btn-primary">

                    {salvando ? 'Criando conta...' : 'Criar minha conta →'}

                  </button>

                  <p className="login-link">Já tem uma conta? <Link to="/login">Entrar</Link></p>

                </div>

              </section>

            </>

          )}

        </form>

      </main>

    </div>

  );

};