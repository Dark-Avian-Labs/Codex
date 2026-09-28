import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Route } from 'react-router';

import { App } from '../App';
import { Layout } from '../components/Layout/Layout';
import { RequireAuth } from '../features/auth/RequireAuth';
import { APP_PATHS } from './paths';

const lazyNamed = <TModule extends Record<string, unknown>>(
  importer: () => Promise<TModule>,
  exportName: keyof TModule,
) =>
  lazy(() =>
    importer().then((mod) => ({
      default: mod[exportName] as ComponentType,
    })),
  );

const HomePage = lazyNamed(() => import('../features/selector/HomePage'), 'HomePage');
const WarframePage = lazyNamed(() => import('../features/warframe/WarframePage'), 'WarframePage');
const Epic7Page = lazyNamed(() => import('../features/epic7/Epic7Page'), 'Epic7Page');
const WorPage = lazyNamed(() => import('../features/wor/WorPage'), 'WorPage');
const LegalPage = lazyNamed(() => import('../features/legal/LegalPage'), 'LegalPage');
const AdminPage = lazyNamed(() => import('../features/admin/AdminPage'), 'AdminPage');
const WarframeAdminPage = lazyNamed(
  () => import('../features/admin/WarframeAdminPage'),
  'WarframeAdminPage',
);
const WorAdminPage = lazyNamed(() => import('../features/admin/WorAdminPage'), 'WorAdminPage');
const NotFoundPage = lazyNamed(() => import('../features/not-found/NotFoundPage'), 'NotFoundPage');
const CodexLandingPage = lazyNamed(
  () => import('../features/auth/CodexLandingPage'),
  'CodexLandingPage',
);
const SignInPage = lazyNamed(() => import('../features/auth/SignInPage'), 'SignInPage');
const SignUpPage = lazyNamed(() => import('../features/auth/SignUpPage'), 'SignUpPage');

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<App />}>
      <Route element={<Layout />}>
        <Route path={APP_PATHS.legal} element={<LegalPage />} />
        <Route path={`${APP_PATHS.signIn}/*`} element={<SignInPage />} />
        <Route path={`${APP_PATHS.signUp}/*`} element={<SignUpPage />} />
        <Route path={APP_PATHS.home} element={<CodexLandingPage />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.warframe}
          element={
            <RequireAuth>
              <WarframePage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.epic7}
          element={
            <RequireAuth>
              <Epic7Page />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.wor}
          element={
            <RequireAuth>
              <WorPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.epic7Admin}
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.warframeAdmin}
          element={
            <RequireAuth>
              <WarframeAdminPage />
            </RequireAuth>
          }
        />
        <Route
          path={APP_PATHS.worAdmin}
          element={
            <RequireAuth>
              <WorAdminPage />
            </RequireAuth>
          }
        />
        <Route path={APP_PATHS.admin} element={<Navigate to={APP_PATHS.epic7Admin} replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>,
  ),
);
