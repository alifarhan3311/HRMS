/**
 * App.jsx
 */
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { Suspense } from 'react';
import store from './store';
import router from './routes';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center bg-background text-foreground">
              Loading HRMS...
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ThemeProvider>
    </Provider>
  );
}
