export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      acompanhamento_config: {
        Row: {
          created_at: string
          dias_para_escalonar: number
          dias_reincidencia_sem_retorno: number
          horario_corte_fila: string
          id: string
          marcos_dias: number[]
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_para_escalonar?: number
          dias_reincidencia_sem_retorno?: number
          horario_corte_fila?: string
          id?: string
          marcos_dias?: number[]
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_para_escalonar?: number
          dias_reincidencia_sem_retorno?: number
          horario_corte_fila?: string
          id?: string
          marcos_dias?: number[]
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      acompanhamento_contatos: {
        Row: {
          aluno_id: string | null
          aluno_nome: string
          canal: string
          created_at: string
          criado_por: string | null
          data_contato: string
          data_prevista_conclusao: string | null
          dias_restantes_no_contato: number | null
          id: string
          marco: string
          observacao: string | null
          proximo_contato_em: string | null
          resultado: string
          sale_id: string | null
          vendedor_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome: string
          canal: string
          created_at?: string
          criado_por?: string | null
          data_contato?: string
          data_prevista_conclusao?: string | null
          dias_restantes_no_contato?: number | null
          id?: string
          marco: string
          observacao?: string | null
          proximo_contato_em?: string | null
          resultado: string
          sale_id?: string | null
          vendedor_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string
          canal?: string
          created_at?: string
          criado_por?: string | null
          data_contato?: string
          data_prevista_conclusao?: string | null
          dias_restantes_no_contato?: number | null
          id?: string
          marco?: string
          observacao?: string | null
          proximo_contato_em?: string | null
          resultado?: string
          sale_id?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acompanhamento_contatos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acompanhamento_contatos_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acompanhamento_contatos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      atividades: {
        Row: {
          created_at: string
          data: string | null
          descricao: string | null
          id: string
          negocio_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          negocio_id?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          negocio_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_exceptions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          day_weight: number
          description: string
          id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          day_weight?: number
          description: string
          id?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          day_weight?: number
          description?: string
          id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_settings: {
        Row: {
          consider_facultative: boolean
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
        }
        Insert: {
          consider_facultative?: boolean
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          consider_facultative?: boolean
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      campanhas_trafego: {
        Row: {
          alunos_convertidos: number
          categoria: string
          created_at: string
          data: string
          id: string
          leads: number
          nome: string
          plataforma: string
          updated_at: string
          user_id: string
          valor_gasto: number
        }
        Insert: {
          alunos_convertidos?: number
          categoria?: string
          created_at?: string
          data: string
          id?: string
          leads?: number
          nome: string
          plataforma: string
          updated_at?: string
          user_id: string
          valor_gasto: number
        }
        Update: {
          alunos_convertidos?: number
          categoria?: string
          created_at?: string
          data?: string
          id?: string
          leads?: number
          nome?: string
          plataforma?: string
          updated_at?: string
          user_id?: string
          valor_gasto?: number
        }
        Relationships: []
      }
      categorias_conta: {
        Row: {
          ativo: boolean
          created_at: string
          custo_operacional: boolean
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_operacional?: boolean
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_operacional?: boolean
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      certificacoes: {
        Row: {
          aluno_id: string | null
          apto_nova_oferta: boolean
          canal_entrega: string | null
          certificadora: string | null
          cliente_origem_id: string | null
          cpf: string | null
          created_at: string
          curso: string | null
          data_emissao: string | null
          data_entrega: string | null
          data_envio_certificadora: string | null
          data_solicitacao: string
          data_ultimo_contato_pos_certificacao: string | null
          email: string | null
          id: string
          is_segunda_via: boolean
          motivo_cancelamento: string | null
          nivel_ensino: string | null
          nome: string
          notas: string | null
          prazo_previsto: string | null
          previsao_certificacao: string | null
          promessa_certificacao: string | null
          resultado_contato: string
          sale_id: string | null
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
          vendedor_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          apto_nova_oferta?: boolean
          canal_entrega?: string | null
          certificadora?: string | null
          cliente_origem_id?: string | null
          cpf?: string | null
          created_at?: string
          curso?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          data_envio_certificadora?: string | null
          data_solicitacao?: string
          data_ultimo_contato_pos_certificacao?: string | null
          email?: string | null
          id?: string
          is_segunda_via?: boolean
          motivo_cancelamento?: string | null
          nivel_ensino?: string | null
          nome: string
          notas?: string | null
          prazo_previsto?: string | null
          previsao_certificacao?: string | null
          promessa_certificacao?: string | null
          resultado_contato?: string
          sale_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
          vendedor_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          apto_nova_oferta?: boolean
          canal_entrega?: string | null
          certificadora?: string | null
          cliente_origem_id?: string | null
          cpf?: string | null
          created_at?: string
          curso?: string | null
          data_emissao?: string | null
          data_entrega?: string | null
          data_envio_certificadora?: string | null
          data_solicitacao?: string
          data_ultimo_contato_pos_certificacao?: string | null
          email?: string | null
          id?: string
          is_segunda_via?: boolean
          motivo_cancelamento?: string | null
          nivel_ensino?: string | null
          nome?: string
          notas?: string | null
          prazo_previsto?: string | null
          previsao_certificacao?: string | null
          promessa_certificacao?: string | null
          resultado_contato?: string
          sale_id?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificacoes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificacoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      certificacoes_historico: {
        Row: {
          certificacao_id: string
          created_at: string
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          certificacao_id: string
          created_at?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          certificacao_id?: string
          created_at?: string
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificacoes_historico_certificacao_id_fkey"
            columns: ["certificacao_id"]
            isOneToOne: false
            referencedRelation: "certificacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          curso: string | null
          email: string | null
          empresa: string | null
          id: string
          nivel_ensino: string | null
          nome: string
          notas: string | null
          previsao_certificacao: string | null
          promessa_certificacao: string | null
          telefone: string | null
          user_id: string
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          curso?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nivel_ensino?: string | null
          nome: string
          notas?: string | null
          previsao_certificacao?: string | null
          promessa_certificacao?: string | null
          telefone?: string | null
          user_id: string
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          curso?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          nivel_ensino?: string | null
          nome?: string
          notas?: string | null
          previsao_certificacao?: string | null
          promessa_certificacao?: string | null
          telefone?: string | null
          user_id?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_acoes_especiais: {
        Row: {
          cobranca_id: string
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          data_prevista: string | null
          id: string
          observacao: string | null
          parcela_referencia_id: string | null
          solicitado_por: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cobranca_id: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_prevista?: string | null
          id?: string
          observacao?: string | null
          parcela_referencia_id?: string | null
          solicitado_por?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          cobranca_id?: string
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          data_prevista?: string | null
          id?: string
          observacao?: string | null
          parcela_referencia_id?: string | null
          solicitado_por?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_acoes_especiais_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_acoes_especiais_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_acoes_especiais_parcela_referencia_id_fkey"
            columns: ["parcela_referencia_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_agendamentos: {
        Row: {
          cobranca_id: string
          created_at: string
          data: string
          etapa_id: string | null
          id: string
          motivo: string | null
          origem: string
          parcela_referencia_id: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          data: string
          etapa_id?: string | null
          id?: string
          motivo?: string | null
          origem?: string
          parcela_referencia_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          data?: string
          etapa_id?: string | null
          id?: string
          motivo?: string | null
          origem?: string
          parcela_referencia_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_agendamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_agendamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_agendamentos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "cobranca_regua_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_agendamentos_parcela_referencia_id_fkey"
            columns: ["parcela_referencia_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_eventos: {
        Row: {
          automatico: boolean
          cobranca_id: string
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          automatico?: boolean
          cobranca_id: string
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          automatico?: boolean
          cobranca_id?: string
          created_at?: string
          dados?: Json | null
          descricao?: string | null
          id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_eventos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_eventos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_medidas_config: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          offset_dias: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          offset_dias: number
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          offset_dias?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_promessa_parcelas: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          installment_number: number | null
          promessa_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          installment_number?: number | null
          promessa_id: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          installment_number?: number | null
          promessa_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_promessa_parcelas_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_promessa_parcelas_promessa_id_fkey"
            columns: ["promessa_id"]
            isOneToOne: false
            referencedRelation: "cobranca_promessas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_promessas: {
        Row: {
          cobranca_id: string
          created_at: string
          cumprimento: string | null
          data_prometida: string
          id: string
          observacao: string | null
          promessa_anterior_id: string | null
          resolvida_em: string | null
          status: string
          substituida_por_renegociacao_id: string | null
          user_id: string
          valor_prometido: number | null
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          cumprimento?: string | null
          data_prometida: string
          id?: string
          observacao?: string | null
          promessa_anterior_id?: string | null
          resolvida_em?: string | null
          status?: string
          substituida_por_renegociacao_id?: string | null
          user_id: string
          valor_prometido?: number | null
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          cumprimento?: string | null
          data_prometida?: string
          id?: string
          observacao?: string | null
          promessa_anterior_id?: string | null
          resolvida_em?: string | null
          status?: string
          substituida_por_renegociacao_id?: string | null
          user_id?: string
          valor_prometido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_promessas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_promessas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_promessas_promessa_anterior_id_fkey"
            columns: ["promessa_anterior_id"]
            isOneToOne: false
            referencedRelation: "cobranca_promessas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_promessas_substituida_por_renegociacao_id_fkey"
            columns: ["substituida_por_renegociacao_id"]
            isOneToOne: false
            referencedRelation: "cobranca_renegociacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_regua_etapas: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          id: string
          offset_dias: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          id?: string
          offset_dias: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          id?: string
          offset_dias?: number
          updated_at?: string
        }
        Relationships: []
      }
      cobranca_renegociacoes: {
        Row: {
          cobranca_id: string
          created_at: string
          id: string
          inicio: string
          observacao: string | null
          status: string
          suspensa_ate: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cobranca_id: string
          created_at?: string
          id?: string
          inicio: string
          observacao?: string | null
          status?: string
          suspensa_ate?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cobranca_id?: string
          created_at?: string
          id?: string
          inicio?: string
          observacao?: string | null
          status?: string
          suspensa_ate?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_renegociacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_renegociacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          aluno_nome: string
          carteira_inicial: boolean
          carteira_inicial_desde: string | null
          created_at: string
          created_by: string | null
          encerrada_em: string | null
          etapa_atual_id: string | null
          id: string
          motivo_encerramento: string | null
          origem: string
          parcela_referencia_id: string | null
          proxima_acao_em: string | null
          proxima_acao_tipo: string | null
          responsavel_id: string | null
          sale_id: string
          situacao: string
          student_id: string | null
          ultima_acao_descricao: string | null
          ultima_acao_em: string | null
          updated_at: string
        }
        Insert: {
          aluno_nome: string
          carteira_inicial?: boolean
          carteira_inicial_desde?: string | null
          created_at?: string
          created_by?: string | null
          encerrada_em?: string | null
          etapa_atual_id?: string | null
          id?: string
          motivo_encerramento?: string | null
          origem?: string
          parcela_referencia_id?: string | null
          proxima_acao_em?: string | null
          proxima_acao_tipo?: string | null
          responsavel_id?: string | null
          sale_id: string
          situacao?: string
          student_id?: string | null
          ultima_acao_descricao?: string | null
          ultima_acao_em?: string | null
          updated_at?: string
        }
        Update: {
          aluno_nome?: string
          carteira_inicial?: boolean
          carteira_inicial_desde?: string | null
          created_at?: string
          created_by?: string | null
          encerrada_em?: string | null
          etapa_atual_id?: string | null
          id?: string
          motivo_encerramento?: string | null
          origem?: string
          parcela_referencia_id?: string | null
          proxima_acao_em?: string | null
          proxima_acao_tipo?: string | null
          responsavel_id?: string | null
          sale_id?: string
          situacao?: string
          student_id?: string | null
          ultima_acao_descricao?: string | null
          ultima_acao_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_etapa_atual_id_fkey"
            columns: ["etapa_atual_id"]
            isOneToOne: false
            referencedRelation: "cobranca_regua_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_parcela_referencia_id_fkey"
            columns: ["parcela_referencia_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_attempts: {
        Row: {
          cobranca_id: string | null
          created_at: string
          date: string
          etapa_id: string | null
          id: string
          installment_id: string
          method: string
          notes: string | null
          promessa_pagamento_em: string | null
          proximo_contato_em: string | null
          responsavel_id: string | null
          response: string | null
          resultado: string
          sale_id: string | null
          tipo_interacao: string
          updated_at: string
          user_id: string
          valor_prometido: number | null
        }
        Insert: {
          cobranca_id?: string | null
          created_at?: string
          date: string
          etapa_id?: string | null
          id?: string
          installment_id: string
          method: string
          notes?: string | null
          promessa_pagamento_em?: string | null
          proximo_contato_em?: string | null
          responsavel_id?: string | null
          response?: string | null
          resultado?: string
          sale_id?: string | null
          tipo_interacao?: string
          updated_at?: string
          user_id: string
          valor_prometido?: number | null
        }
        Update: {
          cobranca_id?: string | null
          created_at?: string
          date?: string
          etapa_id?: string | null
          id?: string
          installment_id?: string
          method?: string
          notes?: string | null
          promessa_pagamento_em?: string | null
          proximo_contato_em?: string | null
          responsavel_id?: string | null
          response?: string | null
          resultado?: string
          sale_id?: string | null
          tipo_interacao?: string
          updated_at?: string
          user_id?: string
          valor_prometido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_attempts_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_attempts_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas_painel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_attempts_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "cobranca_regua_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_attempts_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_attempts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          id: boolean
          logo_url: string | null
          nome_empresa: string | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          logo_url?: string | null
          nome_empresa?: string | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          logo_url?: string | null
          nome_empresa?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          boleto_url: string | null
          categoria: string
          comprovante_url: string | null
          conciliado: boolean
          conciliado_em: string | null
          conciliado_por: string | null
          created_at: string
          credor_id: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          installment_number: number | null
          installment_total: number | null
          mes_referencia: string | null
          observacoes: string | null
          recurrence_count: number | null
          recurrence_end_date: string | null
          recurrence_end_type: string | null
          recurrence_group_id: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          recurrence_unit: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
          valor_pago: number | null
          valor_total: number | null
        }
        Insert: {
          boleto_url?: string | null
          categoria: string
          comprovante_url?: string | null
          conciliado?: boolean
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          credor_id: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          mes_referencia?: string | null
          observacoes?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_end_type?: string | null
          recurrence_group_id?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_unit?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
          valor_pago?: number | null
          valor_total?: number | null
        }
        Update: {
          boleto_url?: string | null
          categoria?: string
          comprovante_url?: string | null
          conciliado?: boolean
          conciliado_em?: string | null
          conciliado_por?: string | null
          created_at?: string
          credor_id?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          mes_referencia?: string | null
          observacoes?: string | null
          recurrence_count?: number | null
          recurrence_end_date?: string | null
          recurrence_end_type?: string | null
          recurrence_group_id?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_unit?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
          valor_pago?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_juros: {
        Row: {
          categoria: string | null
          conta_pagar_id: string
          created_at: string
          credor_id: string | null
          data_pagamento: string
          data_vencimento: string | null
          descricao: string | null
          dias_atraso: number | null
          id: string
          observacoes: string | null
          user_id: string
          valor_juros: number
          valor_original: number
          valor_pago: number
        }
        Insert: {
          categoria?: string | null
          conta_pagar_id: string
          created_at?: string
          credor_id?: string | null
          data_pagamento: string
          data_vencimento?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          id?: string
          observacoes?: string | null
          user_id: string
          valor_juros?: number
          valor_original?: number
          valor_pago?: number
        }
        Update: {
          categoria?: string | null
          conta_pagar_id?: string
          created_at?: string
          credor_id?: string | null
          data_pagamento?: string
          data_vencimento?: string | null
          descricao?: string | null
          dias_atraso?: number | null
          id?: string
          observacoes?: string | null
          user_id?: string
          valor_juros?: number
          valor_original?: number
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_juros_conta_pagar_id_fkey"
            columns: ["conta_pagar_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      credores: {
        Row: {
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          status: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cursos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          instituicao: string | null
          nivel_ensino: string | null
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          instituicao?: string | null
          nivel_ensino?: string | null
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          instituicao?: string | null
          nivel_ensino?: string | null
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      grupos_repasse: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          porcentagem_empresa: number
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          porcentagem_empresa: number
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          porcentagem_empresa?: number
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string | null
          day: number | null
          day_weight: number
          id: string
          is_active: boolean
          is_facultative: boolean
          is_movable: boolean
          is_recurring: boolean
          legal_basis: string | null
          month: number | null
          movable_rule: string | null
          name: string
          scope: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          day?: number | null
          day_weight?: number
          id?: string
          is_active?: boolean
          is_facultative?: boolean
          is_movable?: boolean
          is_recurring?: boolean
          legal_basis?: string | null
          month?: number | null
          movable_rule?: string | null
          name: string
          scope?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string | null
          day?: number | null
          day_weight?: number
          id?: string
          is_active?: boolean
          is_facultative?: boolean
          is_movable?: boolean
          is_recurring?: boolean
          legal_basis?: string | null
          month?: number | null
          movable_rule?: string | null
          name?: string
          scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      installment_change_logs: {
        Row: {
          campo: string
          created_at: string
          descricao: string
          id: string
          installment_id: string
          user_id: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          descricao: string
          id?: string
          installment_id: string
          user_id: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          descricao?: string
          id?: string
          installment_id?: string
          user_id?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "installment_change_logs_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_juros: {
        Row: {
          created_at: string
          data_pagamento: string
          data_vencimento: string | null
          dias_atraso: number | null
          id: string
          installment_id: string
          metodo: string | null
          observacoes: string | null
          sale_id: string | null
          student_name: string | null
          user_id: string
          valor_juros: number
          valor_parcela: number
          valor_recebido: number
        }
        Insert: {
          created_at?: string
          data_pagamento: string
          data_vencimento?: string | null
          dias_atraso?: number | null
          id?: string
          installment_id: string
          metodo?: string | null
          observacoes?: string | null
          sale_id?: string | null
          student_name?: string | null
          user_id: string
          valor_juros: number
          valor_parcela: number
          valor_recebido: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          data_vencimento?: string | null
          dias_atraso?: number | null
          id?: string
          installment_id?: string
          metodo?: string | null
          observacoes?: string | null
          sale_id?: string | null
          student_name?: string | null
          user_id?: string
          valor_juros?: number
          valor_parcela?: number
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "installment_juros_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_payments: {
        Row: {
          created_at: string
          data_pagamento: string
          id: string
          installment_id: string
          metodo: string
          observacoes: string | null
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento: string
          id?: string
          installment_id: string
          metodo: string
          observacoes?: string | null
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          id?: string
          installment_id?: string
          metodo?: string
          observacoes?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "installment_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          company_value: number | null
          course: string
          created_at: string
          days_overdue: number | null
          due_date: string
          full_value: number | null
          id: string
          installment_number: number
          is_repasse: boolean | null
          negativado_spc: boolean
          negativado_spc_at: string | null
          notes: string | null
          paid_amount: number | null
          paid_date: string | null
          paid_method: string | null
          receipt: string | null
          sale_id: string
          status: string
          student_name: string
          total_installments: number
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          company_value?: number | null
          course: string
          created_at?: string
          days_overdue?: number | null
          due_date: string
          full_value?: number | null
          id?: string
          installment_number: number
          is_repasse?: boolean | null
          negativado_spc?: boolean
          negativado_spc_at?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          paid_method?: string | null
          receipt?: string | null
          sale_id: string
          status: string
          student_name: string
          total_installments: number
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          company_value?: number | null
          course?: string
          created_at?: string
          days_overdue?: number | null
          due_date?: string
          full_value?: number | null
          id?: string
          installment_number?: number
          is_repasse?: boolean | null
          negativado_spc?: boolean
          negativado_spc_at?: string | null
          notes?: string | null
          paid_amount?: number | null
          paid_date?: string | null
          paid_method?: string | null
          receipt?: string | null
          sale_id?: string
          status?: string
          student_name?: string
          total_installments?: number
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_campanha: {
        Row: {
          alunos_convertidos: number
          campanha_id: string
          categoria: string
          created_at: string
          data: string
          id: string
          leads: number
          plataforma: string
          updated_at: string
          user_id: string
          valor_gasto: number
        }
        Insert: {
          alunos_convertidos?: number
          campanha_id: string
          categoria: string
          created_at?: string
          data: string
          id?: string
          leads?: number
          plataforma: string
          updated_at?: string
          user_id: string
          valor_gasto?: number
        }
        Update: {
          alunos_convertidos?: number
          campanha_id?: string
          categoria?: string
          created_at?: string
          data?: string
          id?: string
          leads?: number
          plataforma?: string
          updated_at?: string
          user_id?: string
          valor_gasto?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_campanha_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_trafego"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          conteudo: string
          created_at: string
          data_mensagem: string
          id: string
          lead_id: string
          remetente: string
          sunchat_message_id: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string
          data_mensagem?: string
          id?: string
          lead_id: string
          remetente: string
          sunchat_message_id?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string
          data_mensagem?: string
          id?: string
          lead_id?: string
          remetente?: string
          sunchat_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          lead_id: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          lead_id: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          lead_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          cancelada: boolean
          completed_at: string | null
          completed_by: string | null
          concluida: boolean | null
          created_at: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          lead_id: string
          rechamada_ciclo: number | null
          rechamada_ordem: number | null
          tipo: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          cancelada?: boolean
          completed_at?: string | null
          completed_by?: string | null
          concluida?: boolean | null
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          lead_id: string
          rechamada_ciclo?: number | null
          rechamada_ordem?: number | null
          tipo?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          cancelada?: boolean
          completed_at?: string | null
          completed_by?: string | null
          concluida?: boolean | null
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          lead_id?: string
          rechamada_ciclo?: number | null
          rechamada_ordem?: number | null
          tipo?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          arquivado: boolean | null
          created_at: string
          curso_interesse: string | null
          data_entrada: string
          email: string | null
          empresa: string | null
          id: string
          nome: string
          origem: string
          status: string
          sunchat_id: string | null
          tags: string[] | null
          telefone: string | null
          updated_at: string
          user_id: string
          valor_estimado: number | null
          vendedor_id: string | null
        }
        Insert: {
          arquivado?: boolean | null
          created_at?: string
          curso_interesse?: string | null
          data_entrada?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          origem?: string
          status?: string
          sunchat_id?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Update: {
          arquivado?: boolean | null
          created_at?: string
          curso_interesse?: string | null
          data_entrada?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          origem?: string
          status?: string
          sunchat_id?: string | null
          tags?: string[] | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_gerais: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          periodo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          periodo?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          periodo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      metas_vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          periodo: string
          updated_at: string
          user_id: string
          valor: number
          vendedor_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          periodo?: string
          updated_at?: string
          user_id: string
          valor: number
          vendedor_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          periodo?: string
          updated_at?: string
          user_id?: string
          valor?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendedores_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          cliente_id: string | null
          cliente_nome: string | null
          created_at: string
          curso: string
          data: string | null
          descricao: string | null
          follow_up_1: string | null
          follow_up_2: string | null
          follow_ups: Json
          id: string
          status: string
          telefone: string | null
          user_id: string
          valor: number | null
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          curso: string
          data?: string | null
          descricao?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_ups?: Json
          id?: string
          status?: string
          telefone?: string | null
          user_id: string
          valor?: number | null
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nome?: string | null
          created_at?: string
          curso?: string
          data?: string | null
          descricao?: string | null
          follow_up_1?: string | null
          follow_up_2?: string | null
          follow_ups?: Json
          id?: string
          status?: string
          telefone?: string | null
          user_id?: string
          valor?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negocios_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_exclusions: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          reference_id: string
          reference_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          reference_id: string
          reference_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          reference_id?: string
          reference_type?: string
          user_id?: string
        }
        Relationships: []
      }
      recorrencias: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          credor_id: string
          descricao: string
          dia_vencimento: number
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          proxima_geracao: string
          recorrencia: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          credor_id: string
          descricao: string
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          proxima_geracao: string
          recorrencia?: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          credor_id?: string
          descricao?: string
          dia_vencimento?: number
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          proxima_geracao?: string
          recorrencia?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "recorrencias_credor_id_fkey"
            columns: ["credor_id"]
            isOneToOne: false
            referencedRelation: "credores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_change_logs: {
        Row: {
          changed_at: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          sale_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          sale_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          sale_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_change_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          aluno_inativado_inadimplencia: boolean
          amount: number
          boleto_gerado: boolean | null
          campanha_id: string | null
          course: string
          course_levels: string[] | null
          course_values: number[] | null
          created_at: string
          date: string
          down_payment_counts_in_company: boolean | null
          down_payment_counts_in_original: boolean | null
          duracao_curso_unidade: string | null
          duracao_curso_valor: number | null
          grupo_repasse_id: string | null
          id: string
          installments_down_payment: number | null
          installments_enabled: boolean | null
          installments_first_due_date: string | null
          installments_number: number | null
          installments_value: number | null
          nf_emitida: boolean
          nf_emitida_at: string | null
          observation: string | null
          origem_lead: string | null
          payment_mode: string
          porcentagem_aplicada: number | null
          previsao_conclusao: string | null
          quantity: number
          seller: string
          status: string
          student_name: string
          tipo_boleto: string | null
          updated_at: string
          user_id: string
          valor_empresa: number | null
          valor_total_boleto: number | null
          vendedor_id: string | null
        }
        Insert: {
          aluno_inativado_inadimplencia?: boolean
          amount: number
          boleto_gerado?: boolean | null
          campanha_id?: string | null
          course: string
          course_levels?: string[] | null
          course_values?: number[] | null
          created_at?: string
          date: string
          down_payment_counts_in_company?: boolean | null
          down_payment_counts_in_original?: boolean | null
          duracao_curso_unidade?: string | null
          duracao_curso_valor?: number | null
          grupo_repasse_id?: string | null
          id?: string
          installments_down_payment?: number | null
          installments_enabled?: boolean | null
          installments_first_due_date?: string | null
          installments_number?: number | null
          installments_value?: number | null
          nf_emitida?: boolean
          nf_emitida_at?: string | null
          observation?: string | null
          origem_lead?: string | null
          payment_mode: string
          porcentagem_aplicada?: number | null
          previsao_conclusao?: string | null
          quantity?: number
          seller: string
          status?: string
          student_name: string
          tipo_boleto?: string | null
          updated_at?: string
          user_id: string
          valor_empresa?: number | null
          valor_total_boleto?: number | null
          vendedor_id?: string | null
        }
        Update: {
          aluno_inativado_inadimplencia?: boolean
          amount?: number
          boleto_gerado?: boolean | null
          campanha_id?: string | null
          course?: string
          course_levels?: string[] | null
          course_values?: number[] | null
          created_at?: string
          date?: string
          down_payment_counts_in_company?: boolean | null
          down_payment_counts_in_original?: boolean | null
          duracao_curso_unidade?: string | null
          duracao_curso_valor?: number | null
          grupo_repasse_id?: string | null
          id?: string
          installments_down_payment?: number | null
          installments_enabled?: boolean | null
          installments_first_due_date?: string | null
          installments_number?: number | null
          installments_value?: number | null
          nf_emitida?: boolean
          nf_emitida_at?: string | null
          observation?: string | null
          origem_lead?: string | null
          payment_mode?: string
          porcentagem_aplicada?: number | null
          previsao_conclusao?: string | null
          quantity?: number
          seller?: string
          status?: string
          student_name?: string
          tipo_boleto?: string | null
          updated_at?: string
          user_id?: string
          valor_empresa?: number | null
          valor_total_boleto?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas_trafego"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_grupo_repasse_id_fkey"
            columns: ["grupo_repasse_id"]
            isOneToOne: false
            referencedRelation: "grupos_repasse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          academic_class: string
          academic_course: string
          academic_default_payment_mode: string
          academic_enrollment_date: string
          academic_status: string
          address_cep: string
          address_city: string
          address_complement: string | null
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          birth_date: string
          cpf: string
          created_at: string
          email: string
          financial_default_payment_mode: string | null
          financial_preferred_due_day: number | null
          financial_status: string | null
          full_name: string
          id: string
          observation: string | null
          phone: string
          photo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_class: string
          academic_course: string
          academic_default_payment_mode: string
          academic_enrollment_date: string
          academic_status: string
          address_cep: string
          address_city: string
          address_complement?: string | null
          address_neighborhood: string
          address_number: string
          address_state: string
          address_street: string
          birth_date: string
          cpf: string
          created_at?: string
          email: string
          financial_default_payment_mode?: string | null
          financial_preferred_due_day?: number | null
          financial_status?: string | null
          full_name: string
          id?: string
          observation?: string | null
          phone: string
          photo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_class?: string
          academic_course?: string
          academic_default_payment_mode?: string
          academic_enrollment_date?: string
          academic_status?: string
          address_cep?: string
          address_city?: string
          address_complement?: string | null
          address_neighborhood?: string
          address_number?: string
          address_state?: string
          address_street?: string
          birth_date?: string
          cpf?: string
          created_at?: string
          email?: string
          financial_default_payment_mode?: string | null
          financial_preferred_due_day?: number | null
          financial_status?: string | null
          full_name?: string
          id?: string
          observation?: string | null
          phone?: string
          photo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          restaurado_em: string | null
          restaurado_por: string | null
          searchable_text: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          restaurado_em?: string | null
          restaurado_por?: string | null
          searchable_text?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          restaurado_em?: string | null
          restaurado_por?: string | null
          searchable_text?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedores: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          email: string | null
          foto_url: string | null
          id: string
          nome: string
          sunchat_user_id: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          sunchat_user_id?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          email?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          sunchat_user_id?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      work_schedule: {
        Row: {
          created_at: string
          hours: number
          id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          hours?: number
          id?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          hours?: number
          id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: []
      }
    }
    Views: {
      cobrancas_painel: {
        Row: {
          aluno_nome: string | null
          carteira_inicial: boolean | null
          carteira_inicial_desde: string | null
          created_at: string | null
          created_by: string | null
          encerrada_em: string | null
          etapa_atual_id: string | null
          etapa_codigo: string | null
          id: string | null
          motivo_encerramento: string | null
          origem: string | null
          parcela_numero: number | null
          parcela_referencia_id: string | null
          parcela_valor: number | null
          parcela_vencimento: string | null
          parcelas_vencidas: number | null
          proxima_acao_em: string | null
          proxima_acao_tipo: string | null
          proxima_etapa_codigo: string | null
          responsavel_id: string | null
          sale_id: string | null
          situacao: string | null
          situacao_operacional: string | null
          student_id: string | null
          ultima_acao_descricao: string | null
          ultima_acao_em: string | null
          updated_at: string | null
          valor_vencido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_etapa_atual_id_fkey"
            columns: ["etapa_atual_id"]
            isOneToOne: false
            referencedRelation: "cobranca_regua_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_parcela_referencia_id_fkey"
            columns: ["parcela_referencia_id"]
            isOneToOne: false
            referencedRelation: "installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_access_cobranca: { Args: { _uid: string }; Returns: boolean }
      can_view_cobranca_historico_geral: {
        Args: { _uid: string }
        Returns: boolean
      }
      check_lead_telefone_duplicado: {
        Args: { _exclude_lead_id?: string; _telefone: string }
        Returns: {
          arquivado: boolean
          lead_id: string
          lead_nome: string
          vendedor_nome: string
        }[]
      }
      cobranca_acao_especial: {
        Args: {
          _cobranca: string
          _observacao?: string
          _status: string
          _tipo: string
        }
        Returns: string
      }
      cobranca_agendar_manual: {
        Args: {
          _cobranca: string
          _data: string
          _motivo?: string
          _tipo?: string
        }
        Returns: string
      }
      cobranca_cancelar_agendamento: {
        Args: { _agendamento: string; _motivo: string }
        Returns: undefined
      }
      cobranca_encerrar: {
        Args: { _cobranca: string; _motivo: string }
        Returns: undefined
      }
      cobranca_historico: {
        Args: { _cobranca: string }
        Returns: {
          automatico: boolean
          cobranca_id: string
          created_at: string
          dados: Json | null
          descricao: string | null
          id: string
          tipo: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "cobranca_eventos"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cobranca_hoje: { Args: never; Returns: string }
      cobranca_log: {
        Args: {
          _auto?: boolean
          _cobranca: string
          _dados?: Json
          _descricao: string
          _tipo: string
        }
        Returns: undefined
      }
      cobranca_reabrir: {
        Args: { _cobranca: string; _motivo: string }
        Returns: undefined
      }
      cobranca_recalcular: { Args: { _id: string }; Returns: undefined }
      cobranca_recalcular_interno: { Args: { _id: string }; Returns: undefined }
      cobranca_registrar_interacao: {
        Args: {
          _canal: string
          _cobranca: string
          _observacao?: string
          _resultado: string
          _tipo: string
        }
        Returns: string
      }
      cobranca_registrar_promessa: {
        Args: {
          _cobranca: string
          _data: string
          _observacao?: string
          _parcelas?: string[]
          _valor?: number
        }
        Returns: string
      }
      cobranca_registrar_renegociacao: {
        Args: {
          _cobranca: string
          _inicio: string
          _observacao?: string
          _suspensa_ate: string
        }
        Returns: string
      }
      cobranca_resolver_promessa: {
        Args: { _acao: string; _cobranca: string; _observacao?: string }
        Returns: undefined
      }
      cobranca_resolver_renegociacao: {
        Args: { _acao: string; _cobranca: string; _observacao?: string }
        Returns: undefined
      }
      cobranca_sincronizar: { Args: never; Returns: number }
      get_ranking_installments: {
        Args: never
        Returns: {
          company_value: number
          full_value: number
          id: string
          installment_number: number
          is_repasse: boolean
          paid_amount: number
          paid_date: string
          sale_id: string
          status: string
          value: number
        }[]
      }
      get_ranking_payments: {
        Args: never
        Returns: {
          data_pagamento: string
          id: string
          installment_id: string
          valor: number
        }[]
      }
      get_ranking_sales: {
        Args: never
        Returns: {
          id: string
          payment_mode: string
          seller: string
          status: string
          tipo_boleto: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_vendedores_basic: {
        Args: { _apenas_ativos?: boolean }
        Returns: {
          ativo: boolean
          created_at: string
          email: string
          foto_url: string
          id: string
          nome: string
          sunchat_user_id: string
          telefone: string
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_vendedor_of: { Args: { _vendedor_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      system_logs_restaurar: { Args: { _log_ids: string[] }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "gerente" | "vendedor" | "supervisor" | "financeiro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gerente", "vendedor", "supervisor", "financeiro"],
    },
  },
} as const
