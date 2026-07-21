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
          commission_type: string
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
          commission_type?: string
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
          commission_type?: string
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
          payment_count: number
          referred_user_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          payment_count?: number
          referred_user_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          payment_count?: number
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
          agreed_disclosure: boolean
          agreed_terms: boolean
          application_submitted_at: string | null
          audience_size: string | null
          audience_types: string[]
          bank_name: string | null
          brandie_experience: string | null
          channel_handle: string | null
          channel_url: string | null
          commission_rate: number
          content_types: string[]
          created_at: string
          id: string
          location: string | null
          milestones_notified: number[]
          niche: string | null
          posting_cadence: string | null
          primary_channel: string | null
          promo_plan: string | null
          recruited_by: string | null
          regions: string[]
          status: string
          total_earned: number
          total_paid: number
          updated_at: string
          used_brandie: boolean | null
          user_id: string
          whatsapp_number: string | null
          why_join: string | null
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          affiliate_code?: string
          agreed_disclosure?: boolean
          agreed_terms?: boolean
          application_submitted_at?: string | null
          audience_size?: string | null
          audience_types?: string[]
          bank_name?: string | null
          brandie_experience?: string | null
          channel_handle?: string | null
          channel_url?: string | null
          commission_rate?: number
          content_types?: string[]
          created_at?: string
          id?: string
          location?: string | null
          milestones_notified?: number[]
          niche?: string | null
          posting_cadence?: string | null
          primary_channel?: string | null
          promo_plan?: string | null
          recruited_by?: string | null
          regions?: string[]
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
          used_brandie?: boolean | null
          user_id: string
          whatsapp_number?: string | null
          why_join?: string | null
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          affiliate_code?: string
          agreed_disclosure?: boolean
          agreed_terms?: boolean
          application_submitted_at?: string | null
          audience_size?: string | null
          audience_types?: string[]
          bank_name?: string | null
          brandie_experience?: string | null
          channel_handle?: string | null
          channel_url?: string | null
          commission_rate?: number
          content_types?: string[]
          created_at?: string
          id?: string
          location?: string | null
          milestones_notified?: number[]
          niche?: string | null
          posting_cadence?: string | null
          primary_channel?: string | null
          promo_plan?: string | null
          recruited_by?: string | null
          regions?: string[]
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
          used_brandie?: boolean | null
          user_id?: string
          whatsapp_number?: string | null
          why_join?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_recruited_by_fkey"
            columns: ["recruited_by"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_actions: {
        Row: {
          brand_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          input: Json
          is_reversible: boolean
          mode: string
          output: Json | null
          reverse_payload: Json | null
          spend_units: number
          status: string
          tool_name: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          input?: Json
          is_reversible?: boolean
          mode?: string
          output?: Json | null
          reverse_payload?: Json | null
          spend_units?: number
          status?: string
          tool_name: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          input?: Json
          is_reversible?: boolean
          mode?: string
          output?: Json | null
          reverse_payload?: Json | null
          spend_units?: number
          status?: string
          tool_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_actions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_api_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_conversations: {
        Row: {
          brand_id: string | null
          channel: string
          created_at: string
          external_thread_id: string | null
          id: string
          last_message_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          channel?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          brand_id?: string | null
          channel?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          autonomy_enabled: boolean
          brand_id: string
          created_at: string
          daily_spend_ceiling: number
          daily_tool_ceiling: number
          forbidden_topics: string[]
          id: string
          persona_notes: string | null
          tool_modes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          autonomy_enabled?: boolean
          brand_id: string
          created_at?: string
          daily_spend_ceiling?: number
          daily_tool_ceiling?: number
          forbidden_topics?: string[]
          id?: string
          persona_notes?: string | null
          tool_modes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          autonomy_enabled?: boolean
          brand_id?: string
          created_at?: string
          daily_spend_ceiling?: number
          daily_tool_ceiling?: number
          forbidden_topics?: string[]
          id?: string
          persona_notes?: string | null
          tool_modes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_run_events: {
        Row: {
          brand_id: string
          created_at: string
          error_message: string | null
          id: string
          idea_id: string
          metadata: Json | null
          run_id: string
          status: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          idea_id: string
          metadata?: Json | null
          run_id: string
          status: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          idea_id?: string
          metadata?: Json | null
          run_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "autopilot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_runs: {
        Row: {
          completed_at: string | null
          delivery_time: string
          error_details: Json | null
          errors: number
          id: string
          ideas_found: number
          processed: number
          skipped: number
          started_at: string
        }
        Insert: {
          completed_at?: string | null
          delivery_time: string
          error_details?: Json | null
          errors?: number
          id?: string
          ideas_found?: number
          processed?: number
          skipped?: number
          started_at?: string
        }
        Update: {
          completed_at?: string | null
          delivery_time?: string
          error_details?: Json | null
          errors?: number
          id?: string
          ideas_found?: number
          processed?: number
          skipped?: number
          started_at?: string
        }
        Relationships: []
      }
      autopilot_settings: {
        Row: {
          auto_fill_mode: string
          brand_id: string
          created_at: string
          default_campaign_id: string | null
          default_canvas_size: string | null
          default_funnel_stage: string | null
          delivery_time: string
          enabled: boolean
          id: string
          marketing_email_enabled: boolean
          marketing_email_frequency_cap: number
          marketing_email_from_name: string | null
          marketing_email_physical_address: string | null
          marketing_email_quiet_hours_end: number
          marketing_email_quiet_hours_start: number
          marketing_email_reply_to: string | null
          min_queue_threshold: number
          mode: string
          timezone: string
          updated_at: string
          user_id: string
          weekly_plan_last_run: string | null
        }
        Insert: {
          auto_fill_mode?: string
          brand_id: string
          created_at?: string
          default_campaign_id?: string | null
          default_canvas_size?: string | null
          default_funnel_stage?: string | null
          delivery_time?: string
          enabled?: boolean
          id?: string
          marketing_email_enabled?: boolean
          marketing_email_frequency_cap?: number
          marketing_email_from_name?: string | null
          marketing_email_physical_address?: string | null
          marketing_email_quiet_hours_end?: number
          marketing_email_quiet_hours_start?: number
          marketing_email_reply_to?: string | null
          min_queue_threshold?: number
          mode?: string
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_plan_last_run?: string | null
        }
        Update: {
          auto_fill_mode?: string
          brand_id?: string
          created_at?: string
          default_campaign_id?: string | null
          default_canvas_size?: string | null
          default_funnel_stage?: string | null
          delivery_time?: string
          enabled?: boolean
          id?: string
          marketing_email_enabled?: boolean
          marketing_email_frequency_cap?: number
          marketing_email_from_name?: string | null
          marketing_email_physical_address?: string | null
          marketing_email_quiet_hours_end?: number
          marketing_email_quiet_hours_start?: number
          marketing_email_reply_to?: string | null
          min_queue_threshold?: number
          mode?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_plan_last_run?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_settings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_settings_default_campaign_id_fkey"
            columns: ["default_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_inspiration: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          image_url: string
          position: number
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          image_url: string
          position?: number
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string
          position?: number
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
          gallery_images: string[]
          id: string
          image_url: string
          is_featured: boolean
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
          gallery_images?: string[]
          id?: string
          image_url: string
          is_featured?: boolean
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
          gallery_images?: string[]
          id?: string
          image_url?: string
          is_featured?: boolean
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
      brand_team_members: {
        Row: {
          accepted_at: string | null
          brand_id: string
          created_at: string
          email: string
          id: string
          invite_token: string | null
          invited_at: string
          invited_by: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          brand_id: string
          created_at?: string
          email: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          invited_by: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          brand_id?: string
          created_at?: string
          email?: string
          id?: string
          invite_token?: string | null
          invited_at?: string
          invited_by?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      brand_trend_intel: {
        Row: {
          brand_id: string
          created_at: string
          generated_at: string
          id: string
          trends_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          generated_at?: string
          id?: string
          trends_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          trends_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_trend_intel_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: true
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
          research_prefs: Json
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
          research_prefs?: Json
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
          research_prefs?: Json
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
      brand_updates: {
        Row: {
          attribution: string | null
          brand_id: string
          confidence: number | null
          content: string
          created_at: string
          event_date: string
          expires_at: string | null
          id: string
          image_url: string | null
          last_used_at: string | null
          missing_fields: string[]
          source_url: string | null
          status: string
          times_used: number
          title: string
          update_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attribution?: string | null
          brand_id: string
          confidence?: number | null
          content?: string
          created_at?: string
          event_date?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          last_used_at?: string | null
          missing_fields?: string[]
          source_url?: string | null
          status?: string
          times_used?: number
          title?: string
          update_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attribution?: string | null
          brand_id?: string
          confidence?: number | null
          content?: string
          created_at?: string
          event_date?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          last_used_at?: string | null
          missing_fields?: string[]
          source_url?: string | null
          status?: string
          times_used?: number
          title?: string
          update_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          accent_colors: string[] | null
          client_folder_id: string | null
          created_at: string
          description: string | null
          funnel_stages: Json
          gene_lock_policy: Json | null
          id: string
          is_archived: boolean
          logo_url: string | null
          name: string
          onboarding_complete: boolean
          personality_traits: string[] | null
          playbook_id: string | null
          prefer_gallery_first: boolean
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
          website_url: string | null
        }
        Insert: {
          accent_colors?: string[] | null
          client_folder_id?: string | null
          created_at?: string
          description?: string | null
          funnel_stages?: Json
          gene_lock_policy?: Json | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          name: string
          onboarding_complete?: boolean
          personality_traits?: string[] | null
          playbook_id?: string | null
          prefer_gallery_first?: boolean
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
          website_url?: string | null
        }
        Update: {
          accent_colors?: string[] | null
          client_folder_id?: string | null
          created_at?: string
          description?: string | null
          funnel_stages?: Json
          gene_lock_policy?: Json | null
          id?: string
          is_archived?: boolean
          logo_url?: string | null
          name?: string
          onboarding_complete?: boolean
          personality_traits?: string[] | null
          playbook_id?: string | null
          prefer_gallery_first?: boolean
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
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_client_folder_id_fkey"
            columns: ["client_folder_id"]
            isOneToOne: false
            referencedRelation: "client_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          content_category: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          post_count: number
          user_id: string
        }
        Insert: {
          brand_id: string
          content_category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          post_count?: number
          user_id: string
        }
        Update: {
          brand_id?: string
          content_category?: string | null
          created_at?: string
          description?: string | null
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
      client_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_ideas: {
        Row: {
          approval_status: string
          autopilot: boolean
          autopilot_status: string | null
          blueprint_id: string | null
          brand_id: string
          campaign_id: string | null
          campaign_rationale: string | null
          canvas_size: string | null
          content_category: string | null
          content_format: string
          created_at: string
          day_of_week: number | null
          design_id: string | null
          funnel_rationale: string | null
          funnel_stage: string | null
          id: string
          idea_type: string
          pillar_id: string | null
          playbook_role: string | null
          product_ref: string | null
          prompt: string
          scheduled_for: string | null
          series_id: string | null
          slide_count: number | null
          status: string
          strategic_arc: string | null
          title: string
          user_id: string
          whatsapp_dm: string | null
        }
        Insert: {
          approval_status?: string
          autopilot?: boolean
          autopilot_status?: string | null
          blueprint_id?: string | null
          brand_id: string
          campaign_id?: string | null
          campaign_rationale?: string | null
          canvas_size?: string | null
          content_category?: string | null
          content_format?: string
          created_at?: string
          day_of_week?: number | null
          design_id?: string | null
          funnel_rationale?: string | null
          funnel_stage?: string | null
          id?: string
          idea_type?: string
          pillar_id?: string | null
          playbook_role?: string | null
          product_ref?: string | null
          prompt: string
          scheduled_for?: string | null
          series_id?: string | null
          slide_count?: number | null
          status?: string
          strategic_arc?: string | null
          title: string
          user_id: string
          whatsapp_dm?: string | null
        }
        Update: {
          approval_status?: string
          autopilot?: boolean
          autopilot_status?: string | null
          blueprint_id?: string | null
          brand_id?: string
          campaign_id?: string | null
          campaign_rationale?: string | null
          canvas_size?: string | null
          content_category?: string | null
          content_format?: string
          created_at?: string
          day_of_week?: number | null
          design_id?: string | null
          funnel_rationale?: string | null
          funnel_stage?: string | null
          id?: string
          idea_type?: string
          pillar_id?: string | null
          playbook_role?: string | null
          product_ref?: string | null
          prompt?: string
          scheduled_for?: string | null
          series_id?: string | null
          slide_count?: number | null
          status?: string
          strategic_arc?: string | null
          title?: string
          user_id?: string
          whatsapp_dm?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_ideas_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "weekly_blueprints"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "content_ideas_product_ref_fkey"
            columns: ["product_ref"]
            isOneToOne: false
            referencedRelation: "brand_products"
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
          content_category: string | null
          created_at: string
          description: string
          icon_emoji: string
          id: string
          last_used_at: string | null
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          content_category?: string | null
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          last_used_at?: string | null
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          content_category?: string | null
          created_at?: string
          description?: string
          icon_emoji?: string
          id?: string
          last_used_at?: string | null
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
      credit_rewards: {
        Row: {
          amount: number
          created_at: string
          expires_at: string
          granted_by: string
          id: string
          reason: string
          remaining: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at: string
          granted_by: string
          id?: string
          reason?: string
          remaining: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string
          granted_by?: string
          id?: string
          reason?: string
          remaining?: number
          user_id?: string
        }
        Relationships: []
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
      design_jobs: {
        Row: {
          attempts: number
          brand_id: string | null
          created_at: string
          error: Json | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          priority: number
          progress: number
          result: Json | null
          stage: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          brand_id?: string | null
          created_at?: string
          error?: Json | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          priority?: number
          progress?: number
          result?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          brand_id?: string | null
          created_at?: string
          error?: Json | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          priority?: number
          progress?: number
          result?: Json | null
          stage?: string | null
          started_at?: string | null
          status?: string
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
      design_traces: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          metrics: Json
          run_id: string
          spans: Json | null
          total_input_tokens: number | null
          total_latency_ms: number | null
          total_output_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          metrics?: Json
          run_id: string
          spans?: Json | null
          total_input_tokens?: number | null
          total_latency_ms?: number | null
          total_output_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          metrics?: Json
          run_id?: string
          spans?: Json | null
          total_input_tokens?: number | null
          total_latency_ms?: number | null
          total_output_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          arc_role: string | null
          brand_id: string
          canvas_size: string
          caption: string | null
          carousel_id: string | null
          content_idea_id: string | null
          copy_structure: Json | null
          created_at: string
          creative_director_version: string | null
          genome: Json | null
          id: string
          image_url: string
          layout_schema: Json | null
          narrative_thread: string | null
          prompt: string
          quality_score: Json | null
          quality_signals: Json | null
          slide_index: number | null
          slide_label: string | null
          title: string | null
          trend_intensity: number | null
          trend_used: string | null
          user_id: string
          variation_of: string | null
          vote: number | null
        }
        Insert: {
          arc_role?: string | null
          brand_id: string
          canvas_size?: string
          caption?: string | null
          carousel_id?: string | null
          content_idea_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          creative_director_version?: string | null
          genome?: Json | null
          id?: string
          image_url: string
          layout_schema?: Json | null
          narrative_thread?: string | null
          prompt: string
          quality_score?: Json | null
          quality_signals?: Json | null
          slide_index?: number | null
          slide_label?: string | null
          title?: string | null
          trend_intensity?: number | null
          trend_used?: string | null
          user_id: string
          variation_of?: string | null
          vote?: number | null
        }
        Update: {
          arc_role?: string | null
          brand_id?: string
          canvas_size?: string
          caption?: string | null
          carousel_id?: string | null
          content_idea_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          creative_director_version?: string | null
          genome?: Json | null
          id?: string
          image_url?: string
          layout_schema?: Json | null
          narrative_thread?: string | null
          prompt?: string
          quality_score?: Json | null
          quality_signals?: Json | null
          slide_index?: number | null
          slide_label?: string | null
          title?: string | null
          trend_intensity?: number | null
          trend_used?: string | null
          user_id?: string
          variation_of?: string | null
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
          {
            foreignKeyName: "designs_content_idea_id_fkey"
            columns: ["content_idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "designs_variation_of_fkey"
            columns: ["variation_of"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_broadcasts: {
        Row: {
          ai_alt_subjects: Json | null
          body_html: string | null
          body_md: string | null
          bounces_count: number
          brand_id: string
          campaign_id: string | null
          clicks_count: number
          created_at: string
          cta_label: string | null
          cta_url: string | null
          deliverability_score: number | null
          funnel_stage_id: string | null
          id: string
          idea_id: string | null
          metadata: Json
          opens_count: number
          preheader: string | null
          recipients_count: number
          scheduled_for: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template_key: string | null
          unsubs_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_alt_subjects?: Json | null
          body_html?: string | null
          body_md?: string | null
          bounces_count?: number
          brand_id: string
          campaign_id?: string | null
          clicks_count?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deliverability_score?: number | null
          funnel_stage_id?: string | null
          id?: string
          idea_id?: string | null
          metadata?: Json
          opens_count?: number
          preheader?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          unsubs_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_alt_subjects?: Json | null
          body_html?: string | null
          body_md?: string | null
          bounces_count?: number
          brand_id?: string
          campaign_id?: string | null
          clicks_count?: number
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          deliverability_score?: number | null
          funnel_stage_id?: string | null
          id?: string
          idea_id?: string | null
          metadata?: Json
          opens_count?: number
          preheader?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string | null
          unsubs_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_broadcasts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_funnel_stage_id_fkey"
            columns: ["funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_broadcasts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "marketing_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_logs: {
        Row: {
          campaign_id: string
          email: string
          error: string | null
          id: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          email: string
          error?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          email?: string
          error?: string | null
          id?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          admin_user_id: string
          body: string
          created_at: string
          cta_text: string
          cta_url: string
          failed_count: number
          headline: string
          id: string
          recipient_count: number
          scheduled_for: string | null
          segment_filters: Json
          sender_name: string
          sent_count: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          body?: string
          created_at?: string
          cta_text?: string
          cta_url?: string
          failed_count?: number
          headline?: string
          id?: string
          recipient_count?: number
          scheduled_for?: string | null
          segment_filters?: Json
          sender_name?: string
          sent_count?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          body?: string
          created_at?: string
          cta_text?: string
          cta_url?: string
          failed_count?: number
          headline?: string
          id?: string
          recipient_count?: number
          scheduled_for?: string | null
          segment_filters?: Json
          sender_name?: string
          sent_count?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_links: {
        Row: {
          broadcast_id: string
          click_count: number
          created_at: string
          id: string
          label: string | null
          slug: string
          url: string
        }
        Insert: {
          broadcast_id: string
          click_count?: number
          created_at?: string
          id?: string
          label?: string | null
          slug: string
          url: string
        }
        Update: {
          broadcast_id?: string
          click_count?: number
          created_at?: string
          id?: string
          label?: string | null
          slug?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_links_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "email_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          contact_id: string
          id: string
          newsletters: boolean
          product_updates: boolean
          promotions: boolean
          updated_at: string
        }
        Insert: {
          contact_id: string
          id?: string
          newsletters?: boolean
          product_updates?: boolean
          promotions?: boolean
          updated_at?: string
        }
        Update: {
          contact_id?: string
          id?: string
          newsletters?: boolean
          product_updates?: boolean
          promotions?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          bounced_at: string | null
          brand_id: string
          broadcast_id: string | null
          click_count: number
          clicked_at: string | null
          complained_at: string | null
          contact_id: string
          created_at: string
          error_message: string | null
          id: string
          journey_enrollment_id: string | null
          message_id: string | null
          open_count: number
          opened_at: string | null
          revenue_cents: number | null
          status: string
          unsubscribed_at: string | null
        }
        Insert: {
          bounced_at?: string | null
          brand_id: string
          broadcast_id?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          contact_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          journey_enrollment_id?: string | null
          message_id?: string | null
          open_count?: number
          opened_at?: string | null
          revenue_cents?: number | null
          status?: string
          unsubscribed_at?: string | null
        }
        Update: {
          bounced_at?: string | null
          brand_id?: string
          broadcast_id?: string | null
          click_count?: number
          clicked_at?: string | null
          complained_at?: string | null
          contact_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          journey_enrollment_id?: string | null
          message_id?: string | null
          open_count?: number
          opened_at?: string | null
          revenue_cents?: number | null
          status?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "email_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signup_forms: {
        Row: {
          brand_id: string
          created_at: string
          default_tags: string[]
          description: string | null
          double_opt_in: boolean
          headline: string | null
          id: string
          is_active: boolean
          redirect_url: string | null
          slug: string
          success_message: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          default_tags?: string[]
          description?: string | null
          double_opt_in?: boolean
          headline?: string | null
          id?: string
          is_active?: boolean
          redirect_url?: string | null
          slug: string
          success_message?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          default_tags?: string[]
          description?: string | null
          double_opt_in?: boolean
          headline?: string | null
          id?: string
          is_active?: boolean
          redirect_url?: string | null
          slug?: string
          success_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_signup_forms_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      genome_preset_weights: {
        Row: {
          brand_id: string
          category: string
          id: string
          preset_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          brand_id: string
          category: string
          id?: string
          preset_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          brand_id?: string
          category?: string
          id?: string
          preset_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "genome_preset_weights_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_states: {
        Row: {
          created_at: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          google_email: string
          id: string
          refresh_token: string
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          google_email: string
          id?: string
          refresh_token: string
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          google_email?: string
          id?: string
          refresh_token?: string
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_contacts: {
        Row: {
          brand_id: string
          consent_at: string | null
          created_at: string
          double_opt_in_token: string | null
          email: string
          full_name: string | null
          id: string
          metadata: Json
          source: string | null
          status: string
          tags: string[]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          consent_at?: string | null
          created_at?: string
          double_opt_in_token?: string | null
          email: string
          full_name?: string | null
          id?: string
          metadata?: Json
          source?: string | null
          status?: string
          tags?: string[]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          consent_at?: string | null
          created_at?: string
          double_opt_in_token?: string | null
          email?: string
          full_name?: string | null
          id?: string
          metadata?: Json
          source?: string | null
          status?: string
          tags?: string[]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_contacts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_journey_enrollments: {
        Row: {
          brand_id: string
          contact_id: string
          created_at: string
          current_step: number
          id: string
          journey_id: string
          next_run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          contact_id: string
          created_at?: string
          current_step?: number
          id?: string
          journey_id: string
          next_run_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          contact_id?: string
          created_at?: string
          current_step?: number
          id?: string
          journey_id?: string
          next_run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_journey_enrollments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_journey_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_journey_enrollments_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "marketing_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_journey_steps: {
        Row: {
          body_md: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          id: string
          journey_id: string
          preheader: string | null
          step_order: number
          subject: string
          wait_minutes: number
        }
        Insert: {
          body_md: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          journey_id: string
          preheader?: string | null
          step_order: number
          subject: string
          wait_minutes?: number
        }
        Update: {
          body_md?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          id?: string
          journey_id?: string
          preheader?: string | null
          step_order?: number
          subject?: string
          wait_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_journey_steps_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "marketing_journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_journeys: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_journeys_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_segments: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          rules: Json
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          rules?: Json
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_segments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_suppression: {
        Row: {
          brand_id: string
          created_at: string
          email: string
          id: string
          reason: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          email: string
          id?: string
          reason: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          email?: string
          id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_suppression_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          credited_at: string
          credited_via: string
          credits: number
          currency: string
          id: string
          raw_event: Json | null
          reference: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credited_at?: string
          credited_via: string
          credits?: number
          currency?: string
          id?: string
          raw_event?: Json | null
          reference: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credited_at?: string
          credited_via?: string
          credits?: number
          currency?: string
          id?: string
          raw_event?: Json | null
          reference?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      post_series: {
        Row: {
          brand_id: string
          content_category: string | null
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
          content_category?: string | null
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
          content_category?: string | null
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
      product_events: {
        Row: {
          brand_id: string | null
          created_at: string
          event_name: string
          id: string
          properties: Json
          user_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          event_name: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bonus_credits: number
          bonus_earned_count: number
          bonus_earned_reset_at: string
          brand_nudge_sent_at: string | null
          content_hub_gen_count: number
          content_hub_gen_reset_at: string
          created_at: string
          daily_push_hour: number
          email_reminders_enabled: boolean
          full_name: string | null
          generations_count: number
          generations_reset_at: string
          id: string
          last_category_campaign: string | null
          last_category_idea: string | null
          last_category_series: string | null
          last_daily_push_at: string | null
          last_monday_briefing_at: string | null
          last_weekly_recap_at: string | null
          locale: string | null
          logo_generations_used: number
          monday_briefing_hour: number
          paid_credits: number
          posting_timezone: string
          priority_render_until: string | null
          referral_code: string | null
          referred_by: string | null
          subscription_tier: string
          timezone: string | null
          trend_intel_gen_count: number
          trend_intel_gen_reset_at: string
          updated_at: string
          user_id: string
          v2_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_earned_count?: number
          bonus_earned_reset_at?: string
          brand_nudge_sent_at?: string | null
          content_hub_gen_count?: number
          content_hub_gen_reset_at?: string
          created_at?: string
          daily_push_hour?: number
          email_reminders_enabled?: boolean
          full_name?: string | null
          generations_count?: number
          generations_reset_at?: string
          id?: string
          last_category_campaign?: string | null
          last_category_idea?: string | null
          last_category_series?: string | null
          last_daily_push_at?: string | null
          last_monday_briefing_at?: string | null
          last_weekly_recap_at?: string | null
          locale?: string | null
          logo_generations_used?: number
          monday_briefing_hour?: number
          paid_credits?: number
          posting_timezone?: string
          priority_render_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          subscription_tier?: string
          timezone?: string | null
          trend_intel_gen_count?: number
          trend_intel_gen_reset_at?: string
          updated_at?: string
          user_id: string
          v2_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          avatar_url?: string | null
          bonus_credits?: number
          bonus_earned_count?: number
          bonus_earned_reset_at?: string
          brand_nudge_sent_at?: string | null
          content_hub_gen_count?: number
          content_hub_gen_reset_at?: string
          created_at?: string
          daily_push_hour?: number
          email_reminders_enabled?: boolean
          full_name?: string | null
          generations_count?: number
          generations_reset_at?: string
          id?: string
          last_category_campaign?: string | null
          last_category_idea?: string | null
          last_category_series?: string | null
          last_daily_push_at?: string | null
          last_monday_briefing_at?: string | null
          last_weekly_recap_at?: string | null
          locale?: string | null
          logo_generations_used?: number
          monday_briefing_hour?: number
          paid_credits?: number
          posting_timezone?: string
          priority_render_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          subscription_tier?: string
          timezone?: string | null
          trend_intel_gen_count?: number
          trend_intel_gen_reset_at?: string
          updated_at?: string
          user_id?: string
          v2_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string
          platform: string | null
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          token?: string
          user_agent?: string | null
          user_id?: string
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
      research_cache: {
        Row: {
          category_id: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          query_hash: string
          query_preview: string | null
          result: string
        }
        Insert: {
          category_id: string
          created_at?: string
          expires_at: string
          hit_count?: number
          id?: string
          query_hash: string
          query_preview?: string | null
          result: string
        }
        Update: {
          category_id?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          query_hash?: string
          query_preview?: string | null
          result?: string
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
      subscription_charges: {
        Row: {
          amount: number
          attempt_count: number
          charge_type: string
          created_at: string
          currency: string
          failure_reason: string | null
          id: string
          paystack_reference: string
          raw_response: Json | null
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          attempt_count?: number
          charge_type?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          paystack_reference: string
          raw_response?: Json | null
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          attempt_count?: number
          charge_type?: string
          created_at?: string
          currency?: string
          failure_reason?: string | null
          id?: string
          paystack_reference?: string
          raw_response?: Json | null
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_charges_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_credits: {
        Row: {
          amount: number
          expires_at: string
          granted_at: string
          id: string
          remaining: number
          subscription_id: string
          user_id: string
        }
        Insert: {
          amount: number
          expires_at: string
          granted_at?: string
          id?: string
          remaining: number
          subscription_id: string
          user_id: string
        }
        Update: {
          amount?: number
          expires_at?: string
          granted_at?: string
          id?: string
          remaining?: number
          subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_credits_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          brand_limit: number | null
          created_at: string
          features: Json
          id: string
          is_active: boolean
          monthly_credits: number
          name: string
          price_naira: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          brand_limit?: number | null
          created_at?: string
          features?: Json
          id: string
          is_active?: boolean
          monthly_credits: number
          name: string
          price_naira: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          brand_limit?: number | null
          created_at?: string
          features?: Json
          id?: string
          is_active?: boolean
          monthly_credits?: number
          name?: string
          price_naira?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          authorization_code: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          customer_code: string | null
          failed_attempts: number
          id: string
          last_charge_reference: string | null
          last_renewal_attempt_at: string | null
          plan_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          authorization_code?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end: string
          current_period_start?: string
          customer_code?: string | null
          failed_attempts?: number
          id?: string
          last_charge_reference?: string | null
          last_renewal_attempt_at?: string | null
          plan_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          authorization_code?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          customer_code?: string | null
          failed_attempts?: number
          id?: string
          last_charge_reference?: string | null
          last_renewal_attempt_at?: string | null
          plan_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          category: string
          context: Json
          created_at: string
          email: string
          id: string
          message: string
          priority: string
          status: string
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          category: string
          context?: Json
          created_at?: string
          email: string
          id?: string
          message: string
          priority?: string
          status?: string
          subject: string
          ticket_number: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          category?: string
          context?: Json
          created_at?: string
          email?: string
          id?: string
          message?: string
          priority?: string
          status?: string
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
      user_brand_dialog_prefs: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          last_category_campaign: string | null
          last_category_idea: string | null
          last_category_series: string | null
          last_filter_category: string | null
          last_sort_option: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          last_category_campaign?: string | null
          last_category_idea?: string | null
          last_category_series?: string | null
          last_filter_category?: string | null
          last_sort_option?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          last_category_campaign?: string | null
          last_category_idea?: string | null
          last_category_series?: string | null
          last_filter_category?: string | null
          last_sort_option?: string | null
          updated_at?: string
          user_id?: string
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
          render_status: string
          rendered_video_url: string | null
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
          render_status?: string
          rendered_video_url?: string | null
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
          render_status?: string
          rendered_video_url?: string | null
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
          video_url: string | null
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
          video_url?: string | null
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
          video_url?: string | null
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
      weekly_blueprints: {
        Row: {
          approved_at: string | null
          brand_id: string
          created_at: string
          id: string
          source: string
          status: string
          updated_at: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          approved_at?: string | null
          brand_id: string
          created_at?: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          approved_at?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_brand_access: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
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
      is_active_brand_member: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      is_brand_owner: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      lock_autopilot_idea: { Args: { p_idea_id: string }; Returns: string }
      process_referral: { Args: { p_user_id: string }; Returns: Json }
      record_preset_feedback: {
        Args: { p_design_id: string; p_vote: number }
        Returns: undefined
      }
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
