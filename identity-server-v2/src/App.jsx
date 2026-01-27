import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import EmbedVerification from './pages/EmbedVerification';
import IDVerificationTest from './pages/IDVerificationTest';
import SelfieLivenessTest from './pages/SelfieLivenessTest';
import IDVerification from './pages/IDVerification';
import SelfieLiveness from './pages/SelfieLiveness';
import Documentation from './pages/Documentation';
import ApiDemo from './pages/ApiDemo';

export default function App({ initialState = {} }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/docs" element={<Documentation />} />
      <Route path="/api-demo" element={<ApiDemo />} />
      <Route path="/id-verification-test" element={<IDVerificationTest />} />
      <Route path="/selfie-liveness-test" element={<SelfieLivenessTest />} />
      <Route path="/embed/session/:id" element={<EmbedVerification initialState={initialState} />} />
      {/* Session-based verification routes */}
      <Route path="/session/idverification/:id" element={<IDVerification />} />
      <Route path="/session/selfieliveness/:id" element={<SelfieLiveness />} />
    </Routes>
  );
}
