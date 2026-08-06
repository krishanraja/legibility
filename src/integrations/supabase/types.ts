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
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_four: string
          last_used_at: string | null
          name: string
          prefix: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_four: string
          last_used_at?: string | null
          name?: string
          prefix: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_four?: string
          last_used_at?: string | null
          name?: string
          prefix?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: number
          meta: Json
          target: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: number
          meta?: Json
          target?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: number
          meta?: Json
          target?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          hosted_url: string | null
          id: string
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          status: string
          stripe_invoice_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          hosted_url?: string | null
          id?: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status: string
          stripe_invoice_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          hosted_url?: string | null
          id?: string
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          status?: string
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          burst_per_sec: number
          created_at: string
          features: Json
          id: string
          included_calls: number
          name: string
          overage_cents_per_call: number
          price_cents: number
          rate_per_sec: number
          sort_order: number
          stripe_price_id: string | null
        }
        Insert: {
          active?: boolean
          burst_per_sec?: number
          created_at?: string
          features?: Json
          id: string
          included_calls?: number
          name: string
          overage_cents_per_call?: number
          price_cents?: number
          rate_per_sec?: number
          sort_order?: number
          stripe_price_id?: string | null
        }
        Update: {
          active?: boolean
          burst_per_sec?: number
          created_at?: string
          features?: Json
          id?: string
          included_calls?: number
          name?: string
          overage_cents_per_call?: number
          price_cents?: number
          rate_per_sec?: number
          sort_order?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      golden_eval_runs: {
        Row: {
          id: string
          created_at: string
          calibration_version: string | null
          split: string | null
          n: number | null
          precision_at_gate: number | null
          precision_wilson_low: number | null
          adversarial_rejection: number | null
          ece: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          calibration_version?: string | null
          split?: string | null
          n?: number | null
          precision_at_gate?: number | null
          precision_wilson_low?: number | null
          adversarial_rejection?: number | null
          ece?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          calibration_version?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      outcome_reports: {
        Row: {
          id: string
          created_at: string
          user_id: string
          request_id: string | null
          legibility_id: string | null
          outcome: string
          observed_price: number | null
          observed_currency: string | null
          note: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          request_id?: string | null
          legibility_id?: string | null
          outcome: string
          observed_price?: number | null
          observed_currency?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          request_id?: string | null
          legibility_id?: string | null
          outcome?: string
          observed_price?: number | null
          observed_currency?: string | null
          note?: string | null
        }
        Relationships: []
      }
      product_cache: {
        Row: {
          cache_key: string
          confidence: number
          created_by: string | null
          expires_at: string
          fetched_at: string
          gtin: string | null
          id: string
          method: string
          product: Json
          takedown: boolean
          url: string | null
        }
        Insert: {
          cache_key: string
          confidence: number
          created_by?: string | null
          expires_at: string
          fetched_at?: string
          gtin?: string | null
          id?: string
          method: string
          product: Json
          takedown?: boolean
          url?: string | null
        }
        Update: {
          cache_key?: string
          confidence?: number
          created_by?: string | null
          expires_at?: string
          fetched_at?: string
          gtin?: string | null
          id?: string
          method?: string
          product?: Json
          takedown?: boolean
          url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          approved_at: string | null
          company: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      resolutions: {
        Row: {
          completed_at: string | null
          confidence: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          input: Json
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input: Json
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          confidence?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      takedown_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
          reason: string
          resolved_at: string | null
          status: string
          url: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
          reason: string
          resolved_at?: string | null
          status?: string
          url: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          api_key_id: string | null
          cached: boolean
          cost_usd: number
          created_at: string
          endpoint: string | null
          id: number
          latency_ms: number | null
          meta: Json
          request_id: string | null
          confidence: number | null
          product_returned: boolean | null
          billable: boolean
          domain: string | null
          envelope_hash: string | null
          calibration_version: string | null
          status: number
          tool: string
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          cached?: boolean
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          id?: number
          latency_ms?: number | null
          meta?: Json
          request_id?: string | null
          confidence?: number | null
          product_returned?: boolean | null
          billable?: boolean
          domain?: string | null
          envelope_hash?: string | null
          calibration_version?: string | null
          status?: number
          tool: string
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          cached?: boolean
          cost_usd?: number
          created_at?: string
          endpoint?: string | null
          id?: number
          latency_ms?: number | null
          meta?: Json
          request_id?: string | null
          confidence?: number | null
          product_returned?: boolean | null
          billable?: boolean
          domain?: string | null
          envelope_hash?: string | null
          calibration_version?: string | null
          status?: number
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
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
      waitlist: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          source: string | null
          status: string
          use_case: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          source?: string | null
          status?: string
          use_case?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          source?: string | null
          status?: string
          use_case?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempt: number
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          next_retry_at: string | null
          payload: Json
          status_code: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          status_code?: number | null
          success?: boolean
          webhook_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json
          status_code?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          last_delivery_at: string | null
          last_status: number | null
          secret: string
          url: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_status?: number | null
          secret: string
          url: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          last_delivery_at?: string | null
          last_status?: number | null
          secret?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      entitlement_check: {
        Args: { _user_id: string }
        Returns: {
          allowed: boolean
          reason: string
          plan_id: string
          included_calls: number
          used_billable: number
          cost_spent_cents: number
        }[]
      }
      northstar_weekly: {
        Args: { _since?: string }
        Returns: {
          user_id: string
          week: string
          trusted_reads: number
          total_calls: number
        }[]
      }
      trust_rate_by_method: {
        Args: { _since?: string }
        Returns: {
          method: string
          calls: number
          gate_pass: number
          gate_pass_rate: number
        }[]
      }
      kill_dashboard: {
        Args: Record<string, never>
        Returns: {
          signal: string
          value: number | null
          red_threshold: string
          status: string
        }[]
      }
      rate_check: {
        Args: { _user_id: string }
        Returns: {
          allowed: boolean
          lim: number
          reset_seconds: number
          used: number
        }[]
      }
      usage_current_period: {
        Args: { _user_id?: string }
        Returns: {
          cached_calls: number
          calls: number
          cost_usd: number
          live_calls: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
