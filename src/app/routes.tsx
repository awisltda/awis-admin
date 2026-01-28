import { createBrowserRouter } from 'react-router-dom'
import { RequireRole } from '../auth/RequireRole'
import { RequireAnyRole } from '../auth/RequireAnyRole'
import { Shell } from '../layout/Shell'
import { ApiClientsPage } from '../features/apiClients/ApiClientsPage'
import { UsersPage } from '../features/users/UsersPage'
import { Login } from '../pages/Login'
import { TenantDetail } from '../pages/TenantDetail'

function NotFound() {
  return <div style={{ padding: 18 }}>Página não encontrada.</div>
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequireAnyRole roles={["AWIS"]}>
        <Shell />
      </RequireAnyRole>
    ),
    children: [
      {
        index: true,
        element: (
          <RequireRole role="AWIS">
            <ApiClientsPage />
          </RequireRole>
        ),
      },
      {
        path: 'api-clients',
        element: (
          <RequireRole role="AWIS">
            <ApiClientsPage />
          </RequireRole>
        ),
      },
      {
        path: 'api-clients/:id',
        element: (
          <RequireRole role="AWIS">
            <TenantDetail />
          </RequireRole>
        ),
      },

      // Users & Roles (AWIS / ADM)
      { path: 'users', element: <UsersPage /> },
    ],
  },
  { path: '*', element: <NotFound /> },
])
