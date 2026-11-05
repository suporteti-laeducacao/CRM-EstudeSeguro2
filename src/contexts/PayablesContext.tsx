import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Credor, ContaPagar } from '@/lib/payables-types';
import * as payablesStorage from '@/lib/payables-storage';

interface PayablesContextType {
  credores: Credor[];
  contasPagar: ContaPagar[];
  loading: boolean;
  refreshCredores: () => Promise<void>;
  refreshContasPagar: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const PayablesContext = createContext<PayablesContextType | undefined>(undefined);

export const usePayables = () => {
  const context = useContext(PayablesContext);
  if (!context) {
    throw new Error('usePayables must be used within PayablesProvider');
  }
  return context;
};

interface PayablesProviderProps {
  children: ReactNode;
}

export const PayablesProvider = ({ children }: PayablesProviderProps) => {
  const [credores, setCredores] = useState<Credor[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCredores = useCallback(async () => {
    try {
      const data = await payablesStorage.getCredores();
      setCredores(data);
    } catch (error) {
      console.error('Error loading credores:', error);
    }
  }, []);

  const loadContasPagar = useCallback(async () => {
    try {
      const data = await payablesStorage.getContasPagar();
      setContasPagar(data);
    } catch (error) {
      console.error('Error loading contas a pagar:', error);
    }
  }, []);

  const loadAll = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      await Promise.all([loadCredores(), loadContasPagar()]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [loadCredores, loadContasPagar]);

  useEffect(() => {
    loadAll(true);
  }, [loadAll]);

  const refreshCredores = useCallback(async () => {
    await loadCredores();
  }, [loadCredores]);

  const refreshContasPagar = useCallback(async () => {
    await loadContasPagar();
  }, [loadContasPagar]);

  const refreshAll = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  return (
    <PayablesContext.Provider value={{ 
      credores, 
      contasPagar, 
      loading, 
      refreshCredores, 
      refreshContasPagar,
      refreshAll 
    }}>
      {children}
    </PayablesContext.Provider>
  );
};
