# Client Architecture

## Overview

The Codex client is a **React 19** application built with **TypeScript 6**, **Vite 8**, and **Tailwind CSS 4**. It features a modern, component-based architecture with lazy loading, Clerk authentication integration, and a theme system supporting multiple UI styles.

## Application Structure

```
client/
├── main.tsx                  # Application entry point
├── App.tsx                   # Root component with router
├── app/                      # Feature-based routing structure
│   ├── layout.tsx           # Root layout with providers
│   ├── page.tsx             # Home page
│   ├── (auth)/              # Authentication routes group
│   ├── warframe/            # Warframe feature routes
│   └── epic7/               # Epic Seven feature routes
├── components/               # Reusable UI components
│   ├── ui/                  # Primitive components
│   ├── layout/              # Layout components
│   └── game/                # Game-specific components
├── context/                  # React context providers
│   ├── ThemeContext.tsx     # Theme management
│   └── AuthContext.tsx      # Authentication state
├── features/                 # Game feature implementations
│   ├── warframe/            # Warframe-specific features
│   └── epic7/               # Epic Seven-specific features
├── hooks/                    # Custom React hooks
├── lib/                      # Client-side libraries
├── styles/                   # CSS and styling
│   ├── globals.css          # Global styles
│   └── tailwind.css         # Tailwind configuration
└── utils/                    # Utility functions
```

## Key Architectural Patterns

### 1. Feature-Based Organization

The application uses a **feature-based architecture** where related functionality is grouped together:

- **Game Features**: `features/warframe/`, `features/epic7/`
- **Route Groups**: `app/(auth)/`, `app/warframe/`, `app/epic7/`
- **Shared Components**: `components/ui/`, `components/layout/`

### 2. Lazy Loading with React Router

Routes are lazy-loaded for optimal performance:

```typescript
// app/warframe/page.tsx
import { lazy, Suspense } from 'react';
import { LazySuspenseFallback } from '@/components/ui/LazySuspenseFallback';

const WarframeInventory = lazy(() => import('@/features/warframe/WarframeInventory'));

export default function WarframePage() {
  return (
    <Suspense fallback={<LazySuspenseFallback />}>
      <WarframeInventory />
    </Suspense>
  );
}
```

### 3. Theme System

The application supports multiple UI styles through a comprehensive theme system:

```typescript
// context/ThemeContext.tsx
export type UITheme = 'clear' | 'shadow' | 'liquid';
export type ColorScheme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  uiTheme: UITheme;
  colorScheme: ColorScheme;
  setUITheme: (theme: UITheme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
}
```

**Theme Implementation**:
- CSS custom properties for design tokens
- HTML class-based theme switching (`html.ui-clear`, `html.ui-shadow`)
- LocalStorage persistence for user preferences
- System color scheme detection

### 4. Authentication Integration

**Clerk Authentication Flow**:
1. `ClerkProvider` wraps the entire application
2. `SignedIn`/`SignedOut` components control access
3. Custom `AuthContext` provides app-specific auth state
4. Session synchronization with server-side Express sessions

### 5. Component Hierarchy

```
App
├── Providers (ThemeContext, AuthContext, ClerkProvider)
├── Router (React Router)
│   ├── Layout (Header, Navigation, Footer)
│   ├── Public Routes
│   ├── Protected Routes (require authentication)
│   └── Game Routes (lazy-loaded)
└── Toaster (Toast notifications)
```

## Key Components

### Layout Components

**`Header`** (`components/layout/Header.tsx`):
- Navigation links with active state tracking
- User menu with authentication state
- Theme selector dropdown
- Responsive design for mobile/desktop

**`Navigation`** (`components/layout/Navigation.tsx`):
- Game-specific navigation tabs
- Breadcrumb navigation
- Access control based on user roles

**`Modal`** (`components/ui/Modal.tsx`):
- Reusable modal dialog component
- Accessibility features (focus trapping, ARIA labels)
- Animation transitions
- Glass surface styling (`glass-modal-surface`)

### UI Components

**`Button`** (`components/ui/Button.tsx`):
- Multiple variants: `accent`, `danger`, `cancel`, `secondary`
- Size variants: `sm`, `md`, `lg`
- Loading states
- Icon support

**`SelectDropdown`** (`components/ui/SelectDropdown.tsx`):
- Custom dropdown with positioning
- Search functionality
- Multi-select support
- Custom trigger styling (`user-menu-select-trigger`)

**`Toast`** (`components/ui/Toast.tsx`):
- Toast notification system
- Multiple tones: `success`, `error`, `warning`
- Auto-dismiss with manual control
- Pill styling (`.toast-pill`)

### Game Components

**`InventoryTable`** (`features/warframe/components/InventoryTable.tsx`):
- Table-based inventory display
- Column sorting and filtering
- Cell editing capabilities
- Bulk selection actions

**`CollectionTracker`** (`features/epic7/components/CollectionTracker.tsx`):
- Hero and artifact collection tracking
- Progress indicators
- Search and filter functionality
- Import/export capabilities

## Styling System

### Tailwind CSS Configuration

- **Custom Design Tokens**: Extended Tailwind theme with custom colors, spacing, shadows
- **Glass Effects**: `glass-surface`, `glass-modal-surface`, `glass-shell` classes
- **Responsive Design**: Mobile-first breakpoints
- **Dark Mode**: System-aware dark mode with custom theming

### CSS Architecture

```css
/* Design tokens */
:root {
  --color-accent: #3b82f6;
  --color-glass-border: rgba(255, 255, 255, 0.1);
  --color-glass: rgba(255, 255, 255, 0.05);
  --radius-ui: to-rem(1);
  --shadow-panel: 0 to-rem(1) to-rem(3) rgba(0, 0, 0, 0.1);
}

/* Theme variations */
html.ui-clear {
  --glass-opacity: 0.05;
  --glass-blur: to-rem(2);
}

html.ui-shadow {
  --glass-opacity: 0.1;
  --glass-blur: to-rem(4);
}
```

## State Management

### React Context Providers

1. **ThemeContext**: Manages UI theme and color scheme
2. **AuthContext**: Provides authentication state and user data
3. **GameContext**: Game-specific state (per game)

### Server State Management

- **TanStack Query**: For server state caching and synchronization
- **Optimistic Updates**: For responsive UI during mutations
- **Error Boundaries**: For graceful error handling

## Performance Optimizations

### Code Splitting
- Route-based code splitting via React.lazy()
- Component-level code splitting for large features
- Dynamic imports for heavy libraries

### Asset Optimization
- Vite build optimization with tree shaking
- Image optimization via Vite plugins
- Font subsetting and preloading

### Memoization
- React.memo() for expensive components
- useMemo() for derived state
- useCallback() for stable function references

## Error Handling

### Error Boundaries
```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error monitoring service
    // Display user-friendly error UI
  }
}
```

### Loading States
- Suspense boundaries with custom fallbacks
- Skeleton loading components
- Progressive enhancement patterns

## Source References

- Entry point: `/client/main.tsx`
- Root component: `/client/App.tsx`
- Routing structure: `/client/app/`
- Theme system: `/client/context/ThemeContext.tsx`
- Style configuration: `/client/styles/`
- Vite config: `/vite.config.ts`
- TypeScript config: `/tsconfig.json`