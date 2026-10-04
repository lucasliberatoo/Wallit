import { createContext, useContext, useState } from 'react';

import { createRepositories, type Repositories } from '@/data';

type AppRepositories = ReturnType<typeof createRepositories>;
const RepositoriesContext = createContext<AppRepositories | null>(null);

export function RepositoriesProvider({ children, value }: { children: React.ReactNode; value?: AppRepositories }) {
  const [repositories] = useState(() => value ?? createRepositories());
  return <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories & { reset?: () => Promise<void> } {
  const context = useContext(RepositoriesContext);
  if (!context) throw new Error('useRepositories must be used inside RepositoriesProvider');
  return context;
}
