// Conecta el cliente Axios con el store de auth antes del primer render.
import './setup/axios-auth';

import { AppProviders } from './providers/AppProviders';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}
