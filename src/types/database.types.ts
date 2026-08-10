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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          lead_id: string
          next_action: string | null
          next_follow_up_at: string | null
          occurred_at: string | null
          referral_id: string | null
          scheduled_at: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          next_follow_up_at?: string | null
          occurred_at?: string | null
          referral_id?: string | null
          scheduled_at?: string | null
          title: string
          updated_at?: string
          visibility: string
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          next_follow_up_at?: string | null
          occurred_at?: string | null
          referral_id?: string | null
          scheduled_at?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_internal_notes: {
        Row: {
          lead_id: string
          note: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          lead_id: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          lead_id?: string
          note?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_internal_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_internal_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_no_sequences: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      lead_stage_history: {
        Row: {
          change_source: string
          changed_at: string
          changed_by: string | null
          from_stage: string | null
          id: string
          lead_id: string
          reason: string | null
          to_stage: string
        }
        Insert: {
          change_source: string
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          to_stage: string
        }
        Update: {
          change_source?: string
          changed_at?: string
          changed_by?: string | null
          from_stage?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          alternate_phone: string | null
          archived_at: string | null
          battery_interest: string | null
          building_type: string | null
          city: string
          competitor_offer_note: string | null
          competitor_offer_status: string | null
          created_at: string
          created_by: string
          customer_name: string
          customer_type: string
          deleted_at: string | null
          deleted_by: string | null
          district: string | null
          email: string | null
          estimated_capacity_kwp: number | null
          ev_interest: string | null
          first_call_user_id: string | null
          general_notes: string | null
          heat_pump_interest: string | null
          id: string
          lead_no: string | null
          lead_score: string | null
          next_follow_up_at: string | null
          owner_id: string
          phone: string
          pool_interest: string | null
          priority: string
          roof_area_m2: number | null
          sales_user_id: string | null
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          alternate_phone?: string | null
          archived_at?: string | null
          battery_interest?: string | null
          building_type?: string | null
          city: string
          competitor_offer_note?: string | null
          competitor_offer_status?: string | null
          created_at?: string
          created_by: string
          customer_name: string
          customer_type: string
          deleted_at?: string | null
          deleted_by?: string | null
          district?: string | null
          email?: string | null
          estimated_capacity_kwp?: number | null
          ev_interest?: string | null
          first_call_user_id?: string | null
          general_notes?: string | null
          heat_pump_interest?: string | null
          id?: string
          lead_no?: string | null
          lead_score?: string | null
          next_follow_up_at?: string | null
          owner_id: string
          phone: string
          pool_interest?: string | null
          priority?: string
          roof_area_m2?: number | null
          sales_user_id?: string | null
          source: string
          stage?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          alternate_phone?: string | null
          archived_at?: string | null
          battery_interest?: string | null
          building_type?: string | null
          city?: string
          competitor_offer_note?: string | null
          competitor_offer_status?: string | null
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_type?: string
          deleted_at?: string | null
          deleted_by?: string | null
          district?: string | null
          email?: string | null
          estimated_capacity_kwp?: number | null
          ev_interest?: string | null
          first_call_user_id?: string | null
          general_notes?: string | null
          heat_pump_interest?: string | null
          id?: string
          lead_no?: string | null
          lead_score?: string | null
          next_follow_up_at?: string | null
          owner_id?: string
          phone?: string
          pool_interest?: string | null
          priority?: string
          roof_area_m2?: number | null
          sales_user_id?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_first_call_user_id_fkey"
            columns: ["first_call_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dedup_key: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string | null
          priority: string
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          dedup_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          priority?: string
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          dedup_key?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string | null
          priority?: string
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_versions: {
        Row: {
          amount: number
          capacity_kwp: number
          created_at: string
          created_by: string
          currency: string
          id: string
          offer_id: string
          revision_no: number
          scope_summary: string | null
          sent_at: string | null
          status: string
          valid_until: string | null
          vat_included: boolean
        }
        Insert: {
          amount: number
          capacity_kwp: number
          created_at?: string
          created_by: string
          currency: string
          id?: string
          offer_id: string
          revision_no: number
          scope_summary?: string | null
          sent_at?: string | null
          status?: string
          valid_until?: string | null
          vat_included?: boolean
        }
        Update: {
          amount?: number
          capacity_kwp?: number
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          offer_id?: string
          revision_no?: number
          scope_summary?: string | null
          sent_at?: string | null
          status?: string
          valid_until?: string | null
          vat_included?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "offer_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_versions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          created_by: string
          created_by_organization_type: string
          id: string
          lead_id: string
          offer_no: string
          referral_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          created_by_organization_type: string
          id?: string
          lead_id: string
          offer_no: string
          referral_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          created_by_organization_type?: string
          id?: string
          lead_id?: string
          offer_no?: string
          referral_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_capabilities: {
        Row: {
          capability_code: string
          partner_id: string
        }
        Insert: {
          capability_code: string
          partner_id: string
        }
        Update: {
          capability_code?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_capabilities_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_internal_notes: {
        Row: {
          note: string | null
          partner_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          note?: string | null
          partner_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          note?: string | null
          partner_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_internal_notes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_internal_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          assigned_employee_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string
          partner_id: string
          referred_by: string | null
          rejection_reason: string | null
          responded_at: string | null
          responded_by: string | null
          response_due_at: string
          sent_at: string
          share_note: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_employee_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id: string
          partner_id: string
          referred_by?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_due_at: string
          sent_at?: string
          share_note?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_employee_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          partner_id?: string
          referred_by?: string | null
          rejection_reason?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response_due_at?: string
          sent_at?: string
          share_note?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_assigned_employee_id_fkey"
            columns: ["assigned_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_service_regions: {
        Row: {
          partner_id: string
          region_code: string
        }
        Insert: {
          partner_id: string
          region_code: string
        }
        Update: {
          partner_id?: string
          region_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_service_regions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          partner_code: string | null
          phone: string | null
          pv_owner_id: string | null
          status: string
          tax_number: string | null
          tax_office: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          partner_code?: string | null
          phone?: string | null
          pv_owner_id?: string | null
          status?: string
          tax_number?: string | null
          tax_office?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          partner_code?: string | null
          phone?: string | null
          pv_owner_id?: string | null
          status?: string
          tax_number?: string | null
          tax_office?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_pv_owner_id_fkey"
            columns: ["pv_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          partner_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          partner_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          partner_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_outcomes: {
        Row: {
          accepted_offer_version_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          erp_order_number: string | null
          final_amount: number | null
          id: string
          lead_id: string
          lost_reason: string | null
          lost_reason_detail: string | null
          material_purchase_status: string | null
          notes: string | null
          outcome: string
          partner_performance_impact: boolean | null
          performance_impact_reason: string | null
          referral_id: string | null
          result_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_offer_version_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          erp_order_number?: string | null
          final_amount?: number | null
          id?: string
          lead_id: string
          lost_reason?: string | null
          lost_reason_detail?: string | null
          material_purchase_status?: string | null
          notes?: string | null
          outcome: string
          partner_performance_impact?: boolean | null
          performance_impact_reason?: string | null
          referral_id?: string | null
          result_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_offer_version_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          erp_order_number?: string | null
          final_amount?: number | null
          id?: string
          lead_id?: string
          lost_reason?: string | null
          lost_reason_detail?: string | null
          material_purchase_status?: string | null
          notes?: string | null
          outcome?: string
          partner_performance_impact?: boolean | null
          performance_impact_reason?: string | null
          referral_id?: string | null
          result_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_outcomes_accepted_offer_version_id_fkey"
            columns: ["accepted_offer_version_id"]
            isOneToOne: false
            referencedRelation: "offer_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_outcomes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_outcomes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_outcomes_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_outcomes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_role_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_lead_to_partner: {
        Args: {
          p_employee_id?: string
          p_lead_id: string
          p_partner_id: string
          p_response_due_at?: string
          p_share_note?: string
        }
        Returns: {
          assigned_employee_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string
          partner_id: string
          referred_by: string | null
          rejection_reason: string | null
          responded_at: string | null
          responded_by: string | null
          response_due_at: string
          sent_at: string
          share_note: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "partner_referrals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      assign_lead_to_sales: {
        Args: { p_lead_id: string; p_sales_user_id: string }
        Returns: {
          address: string | null
          alternate_phone: string | null
          archived_at: string | null
          battery_interest: string | null
          building_type: string | null
          city: string
          competitor_offer_note: string | null
          competitor_offer_status: string | null
          created_at: string
          created_by: string
          customer_name: string
          customer_type: string
          deleted_at: string | null
          deleted_by: string | null
          district: string | null
          email: string | null
          estimated_capacity_kwp: number | null
          ev_interest: string | null
          first_call_user_id: string | null
          general_notes: string | null
          heat_pump_interest: string | null
          id: string
          lead_no: string | null
          lead_score: string | null
          next_follow_up_at: string | null
          owner_id: string
          phone: string
          pool_interest: string | null
          priority: string
          roof_area_m2: number | null
          sales_user_id: string | null
          source: string
          stage: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_duplicate_leads_by_phone: {
        Args: { p_phone: string }
        Returns: {
          created_at: string
          customer_name: string
          id: string
          lead_no: string
          stage: string
        }[]
      }
      record_sales_outcome: {
        Args: {
          p_accepted_offer_version_id?: string
          p_currency?: string
          p_final_amount?: number
          p_lead_id: string
          p_lost_reason?: string
          p_lost_reason_detail?: string
          p_notes?: string
          p_outcome: string
          p_result_date?: string
        }
        Returns: {
          accepted_offer_version_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          erp_order_number: string | null
          final_amount: number | null
          id: string
          lead_id: string
          lost_reason: string | null
          lost_reason_detail: string | null
          material_purchase_status: string | null
          notes: string | null
          outcome: string
          partner_performance_impact: boolean | null
          performance_impact_reason: string | null
          referral_id: string | null
          result_date: string
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "sales_outcomes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      respond_to_referral: {
        Args: {
          p_decision: string
          p_referral_id: string
          p_rejection_reason?: string
        }
        Returns: {
          assigned_employee_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          lead_id: string
          partner_id: string
          referred_by: string | null
          rejection_reason: string | null
          responded_at: string | null
          responded_by: string | null
          response_due_at: string
          sent_at: string
          share_note: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "partner_referrals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_active: {
        Args: { p_is_active: boolean; p_user_id: string }
        Returns: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          partner_id: string | null
          phone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_role_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      soft_delete_lead: {
        Args: { p_lead_id: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "pv_admin"
        | "pv_sales"
        | "partner_admin"
        | "partner_employee"
        | "first_call"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "pv_admin",
        "pv_sales",
        "partner_admin",
        "partner_employee",
        "first_call",
      ],
    },
  },
} as const
