import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { storage } from '@/lib/storage';
import { Installment } from '@/lib/types';

interface FinancialContextType {
  installments: Installment[];
  loading: boolean;
  refreshInstallments: () => Promise<void>;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within FinancialProvider');
  }
  return context;
};

interface FinancialProviderProps {
  children: ReactNode;
}

export const FinancialProvider = ({ children }: FinancialProviderProps) => {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInstallments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await storage.getInstallments();
      setInstallments(data);
    } catch (error) {
      console.error('Error loading installments:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstallments();
  }, [loadInstallments]);

  const refreshInstallments = useCallback(async () => {
    await loadInstallments();
  }, [loadInstallments]);

  return (
    <FinancialContext.Provider value={{ installments, loading, refreshInstallments }}>
      {children}
    </FinancialContext.Provider>
  );
};
