import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import EmbedVerification from './pages/EmbedVerification';
import IDVerificationTest from './pages/IDVerificationTest';
import SelfieLivenessTest from './pages/SelfieLivenessTest';
import Documentation from './pages/Documentation';

export default function App({ initialState = {} }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/docs" element={<Documentation />} />
      <Route path="/id-verification-test" element={<IDVerificationTest />} />
      <Route path="/selfie-liveness-test" element={<SelfieLivenessTest />} />
      <Route path="/embed/session/:id" element={<EmbedVerification initialState={initialState} />} />
    </Routes>
  );
}
