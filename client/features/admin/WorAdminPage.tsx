import { useAuth } from '../auth/AuthContext';
import { WorImportAdminTool } from './WorImportAdminTool';

export function WorAdminPage() {
  const { auth } = useAuth();
  const isAdmin = auth.status === 'authenticated' && auth.isAdmin;

  if (!isAdmin) {
    return (
      <section className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-glass)] p-6">
        <h1 className="mb-2 text-2xl font-semibold">Watcher of Realms Admin</h1>
        <p className="text-muted text-sm">Admin access is required.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Watcher of Realms Admin</h1>
      <p className="text-muted text-sm">Import catalog data and manage WoR overrides.</p>
      <WorImportAdminTool />
    </section>
  );
}
