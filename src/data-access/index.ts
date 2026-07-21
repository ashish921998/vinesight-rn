import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { DataAccess } from './DataAccess';
import { supabaseDataAccess } from './SupabaseDataAccess';

export type { DataAccess } from './DataAccess';
export { InMemoryDataAccess } from './InMemoryDataAccess';
export { SupabaseDataAccess, supabaseDataAccess } from './SupabaseDataAccess';

export const DataAccessContext = createContext<DataAccess>(supabaseDataAccess);

let currentDataAccess: DataAccess = supabaseDataAccess;

export function DataAccessProvider({
  value,
  children,
}: {
  value?: DataAccess;
  children: ReactNode;
}) {
  const dataAccess = value ?? supabaseDataAccess;
  currentDataAccess = dataAccess;
  return createElement(DataAccessContext.Provider, { value: dataAccess }, children);
}

export function useDataAccess(): DataAccess {
  return useContext(DataAccessContext);
}

export function getDataAccess(): DataAccess {
  return currentDataAccess;
}
