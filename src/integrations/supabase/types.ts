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
      internal_job_tokens: {
        Row: {
          name: string
          token: string
        }
        Insert: {
          name: string
          token?: string
        }
        Update: {
          name?: string
          token?: string
        }
        Relationships: []
      }
      meta_event_logs: {
        Row: {
          created_at: string
          error: string | null
          event_id: string | null
          event_name: string
          http_status: number | null
          id: string
          ok: boolean
          order_number: string | null
          source: string
          store_id: string
          test_mode: boolean
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name: string
          http_status?: number | null
          id?: string
          ok: boolean
          order_number?: string | null
          source?: string
          store_id: string
          test_mode?: boolean
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string | null
          event_name?: string
          http_status?: number | null
          id?: string
          ok?: boolean
          order_number?: string | null
          source?: string
          store_id?: string
          test_mode?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "meta_event_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          error: string | null
          id: string
          order_id: string
          provider: string | null
          provider_refund_id: string | null
          provider_status: string | null
          reason: string | null
          requested_by: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          error?: string | null
          id?: string
          order_id: string
          provider?: string | null
          provider_refund_id?: string | null
          provider_status?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string
          provider?: string | null
          provider_refund_id?: string | null
          provider_status?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refunds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          access_token: string
          address: Json
          created_at: string
          customer: Json
          e2e: string | null
          id: string
          meta_attribution: Json
          meta_purchase_event_id: string | null
          meta_purchase_sent_at: string | null
          order_number: string
          paid_at: string | null
          payment: Json
          payment_method: string | null
          payment_provider: string | null
          pix_expiration_date: string | null
          product_id: string | null
          product_snapshot: Json
          provider_status: string | null
          quantity: number
          shipping_label: string | null
          shipping_price: number
          status: string
          store_id: string | null
          subtotal: number
          total: number
          total_amount_cents: number | null
          transaction_id: string | null
          unit_price: number
          updated_at: string
          variant: Json
        }
        Insert: {
          access_token?: string
          address?: Json
          created_at?: string
          customer?: Json
          e2e?: string | null
          id?: string
          meta_attribution?: Json
          meta_purchase_event_id?: string | null
          meta_purchase_sent_at?: string | null
          order_number: string
          paid_at?: string | null
          payment?: Json
          payment_method?: string | null
          payment_provider?: string | null
          pix_expiration_date?: string | null
          product_id?: string | null
          product_snapshot?: Json
          provider_status?: string | null
          quantity?: number
          shipping_label?: string | null
          shipping_price?: number
          status?: string
          store_id?: string | null
          subtotal: number
          total: number
          total_amount_cents?: number | null
          transaction_id?: string | null
          unit_price: number
          updated_at?: string
          variant?: Json
        }
        Update: {
          access_token?: string
          address?: Json
          created_at?: string
          customer?: Json
          e2e?: string | null
          id?: string
          meta_attribution?: Json
          meta_purchase_event_id?: string | null
          meta_purchase_sent_at?: string | null
          order_number?: string
          paid_at?: string | null
          payment?: Json
          payment_method?: string | null
          payment_provider?: string | null
          pix_expiration_date?: string | null
          product_id?: string | null
          product_snapshot?: Json
          provider_status?: string | null
          quantity?: number
          shipping_label?: string | null
          shipping_price?: number
          status?: string
          store_id?: string | null
          subtotal?: number
          total?: number
          total_amount_cents?: number | null
          transaction_id?: string | null
          unit_price?: number
          updated_at?: string
          variant?: Json
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_recovery_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          order_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          order_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_recovery_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_recovery_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          creator_videos: Json
          description: Json
          display: Json
          id: string
          media: Json
          name: string
          offer: Json
          previous_price: number
          price: number
          protection: Json
          rating: number
          reviews: Json
          reviews_count: number
          sections: Json
          shipping: Json
          slug: string
          sold_count: number
          sort_order: number
          specs: Json
          stock: number
          store_id: string | null
          subtitle: string | null
          terms: string | null
          title: string
          updated_at: string
          variant_combos: Json
          variants: Json
          warranty: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          creator_videos?: Json
          description?: Json
          display?: Json
          id?: string
          media?: Json
          name: string
          offer?: Json
          previous_price: number
          price: number
          protection?: Json
          rating?: number
          reviews?: Json
          reviews_count?: number
          sections?: Json
          shipping?: Json
          slug: string
          sold_count?: number
          sort_order?: number
          specs?: Json
          stock?: number
          store_id?: string | null
          subtitle?: string | null
          terms?: string | null
          title: string
          updated_at?: string
          variant_combos?: Json
          variants?: Json
          warranty?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          creator_videos?: Json
          description?: Json
          display?: Json
          id?: string
          media?: Json
          name?: string
          offer?: Json
          previous_price?: number
          price?: number
          protection?: Json
          rating?: number
          reviews?: Json
          reviews_count?: number
          sections?: Json
          shipping?: Json
          slug?: string
          sold_count?: number
          sort_order?: number
          specs?: Json
          stock?: number
          store_id?: string | null
          subtitle?: string | null
          terms?: string | null
          title?: string
          updated_at?: string
          variant_combos?: Json
          variants?: Json
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      store_meta_settings: {
        Row: {
          capi_token: string | null
          created_at: string
          enabled: boolean
          id: string
          pixel_id: string | null
          store_id: string
          test_event_code: string | null
          test_event_code_set_at: string | null
          track_pending: boolean
          updated_at: string
        }
        Insert: {
          capi_token?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          pixel_id?: string | null
          store_id: string
          test_event_code?: string | null
          test_event_code_set_at?: string | null
          track_pending?: boolean
          updated_at?: string
        }
        Update: {
          capi_token?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          pixel_id?: string | null
          store_id?: string
          test_event_code?: string | null
          test_event_code_set_at?: string | null
          track_pending?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_meta_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_settings: {
        Row: {
          created_at: string
          enabled: boolean
          environment: string
          id: string
          pix_config: Json
          provider: string
          public_data: Json
          secret_data: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          pix_config?: Json
          provider?: string
          public_data?: Json
          secret_data?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          environment?: string
          id?: string
          pix_config?: Json
          provider?: string
          public_data?: Json
          secret_data?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payment_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          active: boolean
          ai_support: Json
          avatar_url: string | null
          banner_link: string | null
          banner_url: string | null
          checkout: Json
          cover_url: string | null
          created_at: string
          favicon_url: string | null
          featured_product_ids: string[]
          footer_logo_url: string | null
          footer_text: string | null
          id: string
          indicators: Json
          is_default: boolean
          logo_url: string | null
          name: string
          policies: Json
          show_follow: boolean
          show_footer: boolean
          show_message: boolean
          show_visit: boolean
          slug: string
          sold_count: number
          support_email: string | null
          tagline: string | null
          updated_at: string
          verified: boolean
          visit_clickable: boolean
          visit_url: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          ai_support?: Json
          avatar_url?: string | null
          banner_link?: string | null
          banner_url?: string | null
          checkout?: Json
          cover_url?: string | null
          created_at?: string
          favicon_url?: string | null
          featured_product_ids?: string[]
          footer_logo_url?: string | null
          footer_text?: string | null
          id?: string
          indicators?: Json
          is_default?: boolean
          logo_url?: string | null
          name?: string
          policies?: Json
          show_follow?: boolean
          show_footer?: boolean
          show_message?: boolean
          show_visit?: boolean
          slug: string
          sold_count?: number
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          visit_clickable?: boolean
          visit_url?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          ai_support?: Json
          avatar_url?: string | null
          banner_link?: string | null
          banner_url?: string | null
          checkout?: Json
          cover_url?: string | null
          created_at?: string
          favicon_url?: string | null
          featured_product_ids?: string[]
          footer_logo_url?: string | null
          footer_text?: string | null
          id?: string
          indicators?: Json
          is_default?: boolean
          logo_url?: string | null
          name?: string
          policies?: Json
          show_follow?: boolean
          show_footer?: boolean
          show_message?: boolean
          show_visit?: boolean
          slug?: string
          sold_count?: number
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          verified?: boolean
          visit_clickable?: boolean
          visit_url?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      store_whatsapp_settings: {
        Row: {
          created_at: string
          delays: number[]
          enabled: boolean
          id: string
          max_reminders: number
          message: string
          provider: string
          public_data: Json
          secret_data: Json
          sender: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delays?: number[]
          enabled?: boolean
          id?: string
          max_reminders?: number
          message?: string
          provider?: string
          public_data?: Json
          secret_data?: Json
          sender?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delays?: number[]
          enabled?: boolean
          id?: string
          max_reminders?: number
          message?: string
          provider?: string
          public_data?: Json
          secret_data?: Json
          sender?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_whatsapp_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "store_settings"
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
      whatsapp_pix_reminders: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          order_id: string
          phone_masked: string | null
          pix_status: string | null
          provider_message_id: string | null
          status: string
          step: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          order_id: string
          phone_masked?: string | null
          pix_status?: string | null
          provider_message_id?: string | null
          status?: string
          step: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          order_id?: string
          phone_masked?: string | null
          pix_status?: string | null
          provider_message_id?: string | null
          status?: string
          step?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_pix_reminders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_pix_reminders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_settings"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: ["admin", "user"],
    },
  },
} as const
