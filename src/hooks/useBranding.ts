import { useQuery } from '@tanstack/react-query';
import { fetchBranding } from '@/lib/branding';

export const BRANDING_QUERY_KEY = ['branding'];

export const useBranding = () => {
  const { data, isLoading } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
  });
  return { nomeEmpresa: data?.nomeEmpresa ?? null, logoUrl: data?.logoUrl ?? null, isLoading };
};
