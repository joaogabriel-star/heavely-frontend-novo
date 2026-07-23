// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/Authcontext';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { DashboardCoord } from './pages/Dashboardcoor';
import { DashboardCandidato } from './pages/Dashboardcandidato';
import { EsqueciSenha } from './pages/EsqueciSenha';
import { RedefinirSenha } from './pages/RedefinirSenha';


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/esqueci-senha" element={<EsqueciSenha />} />
          <Route path="/redefinir-senha/:token" element={<RedefinirSenha />} />
          <Route path="/dashboard-coordenacao" element={<DashboardCoord />} />
          <Route path="/dashboard-candidato" element={<DashboardCandidato />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;