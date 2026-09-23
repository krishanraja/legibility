export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string;
          id: string;
          key_hash: string;
          last_four: string;
          last_used_at: string | null;
          name: string;
          prefix: string;
          revoked_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key_hash: string;
          last_four: string;
          last_used_at?: string | null;
          name?: string;
          prefix: string;
          revoked_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          key_hash?: string;
          last_four?: string;
          last_used_at?: string | null;
          name?: string;
          prefix?: string;
          revoked_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          id: number;
          meta: Json;
          target: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          id?: number;
          meta?: Json;
          target?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          id?: number;
          meta?: Json;
          target?: string | null;
        };
        Relationships: [];
      };
      check_captures: {
        Row: {
          captured_at: string;
          check_id: string;
          email: string;
          id: string;
        };
        Insert: {
          captured_at?: string;
          check_id: string;
          email: string;
          id?: string;
        };
        Update: {
          captured_at?: string;
          check_id?: string;
          email?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "check_captures_check_id_fkey";
            columns: ["check_id"];
            isOneToOne: false;
            referencedRelation: "domain_checks";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_checks: {
        Row: {
          captured_at: string;
          checked_at: string;
          detail: string | null;
          envelope_hash: string;
          failure_reason: string | null;
          host: string;
          http_status: number | null;
          id: string;
          method: string;
          readable: boolean;
        };
        Insert: {
          captured_at?: string;
          checked_at: string;
          detail?: string | null;
          envelope_hash: string;
          failure_reason?: string | null;
          host: string;
          http_status?: number | null;
          id?: string;
          method?: string;
          readable: boolean;
        };
        Update: {
          captured_at?: string;
          checked_at?: string;
          detail?: string | null;
          envelope_hash?: string;
          failure_reason?: string | null;
          host?: string;
          http_status?: number | null;
          id?: string;
          method?: string;
          readable?: boolean;
        };
        Relationships: [];
      };
      golden_eval_runs: {
        Row: {
          adversarial_rejection: number | null;
          calibration_version: string | null;
          created_at: string;
          ece: number | null;
          id: string;
          n: number | null;
          notes: string | null;
          precision_at_gate: number | null;
          precision_wilson_low: number | null;
          recall_gtin: number | null;
          recall_jsonld: number | null;
          recall_shopify: number | null;
          split: string | null;
        };
        Insert: {
          adversarial_rejection?: number | null;
          calibration_version?: string | null;
          created_at?: string;
          ece?: number | null;
          id?: string;
          n?: number | null;
          notes?: string | null;
          precision_at_gate?: number | null;
          precision_wilson_low?: number | null;
          recall_gtin?: number | null;
          recall_jsonld?: number | null;
          recall_shopify?: number | null;
          split?: string | null;
        };
        Update: {
          adversarial_rejection?: number | null;
          calibration_version?: string | null;
          created_at?: string;
          ece?: number | null;
          id?: string;
          n?: number | null;
          notes?: string | null;
          precision_at_gate?: number | null;
          precision_wilson_low?: number | null;
          recall_gtin?: number | null;
          recall_jsonld?: number | null;
          recall_shopify?: number | null;
          split?: string | null;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          hosted_url: string | null;
          id: string;
          pdf_url: string | null;
          period_end: string | null;
          period_start: string | null;
          status: string;
          stripe_invoice_id: string | null;
          user_id: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          hosted_url?: string | null;
          id?: string;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status: string;
          stripe_invoice_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          hosted_url?: string | null;
          id?: string;
          pdf_url?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          status?: string;
          stripe_invoice_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      observations: {
        Row: {
          cohort: string;
          confidence: number | null;
          cost_usd: number;
          domain: string;
          envelope_hash: string;
          failure_reason: string | null;
          http_status: number | null;
          id: string;
          method: string;
          observed_at: string;
          readable: boolean;
          robots_allowed: boolean;
          run_id: string;
          target: string;
        };
        Insert: {
          cohort: string;
          confidence?: number | null;
          cost_usd?: number;
          domain: string;
          envelope_hash: string;
          failure_reason?: string | null;
          http_status?: number | null;
          id?: string;
          method?: string;
          observed_at?: string;
          readable: boolean;
          robots_allowed: boolean;
          run_id: string;
          target: string;
        };
        Update: {
          cohort?: string;
          confidence?: number | null;
          cost_usd?: number;
          domain?: string;
          envelope_hash?: string;
          failure_reason?: string | null;
          http_status?: number | null;
          id?: string;
          method?: string;
          observed_at?: string;
          readable?: boolean;
          robots_allowed?: boolean;
          run_id?: string;
          target?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observations_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "sweep_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      ops_alerts: {
        Row: {
          created_at: string;
          day: string | null;
          delivered: boolean;
          detail: string | null;
          id: string;
          kind: string;
          value: number | null;
        };
        Insert: {
          created_at?: string;
          day?: string | null;
          delivered?: boolean;
          detail?: string | null;
          id?: string;
          kind: string;
          value?: number | null;
        };
        Update: {
          created_at?: string;
          day?: string | null;
          delivered?: boolean;
          detail?: string | null;
          id?: string;
          kind?: string;
          value?: number | null;
        };
        Relationships: [];
      };
      ops_daily: {
        Row: {
          active_accounts: number;
          avg_latency_ms: number | null;
          computed_at: string;
          day: string;
          error_calls: number;
          total_calls: number;
          total_cost_usd: number | null;
          trust_rate: number | null;
          trusted_reads: number;
        };
        Insert: {
          active_accounts?: number;
          avg_latency_ms?: number | null;
          computed_at?: string;
          day: string;
          error_calls?: number;
          total_calls?: number;
          total_cost_usd?: number | null;
          trust_rate?: number | null;
          trusted_reads?: number;
        };
        Update: {
          active_accounts?: number;
          avg_latency_ms?: number | null;
          computed_at?: string;
          day?: string;
          error_calls?: number;
          total_calls?: number;
          total_cost_usd?: number | null;
          trust_rate?: number | null;
          trusted_reads?: number;
        };
        Relationships: [];
      };
      outcome_reports: {
        Row: {
          created_at: string;
          id: string;
          legibility_id: string | null;
          note: string | null;
          observed_currency: string | null;
          observed_price: number | null;
          outcome: string;
          request_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          legibility_id?: string | null;
          note?: string | null;
          observed_currency?: string | null;
          observed_price?: number | null;
          outcome: string;
          request_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          legibility_id?: string | null;
          note?: string | null;
          observed_currency?: string | null;
          observed_price?: number | null;
          outcome?: string;
          request_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          active: boolean;
          burst_per_sec: number;
          created_at: string;
          features: Json;
          id: string;
          included_calls: number;
          name: string;
          overage_cents_per_call: number;
          price_cents: number;
          rate_per_sec: number;
          sort_order: number;
          stripe_price_id: string | null;
          tagline: string | null;
        };
        Insert: {
          active?: boolean;
          burst_per_sec?: number;
          created_at?: string;
          features?: Json;
          id: string;
          included_calls?: number;
          name: string;
          overage_cents_per_call?: number;
          price_cents?: number;
          rate_per_sec?: number;
          sort_order?: number;
          stripe_price_id?: string | null;
          tagline?: string | null;
        };
        Update: {
          active?: boolean;
          burst_per_sec?: number;
          created_at?: string;
          features?: Json;
          id?: string;
          included_calls?: number;
          name?: string;
          overage_cents_per_call?: number;
          price_cents?: number;
          rate_per_sec?: number;
          sort_order?: number;
          stripe_price_id?: string | null;
          tagline?: string | null;
        };
        Relationships: [];
      };
      product_cache: {
        Row: {
          cache_key: string;
          calibration_version: string | null;
          confidence: number;
          created_by: string | null;
          expires_at: string;
          fetched_at: string;
          field_confidence: Json;
          gtin: string | null;
          id: string;
          legibility_id: string | null;
          method: string;
          product: Json;
          takedown: boolean;
          url: string | null;
        };
        Insert: {
          cache_key: string;
          calibration_version?: string | null;
          confidence: number;
          created_by?: string | null;
          expires_at: string;
          fetched_at?: string;
          field_confidence?: Json;
          gtin?: string | null;
          id?: string;
          legibility_id?: string | null;
          method: string;
          product: Json;
          takedown?: boolean;
          url?: string | null;
        };
        Update: {
          cache_key?: string;
          calibration_version?: string | null;
          confidence?: number;
          created_by?: string | null;
          expires_at?: string;
          fetched_at?: string;
          field_confidence?: Json;
          gtin?: string | null;
          id?: string;
          legibility_id?: string | null;
          method?: string;
          product?: Json;
          takedown?: boolean;
          url?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          approved: boolean;
          approved_at: string | null;
          company: string | null;
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          approved?: boolean;
          approved_at?: string | null;
          company?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          approved?: boolean;
          approved_at?: string | null;
          company?: string | null;
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      resolutions: {
        Row: {
          completed_at: string | null;
          confidence: number | null;
          cost_usd: number | null;
          created_at: string;
          error: string | null;
          id: string;
          input: Json;
          result: Json | null;
          status: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          confidence?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          input: Json;
          result?: Json | null;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          confidence?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          input?: Json;
          result?: Json | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan_id: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      sweep_runs: {
        Row: {
          attempted: number;
          blocked: number;
          cohorts: string[];
          cost_cap_usd: number;
          cost_usd: number;
          failed: number;
          finished_at: string | null;
          id: string;
          inserted: number;
          item_cap: number;
          notes: string | null;
          started_at: string;
          status: string;
          succeeded: number;
        };
        Insert: {
          attempted?: number;
          blocked?: number;
          cohorts: string[];
          cost_cap_usd: number;
          cost_usd?: number;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          inserted?: number;
          item_cap: number;
          notes?: string | null;
          started_at?: string;
          status?: string;
          succeeded?: number;
        };
        Update: {
          attempted?: number;
          blocked?: number;
          cohorts?: string[];
          cost_cap_usd?: number;
          cost_usd?: number;
          failed?: number;
          finished_at?: string | null;
          id?: string;
          inserted?: number;
          item_cap?: number;
          notes?: string | null;
          started_at?: string;
          status?: string;
          succeeded?: number;
        };
        Relationships: [];
      };
      takedown_requests: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          notes: string | null;
          reason: string;
          resolved_at: string | null;
          status: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          notes?: string | null;
          reason: string;
          resolved_at?: string | null;
          status?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          notes?: string | null;
          reason?: string;
          resolved_at?: string | null;
          status?: string;
          url?: string;
        };
        Relationships: [];
      };
      usage_events: {
        Row: {
          api_key_id: string | null;
          billable: boolean;
          cached: boolean;
          calibration_version: string | null;
          confidence: number | null;
          cost_usd: number;
          created_at: string;
          domain: string | null;
          endpoint: string | null;
          envelope_hash: string | null;
          id: number;
          latency_ms: number | null;
          meta: Json;
          product_returned: boolean | null;
          request_id: string | null;
          status: number;
          tool: string;
          user_id: string;
        };
        Insert: {
          api_key_id?: string | null;
          billable?: boolean;
          cached?: boolean;
          calibration_version?: string | null;
          confidence?: number | null;
          cost_usd?: number;
          created_at?: string;
          domain?: string | null;
          endpoint?: string | null;
          envelope_hash?: string | null;
          id?: number;
          latency_ms?: number | null;
          meta?: Json;
          product_returned?: boolean | null;
          request_id?: string | null;
          status?: number;
          tool: string;
          user_id: string;
        };
        Update: {
          api_key_id?: string | null;
          billable?: boolean;
          cached?: boolean;
          calibration_version?: string | null;
          confidence?: number | null;
          cost_usd?: number;
          created_at?: string;
          domain?: string | null;
          endpoint?: string | null;
          envelope_hash?: string | null;
          id?: number;
          latency_ms?: number | null;
          meta?: Json;
          product_returned?: boolean | null;
          request_id?: string | null;
          status?: number;
          tool?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_api_key_id_fkey";
            columns: ["api_key_id"];
            isOneToOne: false;
            referencedRelation: "api_keys";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          check_id: string | null;
          company: string | null;
          created_at: string;
          email: string;
          id: string;
          source: string | null;
          status: string;
          use_case: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          check_id?: string | null;
          company?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          source?: string | null;
          status?: string;
          use_case?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          check_id?: string | null;
          company?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          source?: string | null;
          status?: string;
          use_case?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_check_id_fkey";
            columns: ["check_id"];
            isOneToOne: false;
            referencedRelation: "domain_checks";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          attempt: number;
          created_at: string;
          delivered_at: string | null;
          event: string;
          id: string;
          next_retry_at: string | null;
          payload: Json;
          status_code: number | null;
          success: boolean;
          webhook_id: string;
        };
        Insert: {
          attempt?: number;
          created_at?: string;
          delivered_at?: string | null;
          event: string;
          id?: string;
          next_retry_at?: string | null;
          payload?: Json;
          status_code?: number | null;
          success?: boolean;
          webhook_id: string;
        };
        Update: {
          attempt?: number;
          created_at?: string;
          delivered_at?: string | null;
          event?: string;
          id?: string;
          next_retry_at?: string | null;
          payload?: Json;
          status_code?: number | null;
          success?: boolean;
          webhook_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey";
            columns: ["webhook_id"];
            isOneToOne: false;
            referencedRelation: "webhooks";
            referencedColumns: ["id"];
          },
        ];
      };
      webhooks: {
        Row: {
          active: boolean;
          created_at: string;
          events: string[];
          id: string;
          last_delivery_at: string | null;
          last_status: number | null;
          secret: string;
          url: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          events?: string[];
          id?: string;
          last_delivery_at?: string | null;
          last_status?: number | null;
          secret: string;
          url: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          events?: string[];
          id?: string;
          last_delivery_at?: string | null;
          last_status?: number | null;
          secret?: string;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      cohort_readability: {
        Row: {
          blocked: number | null;
          cohort: string | null;
          cost_usd: number | null;
          domains: number | null;
          error: number | null;
          first_observed: string | null;
          js_shell: number | null;
          last_observed: string | null;
          low_confidence: number | null;
          no_structured_data: number | null;
          not_a_product: number | null;
          observations: number | null;
          readable: number | null;
          robots_disallowed: number | null;
          run_id: string | null;
          timeout: number | null;
          unreadable: number | null;
          unreadable_pct: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "observations_run_id_fkey";
            columns: ["run_id"];
            isOneToOne: false;
            referencedRelation: "sweep_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      domain_latest: {
        Row: {
          cohort: string | null;
          confidence: number | null;
          domain: string | null;
          failure_reason: string | null;
          http_status: number | null;
          method: string | null;
          observed_at: string | null;
          readable: boolean | null;
          robots_allowed: boolean | null;
          target: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      check_kill_floor: { Args: never; Returns: undefined };
      compute_ops_daily: { Args: { _day?: string }; Returns: undefined };
      entitlement_check: {
        Args: { _user_id: string };
        Returns: {
          allowed: boolean;
          cost_spent_cents: number;
          included_calls: number;
          plan_id: string;
          reason: string;
          used_billable: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      kill_dashboard: {
        Args: never;
        Returns: {
          red_threshold: string;
          signal: string;
          status: string;
          value: number;
        }[];
      };
      northstar_weekly: {
        Args: { _since?: string };
        Returns: {
          total_calls: number;
          trusted_reads: number;
          user_id: string;
          week: string;
        }[];
      };
      rate_check: {
        Args: { _user_id: string };
        Returns: {
          allowed: boolean;
          lim: number;
          reset_seconds: number;
          used: number;
        }[];
      };
      trust_rate_by_method: {
        Args: { _since?: string };
        Returns: {
          calls: number;
          gate_pass: number;
          gate_pass_rate: number;
          method: string;
        }[];
      };
      usage_current_period: {
        Args: { _user_id?: string };
        Returns: {
          cached_calls: number;
          calls: number;
          cost_usd: number;
          live_calls: number;
        }[];
      };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
