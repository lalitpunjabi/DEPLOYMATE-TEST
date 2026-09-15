import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Pipelines } from './pages/Pipelines';
import { Deployments } from './pages/Deployments';
import { Monitoring } from './pages/Monitoring';
import { Logs } from './pages/Logs';
import { AIAssistant } from './pages/AIAssistant';
import { AuditLogs } from './pages/AuditLogs';
import { Settings } from './pages/Settings';
import { GitOps } from './pages/GitOps';
import { Terraform } from './pages/Terraform';
import { SreSLO } from './pages/SreSLO';
import { Chaos } from './pages/Chaos';
import { DemoProvider } from './context/DemoContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DemoProvider>
        <Router>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Workspace Layout Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="pipelines" element={<Pipelines />} />
              <Route path="deployments" element={<Deployments />} />
              <Route path="gitops" element={<GitOps />} />
              <Route path="terraform" element={<Terraform />} />
              <Route path="sre" element={<SreSLO />} />
              <Route path="chaos" element={<Chaos />} />
              <Route path="monitoring" element={<Monitoring />} />
              <Route path="logs" element={<Logs />} />
              <Route path="ai-assistant" element={<AIAssistant />} />
              <Route path="audit-logs" element={<AuditLogs />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Redirect any other URLs back to Dashboard / Login */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </DemoProvider>
    </AuthProvider>
  );
};

export default App;
