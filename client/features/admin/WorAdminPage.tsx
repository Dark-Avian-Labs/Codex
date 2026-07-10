import { useAuth } from '../auth/AuthContext';
import { WorImportAdminTool } from './WorImportAdminTool';

export function WorAdminPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === 'ok' && auth.isCodexAdmin;

  if (!isAdmin) {
    return (
      <section className="glass-shell rounded-2xl p-6">
        <h1 className="mb-2 text-2xl font-semibold">Watcher of Realms Admin</h1>
        <p className="text-muted text-sm">Admin access is required.</p>
      </section>
    );
  }

  return (
    <section className="glass-shell space-y-5 rounded-2xl p-6">
      <div>
        <h1 className="text-2xl font-semibold">Watcher of Realms Admin</h1>
        <p className="text-muted mt-1 text-sm">Import catalog data and manage WoR overrides.</p>
      </div>
      <WorImportAdminTool />
    </section>
  );
}
