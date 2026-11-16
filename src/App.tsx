import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Layout } from './components/Layout.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { WikiArticlePage } from './pages/WikiArticlePage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { SubmitPage } from './pages/SubmitPage.tsx';
import { TrackPage } from './pages/TrackPage.tsx';
import { AdminPage } from './pages/AdminPage.tsx';
import { ArchitecturePage } from './pages/ArchitecturePage.tsx';

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/wiki" element={<Navigate to="/wiki/Main_Page" replace />} />
            <Route path="/wiki/*" element={<WikiArticlePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/submit/track" element={<TrackPage />} />
            <Route path="/submit/admin" element={<AdminPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}
