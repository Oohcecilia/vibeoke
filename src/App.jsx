import { Toaster } from 'sonner';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home';
import PlayerScreen from './pages/PlayerScreen';
import Controller from './pages/Controller';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/player" element={<PlayerScreen />} />
        <Route path="/controller" element={<Controller />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <Toaster richColors theme="dark" position="top-center" />
    </Router>
  );
}

export default App;
