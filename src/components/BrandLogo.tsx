import { useEffect } from 'react';
import { useBranding } from '@/hooks/useBranding';

interface BrandLogoProps {
  /** Classes da imagem da logo */
  className?: string;
  /** Classes do nome da empresa, mostrado quando não há logo */
  nameClassName?: string;
}

/** Mostra a logo; sem logo, o nome da empresa; sem nenhum dos dois, nada. */
const BrandLogo = ({ className, nameClassName }: BrandLogoProps) => {
  const { logoUrl, nomeEmpresa } = useBranding();

  if (logoUrl) return <img src={logoUrl} alt={nomeEmpresa ?? 'Logo'} className={className} />;
  if (nomeEmpresa) return <span className={nameClassName}>{nomeEmpresa}</span>;
  return null;
};

export const BrandDocumentTitle = () => {
  const { nomeEmpresa } = useBranding();

  useEffect(() => {
    document.title = nomeEmpresa ? `${nomeEmpresa} - CRM de Vendas` : 'CRM de Vendas';
  }, [nomeEmpresa]);

  return null;
};

export default BrandLogo;
