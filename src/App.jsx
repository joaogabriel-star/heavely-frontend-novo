// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/Authcontext';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { DashboardCoord } from './pages/Dashboardcoor';
import { DashboardCandidato } from './pages/Dashboardcandidato';


function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/dashboard-coordenacao" element={<DashboardCoord />} />
          <Route path="/dashboard-candidato" element={<DashboardCandidato />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;