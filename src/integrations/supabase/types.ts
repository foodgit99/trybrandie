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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          commission_amount: number
          created_at: string
          id: string
          payment_amount: number
          payment_reference: string | null
          referral_id: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          commission_amount?: number
          created_at?: string
          id?: string
          payment_amount?: number
          payment_reference?: string | null
          referral_id?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          commission_amount?: number
          created_at?: string
          id?: string
          payment_amount?: number
          payment_reference?: string | null
          referral_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          referred_user_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          referred_user_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          referred_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          account_name: string | null
          account_number: string | null
          affiliate_code: string
          bank_name: string | null
          commission_rate: number
          created_at: string
          id: string
          status: string
          total_earned: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          affiliate_code?: string
          bank_name?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          affiliate_code?: string
          bank_name?: string | null
          commission_rate?: number
          created_at?: string
          id?: string
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brand_inspiration: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          image_url: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          image_url: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_inspiration_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_products: {
        Row: {
          brand_id: string
          created_at: string
          description: string
          duration: string
          features: string[]
          id: string
          image_url: string
          label: string
          price: string
          pricing_model: string
          product_type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string
          duration?: string
          features?: string[]
          id?: string
          image_url: string
          label?: string
          price?: string
          pricing_model?: string
          product_type?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string
          duration?: string
          features?: string[]
          id?: string
          image_url?: string
          label?: string
          price?: string
          pricing_model?: string
          product_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_trend_preferences: {
        Row: {
          brand_id: string
          created_at: string
          default_trend_intensity: number
          id: string
          preferred_trends: string[]
          selected_trend: string
          trend_enabled: boolean
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          default_trend_intensity?: number
          id?: string
          preferred_trends?: string[]
          selected_trend?: string
          trend_enabled?: boolean
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          default_trend_intensity?: number
          id?: string
          preferred_trends?: string[]
          selected_trend?: string
          trend_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_trend_preferences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          accent_colors: string[] | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          onboarding_complete: boolean
          personality_traits: string[] | null
          primary_colors: string[] | null
          secondary_colors: string[] | null
          special_instructions: string | null
          tagline: string | null
          tone_of_voice: string | null
          typography_display: string | null
          typography_primary: string | null
          typography_secondary: string | null
          updated_at: string
          user_id: string
          vibe: string | null
        }
        Insert: {
          accent_colors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          onboarding_complete?: boolean
          personality_traits?: string[] | null
          primary_colors?: string[] | null
          secondary_colors?: string[] | null
          special_instructions?: string | null
          tagline?: string | null
          tone_of_voice?: string | null
          typography_display?: string | null
          typography_primary?: string | null
          typography_secondary?: string | null
          updated_at?: string
          user_id: string
          vibe?: string | null
        }
        Update: {
          accent_colors?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_complete?: boolean
          personality_traits?: string[] | null
          primary_colors?: string[] | null
          secondary_colors?: string[] | null
          special_instructions?: string | null
          tagline?: string | null
          tone_of_voice?: string | null
          typography_display?: string | null
          typography_primary?: string | null
          typography_secondary?: string | null
          updated_at?: string
          user_id?: string
          vibe?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          brand_id: string
          created_at: string
          description: string
          id: string
          name: string
          post_count: number
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          post_count?: number
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          post_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_preference_cache: {
        Row: {
          edit_patterns: Json | null
          id: string
          message_count: number
          tags: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          edit_patterns?: Json | null
          id?: string
          message_count?: number
          tags?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          edit_patterns?: Json | null
          id?: string
          message_count?: number
          tags?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_ideas: {
        Row: {
          brand_id: string
          campaign_id: string | null
          content_format: string
          created_at: string
          design_id: string | null
          id: string
          idea_type: string
          pillar_id: string | null
          prompt: string
          scheduled_for: string | null
          series_id: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          content_format?: string
          created_at?: string
          design_id?: string | null
          id?: string
          idea_type?: string
          pillar_id?: string | null
          prompt: string
          scheduled_for?: string | null
          series_id?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          content_format?: string
          created_at?: string
          design_id?: string | null
          id?: string
          idea_type?: string
          pillar_id?: string | null
          prompt?: string
          scheduled_for?: string | null
          series_id?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_ideas_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "post_series"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          brand_id: string
          created_at: string
          description: string
          icon_emoji: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_pillars_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      design_folder_assignments: {
        Row: {
          created_at: string
          design_id: string
          folder_id: string
          id: string
        }
        Insert: {
          created_at?: string
          design_id: string
          folder_id: string
          id?: string
        }
        Update: {
          created_at?: string
          design_id?: string
          folder_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_folder_assignments_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_folder_assignments_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "design_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      design_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      design_messages: {
        Row: {
          attached_image_url: string | null
          content: string
          created_at: string
          design_id: string
          id: string
          image_url: string | null
          role: string
          user_id: string
        }
        Insert: {
          attached_image_url?: string | null
          content: string
          created_at?: string
          design_id: string
          id?: string
          image_url?: string | null
          role: string
          user_id: string
        }
        Update: {
          attached_image_url?: string | null
          content?: string
          created_at?: string
          design_id?: string
          id?: string
          image_url?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_messages_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      designs: {
        Row: {
          brand_id: string
          canvas_size: string
          caption: string | null
          carousel_id: string | null
          copy_structure: Json | null
          created_at: string
          genome: Json | null
          id: string
          image_url: string
          prompt: string
          slide_index: number | null
          title: string | null
          trend_intensity: number | null
          trend_used: string | null
          user_id: string
          vote: number | null
        }
        Insert: {
          brand_id: string
          canvas_size?: string
          caption?: string | null
          carousel_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          genome?: Json | null
          id?: string
          image_url: string
          prompt: string
          slide_index?: number | null
          title?: string | null
          trend_intensity?: number | null
          trend_used?: string | null
          user_id: string
          vote?: number | null
        }
        Update: {
          brand_id?: string
          canvas_size?: string
          caption?: string | null
          carousel_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          genome?: Json | null
          id?: string
          image_url?: string
          prompt?: string
          slide_index?: number | null
          title?: string | null
          trend_intensity?: number | null
          trend_used?: string | null
          user_id?: string
          vote?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "designs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      post_series: {
        Row: {
          brand_id: string
          created_at: string
          description: string
          id: string
          name: string
          pillar_id: string | null
          preferred_day: string | null
          recurrence: string
          updated_at: string
          user_id: string
          visual_style_notes: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string
          id?: string
          name: string
          pillar_id?: string | null
          preferred_day?: string | null
          recurrence?: string
          updated_at?: string
          user_id: string
          visual_style_notes?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          pillar_id?: string | null
          preferred_day?: string | null
          recurrence?: string
          updated_at?: string
          user_id?: string
          visual_style_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_series_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_series_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_credits: number
          bonus_earned_count: number
          bonus_earned_reset_at: string
          content_hub_gen_count: number
          content_hub_gen_reset_at: string
          created_at: string
          full_name: string | null
          generations_count: number
          generations_reset_at: string
          id: string
          logo_generations_used: number
          referral_code: string | null
          referred_by: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_earned_count?: number
          bonus_earned_reset_at?: string
          content_hub_gen_count?: number
          content_hub_gen_reset_at?: string
          created_at?: string
          full_name?: string | null
          generations_count?: number
          generations_reset_at?: string
          id?: string
          logo_generations_used?: number
          referral_code?: string | null
          referred_by?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_earned_count?: number
          bonus_earned_reset_at?: string
          content_hub_gen_count?: number
          content_hub_gen_reset_at?: string
          created_at?: string
          full_name?: string | null
          generations_count?: number
          generations_reset_at?: string
          id?: string
          logo_generations_used?: number
          referral_code?: string | null
          referred_by?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          credits_awarded: number
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          credits_awarded?: number
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      strategy_conversations: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategy_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "strategy_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      target_audiences: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          jtbd_profile: Json
          label: string
          raw_inputs: Json
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          jtbd_profile?: Json
          label?: string
          raw_inputs?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          jtbd_profile?: Json
          label?: string
          raw_inputs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "target_audiences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
      video_projects: {
        Row: {
          brand_id: string
          caption: string | null
          content_idea_id: string | null
          created_at: string
          credits_used: number
          hashtags: string[] | null
          id: string
          intent: Json
          script: Json | null
          selected_variation: number | null
          status: string
          storyboard: Json | null
          timeline: Json | null
          updated_at: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          brand_id: string
          caption?: string | null
          content_idea_id?: string | null
          created_at?: string
          credits_used?: number
          hashtags?: string[] | null
          id?: string
          intent?: Json
          script?: Json | null
          selected_variation?: number | null
          status?: string
          storyboard?: Json | null
          timeline?: Json | null
          updated_at?: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          brand_id?: string
          caption?: string | null
          content_idea_id?: string | null
          created_at?: string
          credits_used?: number
          hashtags?: string[] | null
          id?: string
          intent?: Json
          script?: Json | null
          selected_variation?: number | null
          status?: string
          storyboard?: Json | null
          timeline?: Json | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_projects_content_idea_id_fkey"
            columns: ["content_idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      video_scenes: {
        Row: {
          created_at: string
          description: string
          duration_ms: number
          id: string
          image_url: string | null
          scene_index: number
          text_overlay: Json | null
          transition: string
          video_project_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_ms?: number
          id?: string
          image_url?: string | null
          scene_index?: number
          text_overlay?: Json | null
          transition?: string
          video_project_id: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_ms?: number
          id?: string
          image_url?: string | null
          scene_index?: number
          text_overlay?: Json | null
          transition?: string
          video_project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_scenes_video_project_id_fkey"
            columns: ["video_project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
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
      increment_affiliate_earned: {
        Args: { p_affiliate_id: string; p_amount: number }
        Returns: undefined
      }
      process_referral: { Args: { p_user_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
