import { GlassCard } from '@/components/ui/GlassCard';
import type { ReactNode } from 'react';

interface ClerkAuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function ClerkAuthShell({ title, subtitle, children }: ClerkAuthShellProps) {
  return (
    <div className="min-h-page-content mx-auto flex items-center justify-center px-2">
      <GlassCard className="clerk-auth-shell w-full max-w-[440px] p-6 sm:p-8">
        <header className="mb-5 text-center">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted mt-1.5 text-sm leading-relaxed">{subtitle}</p>
        </header>
        {children}
      </GlassCard>
    </div>
  );
}
