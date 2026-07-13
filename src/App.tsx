import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import NotFound from '@/pages/NotFound';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProtectedRoute, PublicRoute } from '@/components/common/ProtectedRoute';
import { routes } from './routes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <CartProvider>
            <IntersectObserver />
            <Routes>
              {routes.map((route, index) => (
                <Route
                  key={index}
                  path={route.path}
                  element={
                    route.public ? (
                      <PublicRoute>{route.element}</PublicRoute>
                    ) : (
                      <ProtectedRoute allowedRoles={route.roles}>{route.element}</ProtectedRoute>
                    )
                  }
                />
              ))}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
