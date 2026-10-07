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
          tier: string
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
          tier?: string
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
          tier?: string
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
          paused_at: string | null
          paused_reason: string | null
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
          paused_at?: string | null
          paused_reason?: string | null
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
          paused_at?: string | null
          paused_reason?: string | null
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
      brand_competitors: {
        Row: {
          brand_id: string
          created_at: string
          discovery_rationale: string | null
          discovery_source: string
          domain: string | null
          id: string
          instagram_handle: string | null
          is_active: boolean
          last_scanned_at: string | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          discovery_rationale?: string | null
          discovery_source?: string
          domain?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          last_scanned_at?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          discovery_rationale?: string | null
          discovery_source?: string
          domain?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          last_scanned_at?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_competitors_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
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
          label: string | null
          position: number
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          image_url: string
          label?: string | null
          position?: number
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string
          label?: string | null
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
          report_accent_color: string | null
          report_logo_url: string | null
          report_title: string | null
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
          report_accent_color?: string | null
          report_logo_url?: string | null
          report_title?: string | null
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
          report_accent_color?: string | null
          report_logo_url?: string | null
          report_title?: string | null
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
      campaign_page_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_name: string
          id: string
          referral_slug: string | null
          section_key: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_name: string
          id?: string
          referral_slug?: string | null
          section_key?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_name?: string
          id?: string
          referral_slug?: string | null
          section_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_page_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns_public"
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
          is_active: boolean
          name: string
          post_count: number
          priority: number
          user_id: string
        }
        Insert: {
          brand_id: string
          content_category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          post_count?: number
          priority?: number
          user_id: string
        }
        Update: {
          brand_id?: string
          content_category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          post_count?: number
          priority?: number
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
      campaigns_public: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          audience: string | null
          clicks_count: number
          copy: Json
          created_at: string
          deactivated_at: string | null
          ends_at: string | null
          goal: string | null
          id: string
          name: string
          offer_text: string | null
          partner_campaign_id: string | null
          partner_id: string | null
          review_note: string | null
          sections: Json
          signups_count: number
          slug: string
          starts_at: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          views_count: number
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          audience?: string | null
          clicks_count?: number
          copy?: Json
          created_at?: string
          deactivated_at?: string | null
          ends_at?: string | null
          goal?: string | null
          id?: string
          name: string
          offer_text?: string | null
          partner_campaign_id?: string | null
          partner_id?: string | null
          review_note?: string | null
          sections?: Json
          signups_count?: number
          slug: string
          starts_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          views_count?: number
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          audience?: string | null
          clicks_count?: number
          copy?: Json
          created_at?: string
          deactivated_at?: string | null
          ends_at?: string | null
          goal?: string | null
          id?: string
          name?: string
          offer_text?: string | null
          partner_campaign_id?: string | null
          partner_id?: string | null
          review_note?: string | null
          sections?: Json
          signups_count?: number
          slug?: string
          starts_at?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_public_partner_campaign_id_fkey"
            columns: ["partner_campaign_id"]
            isOneToOne: false
            referencedRelation: "partner_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_public_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
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
      competitor_signals: {
        Row: {
          acted_on: boolean
          brand_id: string
          competitor_id: string
          content_idea_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          rationale: string | null
          signal_type: string
          summary: string
          week_start_date: string
        }
        Insert: {
          acted_on?: boolean
          brand_id: string
          competitor_id: string
          content_idea_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rationale?: string | null
          signal_type: string
          summary: string
          week_start_date: string
        }
        Update: {
          acted_on?: boolean
          brand_id?: string
          competitor_id?: string
          content_idea_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          rationale?: string | null
          signal_type?: string
          summary?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_signals_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_signals_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "brand_competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_signals_content_idea_id_fkey"
            columns: ["content_idea_id"]
            isOneToOne: false
            referencedRelation: "content_ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_snapshots: {
        Row: {
          brand_id: string
          competitor_id: string
          cost_credits: number | null
          created_at: string
          error: string | null
          extracted: Json | null
          id: string
          raw: Json | null
          scanned_at: string
          source: string
          tokens_used: number | null
          week_start_date: string
        }
        Insert: {
          brand_id: string
          competitor_id: string
          cost_credits?: number | null
          created_at?: string
          error?: string | null
          extracted?: Json | null
          id?: string
          raw?: Json | null
          scanned_at?: string
          source: string
          tokens_used?: number | null
          week_start_date: string
        }
        Update: {
          brand_id?: string
          competitor_id?: string
          cost_credits?: number | null
          created_at?: string
          error?: string | null
          extracted?: Json | null
          id?: string
          raw?: Json | null
          scanned_at?: string
          source?: string
          tokens_used?: number | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_snapshots_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_snapshots_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "brand_competitors"
            referencedColumns: ["id"]
          },
        ]
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
          creator_network_source_id: string | null
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
          creator_network_source_id?: string | null
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
          creator_network_source_id?: string | null
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
      creator_network_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          is_test: boolean
          new_state: string | null
          previous_state: string | null
          reason: string | null
          record_source: string
          source: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          is_test?: boolean
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          record_source?: string
          source?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_test?: boolean
          new_state?: string | null
          previous_state?: string | null
          reason?: string | null
          record_source?: string
          source?: string | null
        }
        Relationships: []
      }
      creator_network_ai_runs: {
        Row: {
          agent: string
          confidence: string | null
          created_at: string
          ended_at: string | null
          entity_id: string | null
          entity_type: string | null
          error: string | null
          evidence: Json | null
          id: string
          input: Json
          is_test: boolean
          model_used: string | null
          objective: string
          output: Json | null
          record_source: string
          review_decision: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string | null
          status: string
          task_id: string | null
          triggered_by: string | null
        }
        Insert: {
          agent: string
          confidence?: string | null
          created_at?: string
          ended_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          evidence?: Json | null
          id?: string
          input?: Json
          is_test?: boolean
          model_used?: string | null
          objective: string
          output?: Json | null
          record_source?: string
          review_decision?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          triggered_by?: string | null
        }
        Update: {
          agent?: string
          confidence?: string | null
          created_at?: string
          ended_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error?: string | null
          evidence?: Json | null
          id?: string
          input?: Json
          is_test?: boolean
          model_used?: string | null
          objective?: string
          output?: Json | null
          record_source?: string
          review_decision?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string | null
          status?: string
          task_id?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_ai_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "creator_network_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_audience_profiles: {
        Row: {
          affluence_segment: string | null
          age_range: string | null
          audience_description: string | null
          cities_regions: string[]
          confidence: string | null
          created_at: string
          creator_id: string
          date_observed: string | null
          evidence_classification: string
          evidence_type: string | null
          gender_composition: string | null
          geography: string | null
          id: string
          interests: string[]
          is_test: boolean
          lifestyle: string | null
          purchasing_categories: string[]
          record_source: string
          source: string | null
          updated_at: string
        }
        Insert: {
          affluence_segment?: string | null
          age_range?: string | null
          audience_description?: string | null
          cities_regions?: string[]
          confidence?: string | null
          created_at?: string
          creator_id: string
          date_observed?: string | null
          evidence_classification?: string
          evidence_type?: string | null
          gender_composition?: string | null
          geography?: string | null
          id?: string
          interests?: string[]
          is_test?: boolean
          lifestyle?: string | null
          purchasing_categories?: string[]
          record_source?: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          affluence_segment?: string | null
          age_range?: string | null
          audience_description?: string | null
          cities_regions?: string[]
          confidence?: string | null
          created_at?: string
          creator_id?: string
          date_observed?: string | null
          evidence_classification?: string
          evidence_type?: string | null
          gender_composition?: string | null
          geography?: string | null
          id?: string
          interests?: string[]
          is_test?: boolean
          lifestyle?: string | null
          purchasing_categories?: string[]
          record_source?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_audience_profiles_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_brand_safety_reviews: {
        Row: {
          created_at: string
          creator_id: string
          evidence: string | null
          human_decision: string | null
          id: string
          is_test: boolean
          notes: string | null
          public_issue: string | null
          record_source: string
          reviewed: boolean
          reviewed_at: string | null
          reviewer: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          evidence?: string | null
          human_decision?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          public_issue?: string | null
          record_source?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewer?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          evidence?: string | null
          human_decision?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          public_issue?: string | null
          record_source?: string
          reviewed?: boolean
          reviewed_at?: string | null
          reviewer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_brand_safety_reviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_concepts: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          brand_id: string | null
          claims: Json
          code: string
          concept_name: string
          created_at: string
          creative_score: number | null
          creator_id: string | null
          creator_role: string | null
          cta: string | null
          duration_seconds: number | null
          format: string | null
          hook: string | null
          id: string
          is_test: boolean
          opportunity_id: string
          platform: string | null
          product_id: string | null
          product_placement: string | null
          product_source: string | null
          production_complexity: string | null
          prospect_id: string | null
          record_source: string
          required_assets: string | null
          status: string
          story_structure: string | null
          strategic_idea: string | null
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string | null
          claims?: Json
          code?: string
          concept_name: string
          created_at?: string
          creative_score?: number | null
          creator_id?: string | null
          creator_role?: string | null
          cta?: string | null
          duration_seconds?: number | null
          format?: string | null
          hook?: string | null
          id?: string
          is_test?: boolean
          opportunity_id: string
          platform?: string | null
          product_id?: string | null
          product_placement?: string | null
          product_source?: string | null
          production_complexity?: string | null
          prospect_id?: string | null
          record_source?: string
          required_assets?: string | null
          status?: string
          story_structure?: string | null
          strategic_idea?: string | null
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          brand_id?: string | null
          claims?: Json
          code?: string
          concept_name?: string
          created_at?: string
          creative_score?: number | null
          creator_id?: string | null
          creator_role?: string | null
          cta?: string | null
          duration_seconds?: number | null
          format?: string | null
          hook?: string | null
          id?: string
          is_test?: boolean
          opportunity_id?: string
          platform?: string | null
          product_id?: string | null
          product_placement?: string | null
          product_source?: string | null
          production_complexity?: string | null
          prospect_id?: string | null
          record_source?: string
          required_assets?: string | null
          status?: string
          story_structure?: string | null
          strategic_idea?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_concepts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_concepts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_creators: {
        Row: {
          ai_likeness_suitability: number | null
          audience_commercial_relevance: number | null
          brand_safety_status: string
          camera_presence: number | null
          code: string
          commercial_category_breadth: number | null
          contact_details: Json
          contact_status: string
          content_formats: string[]
          content_versatility: number | null
          created_at: string
          display_name: string
          engagement_indicators: Json
          evidence_confidence: string | null
          fit_score: number | null
          handle: string | null
          human_owner: string | null
          id: string
          is_test: boolean
          languages: string[]
          legal_name: string | null
          licensing_interest: string
          location: string | null
          next_action: string | null
          notes: string | null
          persona: string | null
          primary_niche: string | null
          priority_tier: string | null
          profile_image_path: string | null
          public_urls: Json
          reach_indicators: Json
          record_source: string
          recruitability: number | null
          secondary_niches: string[]
          status: string
          updated_at: string
          user_id: string | null
          voice_suitability: number | null
        }
        Insert: {
          ai_likeness_suitability?: number | null
          audience_commercial_relevance?: number | null
          brand_safety_status?: string
          camera_presence?: number | null
          code?: string
          commercial_category_breadth?: number | null
          contact_details?: Json
          contact_status?: string
          content_formats?: string[]
          content_versatility?: number | null
          created_at?: string
          display_name: string
          engagement_indicators?: Json
          evidence_confidence?: string | null
          fit_score?: number | null
          handle?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          languages?: string[]
          legal_name?: string | null
          licensing_interest?: string
          location?: string | null
          next_action?: string | null
          notes?: string | null
          persona?: string | null
          primary_niche?: string | null
          priority_tier?: string | null
          profile_image_path?: string | null
          public_urls?: Json
          reach_indicators?: Json
          record_source?: string
          recruitability?: number | null
          secondary_niches?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
          voice_suitability?: number | null
        }
        Update: {
          ai_likeness_suitability?: number | null
          audience_commercial_relevance?: number | null
          brand_safety_status?: string
          camera_presence?: number | null
          code?: string
          commercial_category_breadth?: number | null
          contact_details?: Json
          contact_status?: string
          content_formats?: string[]
          content_versatility?: number | null
          created_at?: string
          display_name?: string
          engagement_indicators?: Json
          evidence_confidence?: string | null
          fit_score?: number | null
          handle?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          languages?: string[]
          legal_name?: string | null
          licensing_interest?: string
          location?: string | null
          next_action?: string | null
          notes?: string | null
          persona?: string | null
          primary_niche?: string | null
          priority_tier?: string | null
          profile_image_path?: string | null
          public_urls?: Json
          reach_indicators?: Json
          record_source?: string
          recruitability?: number | null
          secondary_niches?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
          voice_suitability?: number | null
        }
        Relationships: []
      }
      creator_network_earnings: {
        Row: {
          created_at: string
          creator_id: string
          currency: string
          earning_type: string
          fixed_fee: number
          gross_sale_amount: number | null
          id: string
          is_test: boolean
          opportunity_id: string | null
          paid_at: string | null
          payable_amount: number
          payout_id: string | null
          payout_reference: string | null
          record_source: string
          royalty: number
          sale_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          currency?: string
          earning_type?: string
          fixed_fee?: number
          gross_sale_amount?: number | null
          id?: string
          is_test?: boolean
          opportunity_id?: string | null
          paid_at?: string | null
          payable_amount?: number
          payout_id?: string | null
          payout_reference?: string | null
          record_source?: string
          royalty?: number
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          currency?: string
          earning_type?: string
          fixed_fee?: number
          gross_sale_amount?: number | null
          id?: string
          is_test?: boolean
          opportunity_id?: string | null
          paid_at?: string | null
          payable_amount?: number
          payout_id?: string | null
          payout_reference?: string | null
          record_source?: string
          royalty?: number
          sale_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_earnings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_earnings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_earnings_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "creator_network_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_earnings_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "creator_network_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_experiments: {
        Row: {
          conclusion: string | null
          created_at: string
          ended_at: string | null
          hypothesis: string
          id: string
          is_test: boolean
          metric_key: string | null
          notes: string | null
          owner: string | null
          record_source: string
          started_at: string | null
          status: string
          success_criteria: string | null
          updated_at: string
        }
        Insert: {
          conclusion?: string | null
          created_at?: string
          ended_at?: string | null
          hypothesis: string
          id?: string
          is_test?: boolean
          metric_key?: string | null
          notes?: string | null
          owner?: string | null
          record_source?: string
          started_at?: string | null
          status?: string
          success_criteria?: string | null
          updated_at?: string
        }
        Update: {
          conclusion?: string | null
          created_at?: string
          ended_at?: string | null
          hypothesis?: string
          id?: string
          is_test?: boolean
          metric_key?: string | null
          notes?: string | null
          owner?: string | null
          record_source?: string
          started_at?: string | null
          status?: string
          success_criteria?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      creator_network_findings: {
        Row: {
          brand_id: string | null
          confidence: string | null
          created_at: string
          created_by: string | null
          creator_id: string | null
          data_type: string | null
          evidence_classification: string
          finding: string
          id: string
          is_current: boolean
          is_test: boolean
          last_verified_at: string | null
          match_id: string | null
          notes: string | null
          opportunity_id: string | null
          product_id: string | null
          prospect_id: string | null
          record_source: string
          related_entity_type: string
          research_agent: string | null
          retrieved_at: string | null
          source_name: string | null
          source_url: string | null
          supersedes_finding_id: string | null
        }
        Insert: {
          brand_id?: string | null
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          creator_id?: string | null
          data_type?: string | null
          evidence_classification?: string
          finding: string
          id?: string
          is_current?: boolean
          is_test?: boolean
          last_verified_at?: string | null
          match_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          product_id?: string | null
          prospect_id?: string | null
          record_source?: string
          related_entity_type: string
          research_agent?: string | null
          retrieved_at?: string | null
          source_name?: string | null
          source_url?: string | null
          supersedes_finding_id?: string | null
        }
        Update: {
          brand_id?: string | null
          confidence?: string | null
          created_at?: string
          created_by?: string | null
          creator_id?: string | null
          data_type?: string | null
          evidence_classification?: string
          finding?: string
          id?: string
          is_current?: boolean
          is_test?: boolean
          last_verified_at?: string | null
          match_id?: string | null
          notes?: string | null
          opportunity_id?: string | null
          product_id?: string | null
          prospect_id?: string | null
          record_source?: string
          related_entity_type?: string
          research_agent?: string | null
          retrieved_at?: string | null
          source_name?: string | null
          source_url?: string | null
          supersedes_finding_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_findings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_findings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "creator_network_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_findings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_findings_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "creator_network_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_findings_supersedes_finding_id_fkey"
            columns: ["supersedes_finding_id"]
            isOneToOne: false
            referencedRelation: "creator_network_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_interviews: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          interviewer: string | null
          is_test: boolean
          record_source: string
          responses: Json
          scheduled_at: string | null
          status: string
          submitted_at: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          interviewer?: string | null
          is_test?: boolean
          record_source?: string
          responses?: Json
          scheduled_at?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          interviewer?: string | null
          is_test?: boolean
          record_source?: string
          responses?: Json
          scheduled_at?: string | null
          status?: string
          submitted_at?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_interviews_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_licences: {
        Row: {
          agreement_path: string | null
          approval_requirements: string | null
          brand_id: string | null
          compensation_model: string | null
          created_at: string
          creator_approval_required: boolean
          creator_id: string
          creator_posted_permission: boolean
          currency: string
          digital_twin_permission: boolean
          duration_months: number | null
          expires_at: string | null
          fixed_fee: number | null
          id: string
          is_test: boolean
          licence_scope: string
          likeness_permission: boolean
          notes: string | null
          opportunity_id: string | null
          organic_social_permission: boolean
          paid_advertising_permission: boolean
          payment_status: string
          platforms: string[]
          production_job_id: string | null
          prospect_id: string | null
          record_source: string
          restricted_brands: string[]
          restricted_categories: string[]
          revocation_reason: string | null
          revoked: boolean
          revoked_at: string | null
          royalty_rate: number | null
          starts_at: string | null
          status: string
          territories: string[]
          updated_at: string
          voice_permission: boolean
        }
        Insert: {
          agreement_path?: string | null
          approval_requirements?: string | null
          brand_id?: string | null
          compensation_model?: string | null
          created_at?: string
          creator_approval_required?: boolean
          creator_id: string
          creator_posted_permission?: boolean
          currency?: string
          digital_twin_permission?: boolean
          duration_months?: number | null
          expires_at?: string | null
          fixed_fee?: number | null
          id?: string
          is_test?: boolean
          licence_scope?: string
          likeness_permission?: boolean
          notes?: string | null
          opportunity_id?: string | null
          organic_social_permission?: boolean
          paid_advertising_permission?: boolean
          payment_status?: string
          platforms?: string[]
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          restricted_brands?: string[]
          restricted_categories?: string[]
          revocation_reason?: string | null
          revoked?: boolean
          revoked_at?: string | null
          royalty_rate?: number | null
          starts_at?: string | null
          status?: string
          territories?: string[]
          updated_at?: string
          voice_permission?: boolean
        }
        Update: {
          agreement_path?: string | null
          approval_requirements?: string | null
          brand_id?: string | null
          compensation_model?: string | null
          created_at?: string
          creator_approval_required?: boolean
          creator_id?: string
          creator_posted_permission?: boolean
          currency?: string
          digital_twin_permission?: boolean
          duration_months?: number | null
          expires_at?: string | null
          fixed_fee?: number | null
          id?: string
          is_test?: boolean
          licence_scope?: string
          likeness_permission?: boolean
          notes?: string | null
          opportunity_id?: string | null
          organic_social_permission?: boolean
          paid_advertising_permission?: boolean
          payment_status?: string
          platforms?: string[]
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          restricted_brands?: string[]
          restricted_categories?: string[]
          revocation_reason?: string | null
          revoked?: boolean
          revoked_at?: string | null
          royalty_rate?: number | null
          starts_at?: string | null
          status?: string
          territories?: string[]
          updated_at?: string
          voice_permission?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_licences_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_licences_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_matches: {
        Row: {
          brand_id: string | null
          code: string
          confidence: string | null
          created_at: string
          creator_id: string
          evaluated_at: string | null
          id: string
          is_test: boolean
          priority: string | null
          product_id: string | null
          product_source: string | null
          prospect_id: string | null
          reasoning: string | null
          record_source: string
          risks: string | null
          score_version: string
          scores: Json
          status: string
          total_score: number | null
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          code?: string
          confidence?: string | null
          created_at?: string
          creator_id: string
          evaluated_at?: string | null
          id?: string
          is_test?: boolean
          priority?: string | null
          product_id?: string | null
          product_source?: string | null
          prospect_id?: string | null
          reasoning?: string | null
          record_source?: string
          risks?: string | null
          score_version?: string
          scores?: Json
          status?: string
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          code?: string
          confidence?: string | null
          created_at?: string
          creator_id?: string
          evaluated_at?: string | null
          id?: string
          is_test?: boolean
          priority?: string | null
          product_id?: string | null
          product_source?: string | null
          prospect_id?: string | null
          reasoning?: string | null
          record_source?: string
          risks?: string | null
          score_version?: string
          scores?: Json
          status?: string
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_matches_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_matches_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "creator_network_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_network_opportunities: {
        Row: {
          blocker: string | null
          brand_id: string | null
          campaign_objective: string | null
          code: string
          created_at: string
          creative_angle: string | null
          creator_id: string
          creator_royalty_estimate: number | null
          currency: string
          estimated_production_cost: number | null
          expected_complexity: string | null
          expected_gross_margin: number | null
          human_owner: string | null
          id: string
          is_test: boolean
          lost_reason: string | null
          match_id: string | null
          next_action: string | null
          notes: string | null
          opportunity_score: number | null
          outcome: string | null
          priority: string | null
          product_id: string | null
          product_source: string | null
          proposed_selling_price: number | null
          prospect_id: string | null
          recommended_format: string | null
          record_source: string
          stage: string
          updated_at: string
        }
        Insert: {
          blocker?: string | null
          brand_id?: string | null
          campaign_objective?: string | null
          code?: string
          created_at?: string
          creative_angle?: string | null
          creator_id: string
          creator_royalty_estimate?: number | null
          currency?: string
          estimated_production_cost?: number | null
          expected_complexity?: string | null
          expected_gross_margin?: number | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          lost_reason?: string | null
          match_id?: string | null
          next_action?: string | null
          notes?: string | null
          opportunity_score?: number | null
          outcome?: string | null
          priority?: string | null
          product_id?: string | null
          product_source?: string | null
          proposed_selling_price?: number | null
          prospect_id?: string | null
          recommended_format?: string | null
          record_source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          blocker?: string | null
          brand_id?: string | null
          campaign_objective?: string | null
          code?: string
          created_at?: string
          creative_angle?: string | null
          creator_id?: string
          creator_royalty_estimate?: number | null
          currency?: string
          estimated_production_cost?: number | null
          expected_complexity?: string | null
          expected_gross_margin?: number | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          lost_reason?: string | null
          match_id?: string | null
          next_action?: string | null
          notes?: string | null
          opportunity_score?: number | null
          outcome?: string | null
          priority?: string | null
          product_id?: string | null
          product_source?: string | null
          proposed_selling_price?: number | null
          prospect_id?: string | null
          recommended_format?: string | null
          record_source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_opportunities_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_opportunities_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "creator_network_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_opportunities_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "creator_network_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_payouts: {
        Row: {
          amount: number
          created_at: string
          creator_id: string
          currency: string
          id: string
          is_test: boolean
          method: string | null
          notes: string | null
          paid_at: string | null
          record_source: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          creator_id: string
          currency?: string
          id?: string
          is_test?: boolean
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          record_source?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string
          currency?: string
          id?: string
          is_test?: boolean
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          record_source?: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_payouts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_production_jobs: {
        Row: {
          blocked: boolean
          blocker: string | null
          brand_id: string | null
          clean_master_path: string | null
          code: string
          concept_id: string
          created_at: string
          creator_id: string
          design_job_id: string | null
          human_intervention_count: number
          human_owner: string | null
          id: string
          is_test: boolean
          notes: string | null
          opportunity_id: string
          output_url: string | null
          preview_path: string | null
          product_id: string | null
          product_source: string | null
          production_cost: number
          prospect_id: string | null
          record_source: string
          regeneration_count: number
          rights_mode: string
          stage: string
          updated_at: string
          video_project_id: string | null
        }
        Insert: {
          blocked?: boolean
          blocker?: string | null
          brand_id?: string | null
          clean_master_path?: string | null
          code?: string
          concept_id: string
          created_at?: string
          creator_id: string
          design_job_id?: string | null
          human_intervention_count?: number
          human_owner?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          opportunity_id: string
          output_url?: string | null
          preview_path?: string | null
          product_id?: string | null
          product_source?: string | null
          production_cost?: number
          prospect_id?: string | null
          record_source?: string
          regeneration_count?: number
          rights_mode?: string
          stage?: string
          updated_at?: string
          video_project_id?: string | null
        }
        Update: {
          blocked?: boolean
          blocker?: string | null
          brand_id?: string | null
          clean_master_path?: string | null
          code?: string
          concept_id?: string
          created_at?: string
          creator_id?: string
          design_job_id?: string | null
          human_intervention_count?: number
          human_owner?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          opportunity_id?: string
          output_url?: string | null
          preview_path?: string | null
          product_id?: string | null
          product_source?: string | null
          production_cost?: number
          prospect_id?: string | null
          record_source?: string
          regeneration_count?: number
          rights_mode?: string
          stage?: string
          updated_at?: string
          video_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_production_jobs_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "creator_network_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_production_jobs_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_production_jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_production_reviews: {
        Row: {
          ai_output: string | null
          created_at: string
          decision: string
          human_edit: string | null
          id: string
          is_test: boolean
          job_id: string
          output_url: string | null
          reason: string | null
          record_source: string
          reviewed_at: string
          reviewer: string | null
          stage: string
        }
        Insert: {
          ai_output?: string | null
          created_at?: string
          decision: string
          human_edit?: string | null
          id?: string
          is_test?: boolean
          job_id: string
          output_url?: string | null
          reason?: string | null
          record_source?: string
          reviewed_at?: string
          reviewer?: string | null
          stage: string
        }
        Update: {
          ai_output?: string | null
          created_at?: string
          decision?: string
          human_edit?: string | null
          id?: string
          is_test?: boolean
          job_id?: string
          output_url?: string | null
          reason?: string | null
          record_source?: string
          reviewed_at?: string
          reviewer?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_production_reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "creator_network_production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_prospect_products: {
        Row: {
          category: string | null
          created_at: string
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          is_test: boolean
          name: string
          price: number | null
          product_url: string | null
          prospect_id: string
          record_source: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_test?: boolean
          name: string
          price?: number | null
          product_url?: string | null
          prospect_id: string
          record_source?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_test?: boolean
          name?: string
          price?: number | null
          product_url?: string | null
          prospect_id?: string
          record_source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_prospect_products_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "creator_network_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_prospects: {
        Row: {
          brand_positioning: string | null
          business_name: string
          category: string | null
          code: string
          commercial_activity: string | null
          content_formats: string[]
          converted_brand_id: string | null
          created_at: string
          evidence_confidence: string | null
          human_owner: string | null
          id: string
          is_test: boolean
          location: string | null
          next_action: string | null
          notes: string | null
          observed_content_gap: string | null
          products_summary: string | null
          public_contact: string | null
          purchase_ability_estimate: string | null
          reachability: string | null
          record_source: string
          spec_ad_potential: string | null
          subcategory: string | null
          target_customer: string | null
          updated_at: string
          urls: Json
          visual_style: string | null
        }
        Insert: {
          brand_positioning?: string | null
          business_name: string
          category?: string | null
          code?: string
          commercial_activity?: string | null
          content_formats?: string[]
          converted_brand_id?: string | null
          created_at?: string
          evidence_confidence?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          location?: string | null
          next_action?: string | null
          notes?: string | null
          observed_content_gap?: string | null
          products_summary?: string | null
          public_contact?: string | null
          purchase_ability_estimate?: string | null
          reachability?: string | null
          record_source?: string
          spec_ad_potential?: string | null
          subcategory?: string | null
          target_customer?: string | null
          updated_at?: string
          urls?: Json
          visual_style?: string | null
        }
        Update: {
          brand_positioning?: string | null
          business_name?: string
          category?: string | null
          code?: string
          commercial_activity?: string | null
          content_formats?: string[]
          converted_brand_id?: string | null
          created_at?: string
          evidence_confidence?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          location?: string | null
          next_action?: string | null
          notes?: string | null
          observed_content_gap?: string | null
          products_summary?: string | null
          public_contact?: string | null
          purchase_ability_estimate?: string | null
          reachability?: string | null
          record_source?: string
          spec_ad_potential?: string | null
          subcategory?: string | null
          target_customer?: string | null
          updated_at?: string
          urls?: Json
          visual_style?: string | null
        }
        Relationships: []
      }
      creator_network_sales: {
        Row: {
          brand_id: string | null
          channel: string | null
          code: string
          contact: string | null
          created_at: string
          creator_id: string | null
          creator_royalty: number | null
          currency: string
          follow_up_at: string | null
          id: string
          is_test: boolean
          notes: string | null
          offer_price: number | null
          opportunity_id: string
          outreach_approved_at: string | null
          outreach_approved_by: string | null
          outreach_message: string | null
          paid_amount: number | null
          payment_status: string
          product_id: string | null
          product_source: string | null
          production_job_id: string | null
          prospect_id: string | null
          record_source: string
          response: string | null
          response_classification: string | null
          salesperson: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand_id?: string | null
          channel?: string | null
          code?: string
          contact?: string | null
          created_at?: string
          creator_id?: string | null
          creator_royalty?: number | null
          currency?: string
          follow_up_at?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          offer_price?: number | null
          opportunity_id: string
          outreach_approved_at?: string | null
          outreach_approved_by?: string | null
          outreach_message?: string | null
          paid_amount?: number | null
          payment_status?: string
          product_id?: string | null
          product_source?: string | null
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          response?: string | null
          response_classification?: string | null
          salesperson?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string | null
          channel?: string | null
          code?: string
          contact?: string | null
          created_at?: string
          creator_id?: string | null
          creator_royalty?: number | null
          currency?: string
          follow_up_at?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          offer_price?: number | null
          opportunity_id?: string
          outreach_approved_at?: string | null
          outreach_approved_by?: string | null
          outreach_message?: string | null
          paid_amount?: number | null
          payment_status?: string
          product_id?: string | null
          product_source?: string | null
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          response?: string | null
          response_classification?: string | null
          salesperson?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_sales_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_sales_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_sales_production_job_id_fkey"
            columns: ["production_job_id"]
            isOneToOne: false
            referencedRelation: "creator_network_production_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      creator_network_tasks: {
        Row: {
          ai_agent: string | null
          blocker: string | null
          brand_id: string | null
          code: string
          completed_at: string | null
          context: string | null
          created_at: string
          creator_id: string | null
          depends_on_task_id: string | null
          due_at: string | null
          expected_output: string | null
          human_assignee: string | null
          id: string
          is_test: boolean
          match_id: string | null
          next_step: string | null
          opportunity_id: string | null
          output: string | null
          owner_type: string
          priority: string
          production_job_id: string | null
          prospect_id: string | null
          record_source: string
          required_input: string | null
          review_required: boolean
          reviewer: string | null
          status: string
          title: string
          updated_at: string
          why: string | null
        }
        Insert: {
          ai_agent?: string | null
          blocker?: string | null
          brand_id?: string | null
          code?: string
          completed_at?: string | null
          context?: string | null
          created_at?: string
          creator_id?: string | null
          depends_on_task_id?: string | null
          due_at?: string | null
          expected_output?: string | null
          human_assignee?: string | null
          id?: string
          is_test?: boolean
          match_id?: string | null
          next_step?: string | null
          opportunity_id?: string | null
          output?: string | null
          owner_type?: string
          priority?: string
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          required_input?: string | null
          review_required?: boolean
          reviewer?: string | null
          status?: string
          title: string
          updated_at?: string
          why?: string | null
        }
        Update: {
          ai_agent?: string | null
          blocker?: string | null
          brand_id?: string | null
          code?: string
          completed_at?: string | null
          context?: string | null
          created_at?: string
          creator_id?: string | null
          depends_on_task_id?: string | null
          due_at?: string | null
          expected_output?: string | null
          human_assignee?: string | null
          id?: string
          is_test?: boolean
          match_id?: string | null
          next_step?: string | null
          opportunity_id?: string | null
          output?: string | null
          owner_type?: string
          priority?: string
          production_job_id?: string | null
          prospect_id?: string | null
          record_source?: string
          required_input?: string | null
          review_required?: boolean
          reviewer?: string | null
          status?: string
          title?: string
          updated_at?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_tasks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_tasks_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "creator_network_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_tasks_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "creator_network_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "creator_network_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_tasks_production_job_id_fkey"
            columns: ["production_job_id"]
            isOneToOne: false
            referencedRelation: "creator_network_production_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_network_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "creator_network_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_network_validations: {
        Row: {
          completed_at: string | null
          created_at: string
          creator_id: string
          evidence: string | null
          evidence_classification: string
          follow_up: string | null
          human_owner: string | null
          id: string
          is_test: boolean
          notes: string | null
          owner_type: string
          question: string | null
          record_source: string
          requested_at: string | null
          response: string | null
          score: number | null
          status: string
          updated_at: string
          validation_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          creator_id: string
          evidence?: string | null
          evidence_classification?: string
          follow_up?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          owner_type?: string
          question?: string | null
          record_source?: string
          requested_at?: string | null
          response?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          validation_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          evidence?: string | null
          evidence_classification?: string
          follow_up?: string | null
          human_owner?: string | null
          id?: string
          is_test?: boolean
          notes?: string | null
          owner_type?: string
          question?: string | null
          record_source?: string
          requested_at?: string | null
          response?: string | null
          score?: number | null
          status?: string
          updated_at?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_network_validations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creator_network_creators"
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
          heartbeat_at: string | null
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
          heartbeat_at?: string | null
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
          heartbeat_at?: string | null
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
      design_schema_revisions: {
        Row: {
          created_at: string
          design_id: string
          id: string
          image_url: string | null
          label: string | null
          schema: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          design_id: string
          id?: string
          image_url?: string | null
          label?: string | null
          schema: Json
          user_id: string
        }
        Update: {
          created_at?: string
          design_id?: string
          id?: string
          image_url?: string | null
          label?: string | null
          schema?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_schema_revisions_design_id_fkey"
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
          content_category: string | null
          content_idea_id: string | null
          copy_structure: Json | null
          created_at: string
          creative_director_version: string | null
          design_schema: Json | null
          design_schema_version: number | null
          gallery_labels_used: string[] | null
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
          content_category?: string | null
          content_idea_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          creative_director_version?: string | null
          design_schema?: Json | null
          design_schema_version?: number | null
          gallery_labels_used?: string[] | null
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
          content_category?: string | null
          content_idea_id?: string | null
          copy_structure?: Json | null
          created_at?: string
          creative_director_version?: string | null
          design_schema?: Json | null
          design_schema_version?: number | null
          gallery_labels_used?: string[] | null
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
      email_sender_aliases: {
        Row: {
          brand_id: string | null
          created_at: string
          from_name: string
          handle: string
          id: string
          partner_id: string | null
          reply_to: string | null
          reply_to_token: string | null
          reply_to_verified_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          from_name: string
          handle: string
          id?: string
          partner_id?: string | null
          reply_to?: string | null
          reply_to_token?: string | null
          reply_to_verified_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          from_name?: string
          handle?: string
          id?: string
          partner_id?: string | null
          reply_to?: string | null
          reply_to_token?: string | null
          reply_to_verified_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sender_aliases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sender_aliases_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
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
      notification_email_outbox: {
        Row: {
          attempts: number
          created_at: string
          email_type: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          sent_at: string | null
          status: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          email_type: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          email_type?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email?: string
        }
        Relationships: []
      }
      partner_automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          email: string | null
          error: string | null
          id: string
          lead_user_id: string
          partner_id: string
          status: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          email?: string | null
          error?: string | null
          id?: string
          lead_user_id: string
          partner_id: string
          status?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          email?: string | null
          error?: string | null
          id?: string
          lead_user_id?: string
          partner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "partner_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_automation_runs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_automations: {
        Row: {
          active: boolean
          body: string
          created_at: string
          delay_hours: number
          id: string
          last_run_at: string | null
          name: string
          partner_id: string
          sent_count: number
          subject: string
          trigger: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          delay_hours?: number
          id?: string
          last_run_at?: string | null
          name: string
          partner_id: string
          sent_count?: number
          subject: string
          trigger: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          delay_hours?: number
          id?: string
          last_run_at?: string | null
          name?: string
          partner_id?: string
          sent_count?: number
          subject?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_automations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_campaign_sends: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          lead_user_id: string
          opened_at: string | null
          partner_id: string
          provider_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          lead_user_id: string
          opened_at?: string | null
          partner_id: string
          provider_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          lead_user_id?: string
          opened_at?: string | null
          partner_id?: string
          provider_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "partner_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_campaign_sends_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_campaigns: {
        Row: {
          audience: Json
          body: string
          clicked_count: number
          created_at: string
          delivered_count: number
          id: string
          name: string
          opened_count: number
          partner_id: string
          preheader: string | null
          recipients_count: number
          scheduled_for: string | null
          sent_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          body?: string
          clicked_count?: number
          created_at?: string
          delivered_count?: number
          id?: string
          name: string
          opened_count?: number
          partner_id: string
          preheader?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          body?: string
          clicked_count?: number
          created_at?: string
          delivered_count?: number
          id?: string
          name?: string
          opened_count?: number
          partner_id?: string
          preheader?: string | null
          recipients_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_campaigns_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_credit_grants: {
        Row: {
          created_at: string
          credits_granted: number
          credits_per_signup: number
          ends_at: string
          id: string
          leads_credited: number
          partner_id: string
          request_note: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          starts_at: string
          status: string
          total_budget_credits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_granted?: number
          credits_per_signup: number
          ends_at: string
          id?: string
          leads_credited?: number
          partner_id: string
          request_note?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          total_budget_credits: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_granted?: number
          credits_per_signup?: number
          ends_at?: string
          id?: string
          leads_credited?: number
          partner_id?: string
          request_note?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          starts_at?: string
          status?: string
          total_budget_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_credit_grants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_email_suppression: {
        Row: {
          created_at: string
          email: string
          id: string
          partner_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          partner_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          partner_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_email_suppression_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_leads: {
        Row: {
          attributed_at: string
          created_at: string
          credit_grant_id: string | null
          credited_at: string | null
          credits_granted: number
          id: string
          partner_id: string
          referral_code: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attributed_at?: string
          created_at?: string
          credit_grant_id?: string | null
          credited_at?: string | null
          credits_granted?: number
          id?: string
          partner_id: string
          referral_code?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attributed_at?: string
          created_at?: string
          credit_grant_id?: string | null
          credited_at?: string | null
          credits_granted?: number
          id?: string
          partner_id?: string
          referral_code?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_leads_credit_grant_id_fkey"
            columns: ["credit_grant_id"]
            isOneToOne: false
            referencedRelation: "partner_credit_grants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_profiles: {
        Row: {
          affiliate_id: string | null
          commission_first_pct: number
          commission_recurring_pct: number
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          end_date: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          organization: string | null
          partner_type: string
          slug: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          commission_first_pct?: number
          commission_recurring_pct?: number
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          partner_type?: string
          slug: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_id?: string | null
          commission_first_pct?: number
          commission_recurring_pct?: number
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          partner_type?: string
          slug?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_profiles_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referral_links: {
        Row: {
          active: boolean
          click_count: number
          code: string
          created_at: string
          id: string
          label: string
          partner_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          click_count?: number
          code: string
          created_at?: string
          id?: string
          label?: string
          partner_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          click_count?: number
          code?: string
          created_at?: string
          id?: string
          label?: string
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_referral_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
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
      private_network_activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          is_test: boolean
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          is_test?: boolean
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_test?: boolean
        }
        Relationships: []
      }
      private_network_allowed_domains: {
        Row: {
          approved_by: string | null
          brand_id: string
          created_at: string
          host: string
          id: string
        }
        Insert: {
          approved_by?: string | null
          brand_id: string
          created_at?: string
          host: string
          id?: string
        }
        Update: {
          approved_by?: string | null
          brand_id?: string
          created_at?: string
          host?: string
          id?: string
        }
        Relationships: []
      }
      private_network_campaigns: {
        Row: {
          action_bonus_ngn: number
          base_fee_ngn: number
          brand_id: string
          budget_ngn: number
          budget_reserved_ngn: number
          budget_spent_ngn: number
          code: string
          content_category: string | null
          conversion_commission_pct: number
          created_at: string
          description: string | null
          ends_at: string | null
          funded_amount_ngn: number
          funding_reference: string | null
          funding_status: string
          id: string
          is_test: boolean
          landing_host: string | null
          landing_url: string
          max_placements: number | null
          min_audience: number | null
          name: string
          owner_user_id: string
          per_publisher_cap: number
          record_source: string
          review_note: string | null
          starts_at: string
          status: string
          target_age_brackets: string[]
          target_geographies: string[]
          target_interests: string[]
          target_languages: string[]
          target_platforms: string[]
          updated_at: string
        }
        Insert: {
          action_bonus_ngn?: number
          base_fee_ngn?: number
          brand_id: string
          budget_ngn?: number
          budget_reserved_ngn?: number
          budget_spent_ngn?: number
          code?: string
          content_category?: string | null
          conversion_commission_pct?: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          funded_amount_ngn?: number
          funding_reference?: string | null
          funding_status?: string
          id?: string
          is_test?: boolean
          landing_host?: string | null
          landing_url: string
          max_placements?: number | null
          min_audience?: number | null
          name: string
          owner_user_id: string
          per_publisher_cap?: number
          record_source?: string
          review_note?: string | null
          starts_at?: string
          status?: string
          target_age_brackets?: string[]
          target_geographies?: string[]
          target_interests?: string[]
          target_languages?: string[]
          target_platforms?: string[]
          updated_at?: string
        }
        Update: {
          action_bonus_ngn?: number
          base_fee_ngn?: number
          brand_id?: string
          budget_ngn?: number
          budget_reserved_ngn?: number
          budget_spent_ngn?: number
          code?: string
          content_category?: string | null
          conversion_commission_pct?: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          funded_amount_ngn?: number
          funding_reference?: string | null
          funding_status?: string
          id?: string
          is_test?: boolean
          landing_host?: string | null
          landing_url?: string
          max_placements?: number | null
          min_audience?: number | null
          name?: string
          owner_user_id?: string
          per_publisher_cap?: number
          record_source?: string
          review_note?: string | null
          starts_at?: string
          status?: string
          target_age_brackets?: string[]
          target_geographies?: string[]
          target_interests?: string[]
          target_languages?: string[]
          target_platforms?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_creatives: {
        Row: {
          campaign_id: string
          caption: string | null
          cn_licence_id: string | null
          cn_production_job_id: string | null
          created_at: string
          created_by: string | null
          creator_approval_recorded: boolean
          design_id: string | null
          id: string
          is_test: boolean
          media_source: string
          media_type: string
          private_redistribution_confirmed: boolean
          private_redistribution_evidence: string | null
          public_media_url: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          rights_attestation: string | null
          rights_attested: boolean
          rights_attested_at: string | null
          rights_attested_by: string | null
          rights_expires_at: string | null
          rights_platforms: string[]
          source_master_etag: string | null
          source_master_path: string | null
          source_opportunity_id: string | null
          status: string
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          cn_licence_id?: string | null
          cn_production_job_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_approval_recorded?: boolean
          design_id?: string | null
          id?: string
          is_test?: boolean
          media_source: string
          media_type: string
          private_redistribution_confirmed?: boolean
          private_redistribution_evidence?: string | null
          public_media_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_attestation?: string | null
          rights_attested?: boolean
          rights_attested_at?: string | null
          rights_attested_by?: string | null
          rights_expires_at?: string | null
          rights_platforms?: string[]
          source_master_etag?: string | null
          source_master_path?: string | null
          source_opportunity_id?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          cn_licence_id?: string | null
          cn_production_job_id?: string | null
          created_at?: string
          created_by?: string | null
          creator_approval_recorded?: boolean
          design_id?: string | null
          id?: string
          is_test?: boolean
          media_source?: string
          media_type?: string
          private_redistribution_confirmed?: boolean
          private_redistribution_evidence?: string | null
          public_media_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          rights_attestation?: string | null
          rights_attested?: boolean
          rights_attested_at?: string | null
          rights_attested_by?: string | null
          rights_expires_at?: string | null
          rights_platforms?: string[]
          source_master_etag?: string | null
          source_master_path?: string | null
          source_opportunity_id?: string | null
          status?: string
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "private_network_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_earning_allocations: {
        Row: {
          amount: number
          batch: string | null
          created_at: string
          created_by: string | null
          earning_entry_id: string
          id: string
          is_test: boolean
          kind: string
          ledger_entry_id: string | null
        }
        Insert: {
          amount: number
          batch?: string | null
          created_at?: string
          created_by?: string | null
          earning_entry_id: string
          id?: string
          is_test?: boolean
          kind: string
          ledger_entry_id?: string | null
        }
        Update: {
          amount?: number
          batch?: string | null
          created_at?: string
          created_by?: string | null
          earning_entry_id?: string
          id?: string
          is_test?: boolean
          kind?: string
          ledger_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_network_earning_allocations_earning_entry_id_fkey"
            columns: ["earning_entry_id"]
            isOneToOne: true
            referencedRelation: "private_network_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_earning_allocations_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "private_network_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_events: {
        Row: {
          actor_user_id: string | null
          amount: number | null
          caller_user_id: string | null
          created_at: string
          earned_amount: number
          event_type: string
          external_event_id: string | null
          id: string
          integration_key_id: string | null
          ip_hash: string | null
          is_test: boolean
          outcome: string
          placement_id: string
          reconcile_note: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          source: string
          trust_level: string
          ua_hash: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount?: number | null
          caller_user_id?: string | null
          created_at?: string
          earned_amount?: number
          event_type: string
          external_event_id?: string | null
          id?: string
          integration_key_id?: string | null
          ip_hash?: string | null
          is_test?: boolean
          outcome?: string
          placement_id: string
          reconcile_note?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          source: string
          trust_level?: string
          ua_hash?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number | null
          caller_user_id?: string | null
          created_at?: string
          earned_amount?: number
          event_type?: string
          external_event_id?: string | null
          id?: string
          integration_key_id?: string | null
          ip_hash?: string | null
          is_test?: boolean
          outcome?: string
          placement_id?: string
          reconcile_note?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          source?: string
          trust_level?: string
          ua_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_network_events_integration_key_id_fkey"
            columns: ["integration_key_id"]
            isOneToOne: false
            referencedRelation: "private_network_integration_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_events_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "private_network_placements"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_funding_settlements: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          id: string
          is_test: boolean
          kind: string
          recorded_by: string | null
          reference: string
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          id?: string
          is_test?: boolean
          kind: string
          recorded_by?: string | null
          reference: string
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          id?: string
          is_test?: boolean
          kind?: string
          recorded_by?: string | null
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_funding_settlements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "private_network_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_integration_keys: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string
          id: string
          is_test: boolean
          key_hash: string
          key_hint: string
          label: string
          revoked_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by: string
          id?: string
          is_test?: boolean
          key_hash: string
          key_hint: string
          label: string
          revoked_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_test?: boolean
          key_hash?: string
          key_hint?: string
          label?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_network_integration_keys_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_ledger: {
        Row: {
          amount: number
          bucket: string
          campaign_id: string | null
          created_at: string
          created_by: string | null
          entry_type: string
          event_id: string | null
          id: string
          idempotency_key: string
          is_test: boolean
          note: string | null
          payout_id: string | null
          placement_id: string | null
          publisher_id: string
        }
        Insert: {
          amount: number
          bucket: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_type: string
          event_id?: string | null
          id?: string
          idempotency_key: string
          is_test?: boolean
          note?: string | null
          payout_id?: string | null
          placement_id?: string | null
          publisher_id: string
        }
        Update: {
          amount?: number
          bucket?: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_type?: string
          event_id?: string | null
          id?: string
          idempotency_key?: string
          is_test?: boolean
          note?: string | null
          payout_id?: string | null
          placement_id?: string | null
          publisher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "private_network_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_ledger_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "private_network_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "private_network_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_ledger_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "private_network_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_ledger_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "private_network_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_likes: {
        Row: {
          created_at: string
          creative_id: string
          publisher_id: string
        }
        Insert: {
          created_at?: string
          creative_id: string
          publisher_id: string
        }
        Update: {
          created_at?: string
          creative_id?: string
          publisher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_likes_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "private_network_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_likes_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "private_network_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_members: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      private_network_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_test: boolean
          paid_at: string | null
          payout_details: Json
          publisher_id: string
          reason: string | null
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_test?: boolean
          paid_at?: string | null
          payout_details?: Json
          publisher_id: string
          reason?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_test?: boolean
          paid_at?: string | null
          payout_details?: Json
          publisher_id?: string
          reason?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_payouts_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "private_network_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_placements: {
        Row: {
          campaign_id: string
          cancelled_at: string | null
          clicks: number
          conversions: number
          created_at: string
          creative_id: string
          id: string
          idempotency_key: string | null
          is_test: boolean
          leads: number
          platform: Database["public"]["Enums"]["private_network_platform"]
          proof_note: string | null
          proof_path: string | null
          proof_submitted_at: string | null
          proof_url: string | null
          publisher_id: string
          reject_reason: string | null
          reserved_amount: number
          resubmission_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          share_initiated_at: string | null
          share_method: string | null
          snapshot_action_bonus: number
          snapshot_base_fee: number
          snapshot_commission_pct: number
          status: string
          token: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          campaign_id: string
          cancelled_at?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          creative_id: string
          id?: string
          idempotency_key?: string | null
          is_test?: boolean
          leads?: number
          platform: Database["public"]["Enums"]["private_network_platform"]
          proof_note?: string | null
          proof_path?: string | null
          proof_submitted_at?: string | null
          proof_url?: string | null
          publisher_id: string
          reject_reason?: string | null
          reserved_amount?: number
          resubmission_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_initiated_at?: string | null
          share_method?: string | null
          snapshot_action_bonus: number
          snapshot_base_fee: number
          snapshot_commission_pct: number
          status?: string
          token?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          campaign_id?: string
          cancelled_at?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          creative_id?: string
          id?: string
          idempotency_key?: string | null
          is_test?: boolean
          leads?: number
          platform?: Database["public"]["Enums"]["private_network_platform"]
          proof_note?: string | null
          proof_path?: string | null
          proof_submitted_at?: string | null
          proof_url?: string | null
          publisher_id?: string
          reject_reason?: string | null
          reserved_amount?: number
          resubmission_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          share_initiated_at?: string | null
          share_method?: string | null
          snapshot_action_bonus?: number
          snapshot_base_fee?: number
          snapshot_commission_pct?: number
          status?: string
          token?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_network_placements_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "private_network_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_placements_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "private_network_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_placements_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "private_network_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_publishers: {
        Row: {
          affiliations: string[]
          age_bracket: string | null
          audience_age_brackets: string[]
          audience_geographies: string[]
          audience_size_estimate: number | null
          audience_views_estimate: number | null
          communities: string[]
          created_at: string
          creator_id: string | null
          creator_link_code: string | null
          creator_link_status: string
          display_name: string | null
          estimates_are_self_reported: boolean
          id: string
          industries: string[]
          interests: string[]
          is_test: boolean
          languages: string[]
          location_city: string | null
          location_country: string | null
          location_state: string | null
          occupation: string | null
          payout_details: Json
          platforms: string[]
          record_source: string
          school: string | null
          status: string
          status_reason: string | null
          updated_at: string
          user_id: string
          workplace: string | null
        }
        Insert: {
          affiliations?: string[]
          age_bracket?: string | null
          audience_age_brackets?: string[]
          audience_geographies?: string[]
          audience_size_estimate?: number | null
          audience_views_estimate?: number | null
          communities?: string[]
          created_at?: string
          creator_id?: string | null
          creator_link_code?: string | null
          creator_link_status?: string
          display_name?: string | null
          estimates_are_self_reported?: boolean
          id?: string
          industries?: string[]
          interests?: string[]
          is_test?: boolean
          languages?: string[]
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          occupation?: string | null
          payout_details?: Json
          platforms?: string[]
          record_source?: string
          school?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          user_id: string
          workplace?: string | null
        }
        Update: {
          affiliations?: string[]
          age_bracket?: string | null
          audience_age_brackets?: string[]
          audience_geographies?: string[]
          audience_size_estimate?: number | null
          audience_views_estimate?: number | null
          communities?: string[]
          created_at?: string
          creator_id?: string | null
          creator_link_code?: string | null
          creator_link_status?: string
          display_name?: string | null
          estimates_are_self_reported?: boolean
          id?: string
          industries?: string[]
          interests?: string[]
          is_test?: boolean
          languages?: string[]
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          occupation?: string | null
          payout_details?: Json
          platforms?: string[]
          record_source?: string
          school?: string | null
          status?: string
          status_reason?: string | null
          updated_at?: string
          user_id?: string
          workplace?: string | null
        }
        Relationships: []
      }
      private_network_saves: {
        Row: {
          created_at: string
          creative_id: string
          publisher_id: string
        }
        Insert: {
          created_at?: string
          creative_id: string
          publisher_id: string
        }
        Update: {
          created_at?: string
          creative_id?: string
          publisher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_network_saves_creative_id_fkey"
            columns: ["creative_id"]
            isOneToOne: false
            referencedRelation: "private_network_creatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_network_saves_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "private_network_publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      private_network_settings: {
        Row: {
          enabled: boolean
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          credits_topped_up_at: string | null
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
          low_credits_notified_at: string | null
          monday_briefing_hour: number
          paid_credits: number
          posting_timezone: string
          priority_render_until: string | null
          referral_code: string | null
          referred_by: string | null
          structured_design_enabled: boolean
          subscription_tier: string
          theme_preference: string
          timezone: string | null
          trend_intel_gen_count: number
          trend_intel_gen_reset_at: string
          updated_at: string
          user_id: string
          v2_enabled: boolean
          whatsapp_delivery_enabled: boolean
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
          credits_topped_up_at?: string | null
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
          low_credits_notified_at?: string | null
          monday_briefing_hour?: number
          paid_credits?: number
          posting_timezone?: string
          priority_render_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          structured_design_enabled?: boolean
          subscription_tier?: string
          theme_preference?: string
          timezone?: string | null
          trend_intel_gen_count?: number
          trend_intel_gen_reset_at?: string
          updated_at?: string
          user_id: string
          v2_enabled?: boolean
          whatsapp_delivery_enabled?: boolean
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
          credits_topped_up_at?: string | null
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
          low_credits_notified_at?: string | null
          monday_briefing_hour?: number
          paid_credits?: number
          posting_timezone?: string
          priority_render_until?: string | null
          referral_code?: string | null
          referred_by?: string | null
          structured_design_enabled?: boolean
          subscription_tier?: string
          theme_preference?: string
          timezone?: string | null
          trend_intel_gen_count?: number
          trend_intel_gen_reset_at?: string
          updated_at?: string
          user_id?: string
          v2_enabled?: boolean
          whatsapp_delivery_enabled?: boolean
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
      whatsapp_deliveries: {
        Row: {
          created_at: string
          error_text: string | null
          id: string
          idea_id: string | null
          message_sid: string | null
          reason: string | null
          status: string
          to_number: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          id?: string
          idea_id?: string | null
          message_sid?: string | null
          reason?: string | null
          status?: string
          to_number: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_text?: string | null
          id?: string
          idea_id?: string | null
          message_sid?: string | null
          reason?: string | null
          status?: string
          to_number?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_campaign_page: {
        Args: { _campaign_id: string }
        Returns: undefined
      }
      creator_network_approve_outreach: {
        Args: { _sale_id: string }
        Returns: undefined
      }
      creator_network_can: { Args: { _role?: string }; Returns: boolean }
      creator_network_can_any: { Args: { _roles: string[] }; Returns: boolean }
      creator_network_enabled: { Args: never; Returns: boolean }
      creator_network_has_access: {
        Args: { _role?: string; _user_id: string }
        Returns: boolean
      }
      creator_network_has_commercial_licence: {
        Args: { _creator: string }
        Returns: boolean
      }
      creator_network_review_ai_run: {
        Args: { _decision: string; _run_id: string }
        Returns: undefined
      }
      creator_network_submit_interview: {
        Args: {
          _creator_updates: Json
          _interview_id: string
          _next_action: string
          _responses: Json
          _summary: string
        }
        Returns: undefined
      }
      creator_network_supersede_finding: {
        Args: {
          _classification: string
          _confidence: string
          _finding: string
          _notes: string
          _old_id: string
          _source_name: string
          _source_url: string
        }
        Returns: string
      }
      creator_network_transition_opportunity: {
        Args: { _opportunity_id: string; _reason?: string; _to: string }
        Returns: Json
      }
      expire_campaign_pages: { Args: never; Returns: number }
      finalize_stalled_design_jobs: { Args: never; Returns: number }
      get_active_campaign_page: {
        Args: never
        Returns: {
          ends_at: string
          id: string
          name: string
          offer_text: string
          partner_slug: string
          slug: string
        }[]
      }
      get_campaign_page: {
        Args: { _slug: string }
        Returns: {
          copy: Json
          ends_at: string
          goal: string
          id: string
          name: string
          offer_text: string
          sections: Json
          slug: string
          status: string
        }[]
      }
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
      is_marketing_partner: { Args: { _user_id: string }; Returns: boolean }
      is_user_dormant: {
        Args: { _days?: number; _user_id: string }
        Returns: boolean
      }
      lock_autopilot_idea: { Args: { p_idea_id: string }; Returns: string }
      partner_id_for_user: { Args: { _user_id: string }; Returns: string }
      pause_dormant_autopilot: {
        Args: { p_days?: number }
        Returns: {
          brand_id: string
          brand_name: string
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      private_network_add_cn_creative: {
        Args: {
          _campaign: string
          _caption: string
          _creator_approval?: boolean
          _job: string
          _licence: string
          _rights_expires: string
          _rights_platforms: string[]
        }
        Returns: string
      }
      private_network_allow_domain: {
        Args: { _allow?: boolean; _brand: string; _host: string }
        Returns: undefined
      }
      private_network_balance: { Args: { _publisher: string }; Returns: Json }
      private_network_campaign_transition: {
        Args: { _id: string; _note?: string; _to: string }
        Returns: Json
      }
      private_network_cancel_placement: {
        Args: { _placement: string }
        Returns: undefined
      }
      private_network_create_integration_key: {
        Args: { _brand: string; _label: string }
        Returns: Json
      }
      private_network_creative_eligibility: {
        Args: { _creative: string; _platform?: string }
        Returns: string[]
      }
      private_network_delete_profile: { Args: never; Returns: undefined }
      private_network_enabled: { Args: never; Returns: boolean }
      private_network_feed: {
        Args: { _limit?: number; _offset?: number; _saved_only?: boolean }
        Returns: {
          action_bonus_ngn: number
          base_fee_ngn: number
          brand_logo: string
          brand_name: string
          campaign_code: string
          campaign_id: string
          campaign_name: string
          caption: string
          commission_pct: number
          creative_id: string
          description: string
          ends_at: string
          liked: boolean
          media_source: string
          media_type: string
          my_placement_status: string
          platforms: string[]
          public_media_url: string
          reasons: string[]
          saved: boolean
          score: number
          score_version: string
        }[]
      }
      private_network_funding_ok: {
        Args: { _campaign: string }
        Returns: boolean
      }
      private_network_has_role: {
        Args: { _role?: string; _uid: string }
        Returns: boolean
      }
      private_network_ingest_event: {
        Args: {
          _actor: string
          _amount: number
          _caller: string
          _external_id: string
          _key_hash: string
          _token: string
          _type: string
        }
        Returns: Json
      }
      private_network_is_operator: { Args: never; Returns: boolean }
      private_network_licence_covers_platform: {
        Args: { _lic: string[]; _p: string }
        Returns: boolean
      }
      private_network_list_cn_masters: {
        Args: never
        Returns: {
          creator_id: string
          creator_name: string
          expires_at: string
          has_clean_master: boolean
          is_test: boolean
          job_code: string
          licence_id: string
          licence_scope: string
          licence_status: string
          organic: boolean
          platforms: string[]
          production_job_id: string
          qa_approved: boolean
          revoked: boolean
          territories: string[]
        }[]
      }
      private_network_log: {
        Args: {
          _action: string
          _details?: Json
          _entity: string
          _id: string
          _is_test?: boolean
        }
        Returns: undefined
      }
      private_network_lower: { Args: { _a: string[] }; Returns: string[] }
      private_network_mark_share: {
        Args: { _method: string; _placement: string }
        Returns: undefined
      }
      private_network_metrics: {
        Args: { _include_test?: boolean }
        Returns: Json
      }
      private_network_my_placements: {
        Args: never
        Returns: {
          action_bonus: number
          base_fee: number
          brand_name: string
          campaign_code: string
          campaign_name: string
          campaign_status: string
          caption: string
          clicks: number
          commission_pct: number
          conversions: number
          created_at: string
          creative_id: string
          earned: number
          id: string
          leads: number
          media_type: string
          platform: string
          proof_submitted_at: string
          proof_url: string
          reject_reason: string
          resubmission_count: number
          share_initiated_at: string
          share_method: string
          status: string
          token: string
          verified_at: string
        }[]
      }
      private_network_my_publisher_id: { Args: never; Returns: string }
      private_network_placement_live_reasons: {
        Args: { _placement: string; _states: string[] }
        Returns: string[]
      }
      private_network_platform_family: { Args: { _p: string }; Returns: string }
      private_network_publish: {
        Args: {
          _creative: string
          _idempotency_key?: string
          _platform: string
        }
        Returns: Json
      }
      private_network_publish_cohort_ok: {
        Args: { _creative: string; _publisher: string }
        Returns: boolean
      }
      private_network_reconcile_event: {
        Args: {
          _approve: boolean
          _event: string
          _note?: string
          _verified_amount?: number
        }
        Returns: Json
      }
      private_network_record_funding:
        | {
            Args: { _id: string; _reference: string; _status: string }
            Returns: undefined
          }
        | {
            Args: {
              _amount: number
              _id: string
              _reference: string
              _status: string
            }
            Returns: undefined
          }
      private_network_release_pending: {
        Args: { _publisher: string }
        Returns: number
      }
      private_network_release_reservation: {
        Args: { _amount: number; _campaign: string }
        Returns: undefined
      }
      private_network_request_payout: {
        Args: { _amount: number }
        Returns: string
      }
      private_network_require_enabled: { Args: never; Returns: undefined }
      private_network_resolve_redirect: {
        Args: { _ip_hash: string; _token: string; _ua_hash: string }
        Returns: Json
      }
      private_network_reverse_entry: {
        Args: { _entry: string; _reason: string }
        Returns: undefined
      }
      private_network_review_creative: {
        Args: {
          _confirm_private_rights?: boolean
          _decision: string
          _evidence?: string
          _id: string
          _reason?: string
        }
        Returns: Json
      }
      private_network_review_payout: {
        Args: {
          _decision: string
          _id: string
          _reason?: string
          _reference?: string
        }
        Returns: undefined
      }
      private_network_review_proof: {
        Args: { _decision: string; _placement: string; _reason?: string }
        Returns: Json
      }
      private_network_review_publisher: {
        Args: { _decision: string; _id: string; _reason?: string }
        Returns: undefined
      }
      private_network_review_reasons: {
        Args: { _creative: string }
        Returns: string[]
      }
      private_network_revoke_integration_key: {
        Args: { _id: string }
        Returns: undefined
      }
      private_network_save_profile: { Args: { _p: Json }; Returns: string }
      private_network_set_enabled: {
        Args: { _enabled: boolean }
        Returns: undefined
      }
      private_network_set_member: {
        Args: { _add: boolean; _email: string; _role: string }
        Returns: undefined
      }
      private_network_submit_creator_link: {
        Args: { _code: string }
        Returns: Json
      }
      private_network_submit_proof: {
        Args: { _note: string; _path: string; _placement: string; _url: string }
        Returns: undefined
      }
      private_network_top_up_budget: {
        Args: { _amount: number; _id: string; _reference: string }
        Returns: undefined
      }
      private_network_validate_platforms: {
        Args: { _a: string[] }
        Returns: undefined
      }
      process_referral: { Args: { p_user_id: string }; Returns: Json }
      record_preset_feedback: {
        Args: { p_design_id: string; p_vote: number }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      private_network_platform:
        | "whatsapp_status"
        | "whatsapp_chat"
        | "instagram"
        | "facebook"
        | "tiktok"
        | "x"
        | "other"
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
      app_role: ["admin", "moderator", "user"],
      private_network_platform: [
        "whatsapp_status",
        "whatsapp_chat",
        "instagram",
        "facebook",
        "tiktok",
        "x",
        "other",
      ],
    },
  },
} as const
