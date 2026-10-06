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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      affiliate_applications: {
        Row: {
          contact_consent: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          main_site_inquiry_id: string | null
          phone: string | null
          preferred_locale: Database["public"]["Enums"]["app_locale"]
          promotion_plan: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          contact_consent: boolean
          created_at?: string
          email: string
          full_name: string
          id?: string
          main_site_inquiry_id?: string | null
          phone?: string | null
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          promotion_plan?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          contact_consent?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          main_site_inquiry_id?: string | null
          phone?: string | null
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          promotion_plan?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: []
      }
      affiliate_codes: {
        Row: {
          activated_at: string | null
          affiliate_id: string
          code: string
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
        }
        Insert: {
          activated_at?: string | null
          affiliate_id: string
          code: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
        }
        Update: {
          activated_at?: string | null
          affiliate_id?: string
          code?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_codes_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_profiles: {
        Row: {
          activated_at: string | null
          application_id: string | null
          created_at: string
          email: string
          email_normalized: string | null
          full_name: string
          id: string
          payout_details: string | null
          payout_method: string | null
          phone: string | null
          phone_last8: string | null
          preferred_locale: Database["public"]["Enums"]["app_locale"]
          status: Database["public"]["Enums"]["affiliate_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          application_id?: string | null
          created_at?: string
          email: string
          email_normalized?: string | null
          full_name: string
          id?: string
          payout_details?: string | null
          payout_method?: string | null
          phone?: string | null
          phone_last8?: string | null
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          application_id?: string | null
          created_at?: string
          email?: string
          email_normalized?: string | null
          full_name?: string
          id?: string
          payout_details?: string | null
          payout_method?: string | null
          phone?: string | null
          phone_last8?: string | null
          preferred_locale?: Database["public"]["Enums"]["app_locale"]
          status?: Database["public"]["Enums"]["affiliate_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_profiles_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "affiliate_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_signups: {
        Row: {
          affiliate_id: string | null
          attribution_method:
            | Database["public"]["Enums"]["attribution_method"]
            | null
          code_id: string | null
          commission_amount: number | null
          commission_rate: number | null
          commission_status: Database["public"]["Enums"]["commission_status"]
          created_at: string
          customer_ended_at: string | null
          customer_started_at: string | null
          email: string
          email_normalized: string | null
          first_month_net_rent: number | null
          forfeit_reason: string | null
          full_name: string
          id: string
          ineligible_reason: string | null
          main_site_inquiry_id: string
          outbound_completed_at: string | null
          paid_at: string | null
          payout_due_at: string | null
          payout_reference: string | null
          phone: string | null
          phone_last8: string | null
          qualified_at: string | null
          quote: Json
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["signup_status"]
          submitted_at: string
          tier_name: string | null
          updated_at: string
        }
        Insert: {
          affiliate_id?: string | null
          attribution_method?:
            | Database["public"]["Enums"]["attribution_method"]
            | null
          code_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          commission_status?: Database["public"]["Enums"]["commission_status"]
          created_at?: string
          customer_ended_at?: string | null
          customer_started_at?: string | null
          email: string
          email_normalized?: string | null
          first_month_net_rent?: number | null
          forfeit_reason?: string | null
          full_name: string
          id?: string
          ineligible_reason?: string | null
          main_site_inquiry_id: string
          outbound_completed_at?: string | null
          paid_at?: string | null
          payout_due_at?: string | null
          payout_reference?: string | null
          phone?: string | null
          phone_last8?: string | null
          qualified_at?: string | null
          quote?: Json
          source: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["signup_status"]
          submitted_at: string
          tier_name?: string | null
          updated_at?: string
        }
        Update: {
          affiliate_id?: string | null
          attribution_method?:
            | Database["public"]["Enums"]["attribution_method"]
            | null
          code_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          commission_status?: Database["public"]["Enums"]["commission_status"]
          created_at?: string
          customer_ended_at?: string | null
          customer_started_at?: string | null
          email?: string
          email_normalized?: string | null
          first_month_net_rent?: number | null
          forfeit_reason?: string | null
          full_name?: string
          id?: string
          ineligible_reason?: string | null
          main_site_inquiry_id?: string
          outbound_completed_at?: string | null
          paid_at?: string | null
          payout_due_at?: string | null
          payout_reference?: string | null
          phone?: string | null
          phone_last8?: string | null
          qualified_at?: string | null
          quote?: Json
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["signup_status"]
          submitted_at?: string
          tier_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_signups_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_signups_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "affiliate_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
        }
        Relationships: []
      }
      commission_tiers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          max_qualified: number | null
          min_qualified: number
          name: string
          rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_qualified?: number | null
          min_qualified: number
          name: string
          rate: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          max_qualified?: number | null
          min_qualified?: number
          name?: string
          rate?: number
        }
        Relationships: []
      }
      onboarding_sends: {
        Row: {
          affiliate_id: string
          id: string
          provider_message_id: string | null
          sent_at: string
          sent_by: string | null
          template_id: string
        }
        Insert: {
          affiliate_id: string
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          sent_by?: string | null
          template_id: string
        }
        Update: {
          affiliate_id?: string
          id?: string
          provider_message_id?: string | null
          sent_at?: string
          sent_by?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_sends_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_templates: {
        Row: {
          body_md: string
          created_at: string
          id: string
          is_current: boolean
          locale: Database["public"]["Enums"]["app_locale"]
          subject: string
          version: string
        }
        Insert: {
          body_md: string
          created_at?: string
          id?: string
          is_current?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          subject: string
          version: string
        }
        Update: {
          body_md?: string
          created_at?: string
          id?: string
          is_current?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          subject?: string
          version?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          affiliate_id: string
          governing_terms_version_id: string | null
          id: string
          ip_address: unknown
          locale_shown: Database["public"]["Enums"]["app_locale"]
          terms_version_id: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          affiliate_id: string
          governing_terms_version_id?: string | null
          id?: string
          ip_address?: unknown
          locale_shown?: Database["public"]["Enums"]["app_locale"]
          terms_version_id: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          affiliate_id?: string
          governing_terms_version_id?: string | null
          id?: string
          ip_address?: unknown
          locale_shown?: Database["public"]["Enums"]["app_locale"]
          terms_version_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliate_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptances_governing_terms_version_id_fkey"
            columns: ["governing_terms_version_id"]
            isOneToOne: false
            referencedRelation: "terms_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptances_terms_version_id_fkey"
            columns: ["terms_version_id"]
            isOneToOne: false
            referencedRelation: "terms_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_versions: {
        Row: {
          body_md: string
          id: string
          is_current: boolean
          locale: Database["public"]["Enums"]["app_locale"]
          published_at: string
          version: string
        }
        Insert: {
          body_md: string
          id?: string
          is_current?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          published_at?: string
          version: string
        }
        Update: {
          body_md?: string
          id?: string
          is_current?: boolean
          locale?: Database["public"]["Enums"]["app_locale"]
          published_at?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_current_terms: {
        Args: {
          p_ip_address?: unknown
          p_locale: Database["public"]["Enums"]["app_locale"]
          p_user_agent?: string
        }
        Returns: undefined
      }
      create_affiliate_from_application: {
        Args: {
          p_application_id: string
          p_reviewer_id: string
          p_user_id: string
        }
        Returns: string
      }
      current_affiliate_id: { Args: never; Returns: string }
      generate_affiliate_code: { Args: never; Returns: string }
      get_current_terms: {
        Args: { p_locale: Database["public"]["Enums"]["app_locale"] }
        Returns: {
          body_md: string
          governing_id: string
          id: string
          locale: Database["public"]["Enums"]["app_locale"]
          version: string
        }[]
      }
      get_my_signups: {
        Args: never
        Returns: {
          attribution_method: Database["public"]["Enums"]["attribution_method"]
          commission_amount: number
          commission_rate: number
          commission_status: Database["public"]["Enums"]["commission_status"]
          customer_ended_at: string
          customer_started_at: string
          duration_days: number
          id: string
          masked_email: string
          masked_name: string
          masked_phone: string
          paid_at: string
          payout_due_at: string
          qualified_at: string
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["signup_status"]
          submitted_at: string
        }[]
      }
      ingest_lead: {
        Args: {
          p_code: string
          p_email: string
          p_full_name: string
          p_link_clicked_at?: string
          p_main_site_inquiry_id: string
          p_method: Database["public"]["Enums"]["attribution_method"]
          p_phone: string
          p_quote: Json
          p_source: Database["public"]["Enums"]["lead_source"]
          p_submitted_at: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      mask_email: { Args: { email: string }; Returns: string }
      mask_name: { Args: { full_name: string }; Returns: string }
      mask_phone: { Args: { phone: string }; Returns: string }
      publish_onboarding_template: {
        Args: {
          p_body_md: string
          p_locale: Database["public"]["Enums"]["app_locale"]
          p_subject: string
          p_version: string
        }
        Returns: string
      }
      publish_terms_version: {
        Args: {
          p_body_md: string
          p_locale: Database["public"]["Enums"]["app_locale"]
          p_version: string
        }
        Returns: string
      }
      qualify_signup: {
        Args: { p_signup_id: string }
        Returns: {
          affiliate_id: string | null
          attribution_method:
            | Database["public"]["Enums"]["attribution_method"]
            | null
          code_id: string | null
          commission_amount: number | null
          commission_rate: number | null
          commission_status: Database["public"]["Enums"]["commission_status"]
          created_at: string
          customer_ended_at: string | null
          customer_started_at: string | null
          email: string
          email_normalized: string | null
          first_month_net_rent: number | null
          forfeit_reason: string | null
          full_name: string
          id: string
          ineligible_reason: string | null
          main_site_inquiry_id: string
          outbound_completed_at: string | null
          paid_at: string | null
          payout_due_at: string | null
          payout_reference: string | null
          phone: string | null
          phone_last8: string | null
          qualified_at: string | null
          quote: Json
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["signup_status"]
          submitted_at: string
          tier_name: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "affiliate_signups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_my_locale: {
        Args: { p_locale: Database["public"]["Enums"]["app_locale"] }
        Returns: undefined
      }
    }
    Enums: {
      affiliate_status: "invited" | "active" | "suspended" | "terminated"
      app_locale: "en" | "zh-Hans"
      app_role: "admin" | "affiliate"
      application_status: "pending" | "approved" | "rejected"
      attribution_method: "link" | "promo_code"
      commission_status:
        | "pending"
        | "qualified"
        | "paid"
        | "forfeited"
        | "ineligible"
      lead_source: "contact_form" | "calculator"
      signup_status: "lead" | "contacted" | "customer" | "moved_out" | "lost"
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
      affiliate_status: ["invited", "active", "suspended", "terminated"],
      app_locale: ["en", "zh-Hans"],
      app_role: ["admin", "affiliate"],
      application_status: ["pending", "approved", "rejected"],
      attribution_method: ["link", "promo_code"],
      commission_status: [
        "pending",
        "qualified",
        "paid",
        "forfeited",
        "ineligible",
      ],
      lead_source: ["contact_form", "calculator"],
      signup_status: ["lead", "contacted", "customer", "moved_out", "lost"],
    },
  },
} as const
