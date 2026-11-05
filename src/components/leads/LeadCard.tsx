import { memo } from 'react';
import { Lead, LEAD_STATUS_CONFIG, LEAD_ORIGEM_CONFIG } from '@/lib/leads-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  MoreVertical, 
  Phone, 
  Mail, 
  Building, 
  GraduationCap,
  Calendar,
  DollarSign,
  MessageCircle,
  Archive,
  Trash2,
  Edit,
  Eye,
  UserPlus,
  User,
  ArrowLeftRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Vendedor } from '@/lib/vendedores-storage';
import type { LeadRechamadaInfo } from '@/pages/Leads';

interface LeadCardProps {
  lead: Lead;
  onView: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onAssignVendedor?: (lead: Lead, vendedorId: string) => void;
  isDragging?: boolean;
  vendedorNome?: string;
  vendedoresList: Vendedor[];
  canAssign?: boolean;
  canDelete?: boolean;
  rechamadaInfo?: LeadRechamadaInfo;
}

const LeadCard = memo(({ lead, onView, onEdit, onArchive, onDelete, onAssignVendedor, isDragging, vendedorNome, vendedoresList, canAssign = false, canDelete = true, rechamadaInfo }: LeadCardProps) => {

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const origemConfig = LEAD_ORIGEM_CONFIG[lead.origem] ?? { label: lead.origem || '—', icon: 'Globe' };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      window.open(`tel:${lead.telefone}`, '_blank');
    }
  };

  const handleEmailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.email) {
      window.open(`mailto:${lead.email}`, '_blank');
    }
  };

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, '');
      window.open(`https://wa.me/55${phone}`, '_blank');
    }
  };

  const rechamadaClass = rechamadaInfo?.hasOverdue
    ? 'bg-destructive/5 border-destructive/40'
    : rechamadaInfo?.hasDueToday
      ? 'bg-warning/10 border-warning/40'
      : '';

  return (
    <Card 
      className={`mb-2 cursor-pointer overflow-hidden rounded-[12px] border-ink-200 shadow-card transition-colors hover:border-ink-300 ${rechamadaClass} ${
        isDragging ? 'shadow-pop ring-2 ring-primary' : ''
      }`}
      onClick={() => onView(lead)}
    >
      <div className={`h-[3px] w-full ${statusConfig.bgColor}`} />
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-[14.5px] font-semibold text-ink-950 truncate">{lead.nome}</h4>
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Badge variant="outline" className={`text-xs ${statusConfig.color} ${statusConfig.bgColor}`}>
                {origemConfig.label}
              </Badge>
              {vendedorNome && (
                <Badge variant="secondary" className="text-xs bg-ink-100 text-ink-700">
                  {vendedorNome}
                </Badge>
              )}
              {canAssign && onAssignVendedor && (
                <Popover>
                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="icon" aria-label="Transferir lead" className="h-6 w-6 p-0 border-primary/50 hover:bg-primary/10">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1 bg-popover border shadow-pop z-50" align="start" onClick={(e) => e.stopPropagation()}>
                    <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                      Atribuir Vendedor
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {vendedoresList.map((vendedor) => (
                        <Button
                          key={vendedor.id}
                          variant="ghost"
                          size="sm"
                          className={`w-full justify-start text-xs h-8 ${
                            lead.vendedor_id === vendedor.id ? 'bg-primary/10' : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignVendedor(lead, vendedor.id);
                          }}
                        >
                          <User className="mr-2 h-3 w-3" />
                          {vendedor.nome}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" aria-label="Mais ações do lead" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(lead); }}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              
              {/* Atribuir Vendedor - apenas para Admin, Supervisor e Gerente */}
              {canAssign && onAssignVendedor && vendedoresList.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Atribuir Vendedor
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="bg-popover border shadow-pop z-50">
                      {vendedoresList.map((vendedor) => (
                        <DropdownMenuItem
                          key={vendedor.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAssignVendedor(lead, vendedor.id);
                          }}
                          className={lead.vendedor_id === vendedor.id ? 'bg-primary/10' : ''}
                        >
                          <User className="mr-2 h-4 w-4" />
                          {vendedor.nome}
                          {lead.vendedor_id === vendedor.id && (
                            <Badge variant="secondary" className="ml-auto text-xs">Atual</Badge>
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(lead); }}>
                <Archive className="mr-2 h-4 w-4" />
                Arquivar
              </DropdownMenuItem>
              {canDelete && (
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onDelete(lead); }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-1 text-xs text-muted-foreground">
          {lead.telefone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              <span className="truncate">{lead.telefone}</span>
              <Button 
                variant="ghost" 
                size="icon" aria-label="Ligar para o lead" 
                className="h-5 w-5 ml-auto"
                onClick={handlePhoneClick}
              >
                <Phone className="h-3 w-3" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" aria-label="Abrir WhatsApp" 
                className="h-5 w-5"
                onClick={handleWhatsAppClick}
              >
                <MessageCircle className="h-3 w-3" />
              </Button>
            </div>
          )}

          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span className="truncate flex-1">{lead.email}</span>
              <Button 
                variant="ghost" 
                size="icon" aria-label="Enviar e-mail" 
                className="h-5 w-5"
                onClick={handleEmailClick}
              >
                <Mail className="h-3 w-3" />
              </Button>
            </div>
          )}

          {lead.empresa && (
            <div className="flex items-center gap-2">
              <Building className="h-3 w-3" />
              <span className="truncate">{lead.empresa}</span>
            </div>
          )}

          {lead.curso_interesse && (
            <div className="flex items-center gap-2">
              <GraduationCap className="h-3 w-3" />
              <span className="truncate">{lead.curso_interesse}</span>
            </div>
          )}


          <div className="flex items-center justify-between gap-2 pt-2 border-t mt-2">
            <div className="flex items-center gap-1 min-w-0">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="truncate">{format(new Date(lead.data_entrada), 'dd/MM/yy', { locale: ptBR })}</span>
            </div>
            {lead.valor_estimado && (
              <div className="font-medium text-foreground shrink-0 whitespace-nowrap">
                {formatCurrency(lead.valor_estimado)}
              </div>
            )}
          </div>
        </div>

        {lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lead.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                {tag}
              </Badge>
            ))}
            {lead.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                +{lead.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

LeadCard.displayName = 'LeadCard';

export default LeadCard;
