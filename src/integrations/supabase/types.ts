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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      booking_boxes: {
        Row: {
          booking_id: string
          box_index: number
          chargeable_weight_kg: number | null
          courier_rate: number | null
          created_at: string
          error_message: string | null
          height_cm: number | null
          id: string
          label_url: string | null
          length_cm: number | null
          partner_order_id: string | null
          price: number | null
          status: string
          tracking_id: string | null
          updated_at: string
          weight_kg: number
          width_cm: number | null
        }
        Insert: {
          booking_id: string
          box_index: number
          chargeable_weight_kg?: number | null
          courier_rate?: number | null
          created_at?: string
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_url?: string | null
          length_cm?: number | null
          partner_order_id?: string | null
          price?: number | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
          weight_kg: number
          width_cm?: number | null
        }
        Update: {
          booking_id?: string
          box_index?: number
          chargeable_weight_kg?: number | null
          courier_rate?: number | null
          created_at?: string
          error_message?: string | null
          height_cm?: number | null
          id?: string
          label_url?: string | null
          length_cm?: number | null
          partner_order_id?: string | null
          price?: number | null
          status?: string
          tracking_id?: string | null
          updated_at?: string
          weight_kg?: number
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_boxes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_progress: {
        Row: {
          booking_id: string | null
          completed: boolean
          id: string
          last_step: number
          last_step_name: string
          session_id: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          completed?: boolean
          id?: string
          last_step: number
          last_step_name: string
          session_id: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          completed?: boolean
          id?: string
          last_step?: number
          last_step_name?: string
          session_id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          account_type: string
          admin_email_sent_at: string | null
          base_fare: number | null
          booking_source: string | null
          box_count: number
          business_account_id: string | null
          chargeable_weight_g: number | null
          courier_name: string
          courier_price: number
          courier_rate: number | null
          created_at: string
          created_by_admin_email: string | null
          created_by_admin_id: string | null
          dead_weight_g: number | null
          delivery_time: string
          failure_reason: string | null
          failure_step: string | null
          goods_type: string
          gst: number | null
          height: string | null
          id: string
          insurance_amount: number | null
          insurance_required: boolean | null
          is_admin_assisted: boolean
          label_url: string | null
          length: string | null
          margin_amount: number | null
          package_weight: string
          packaging_amount: number | null
          packaging_required: boolean | null
          parcel_photos: Json
          parcel_photos_uploaded_at: string | null
          partner_error_raw: string | null
          partner_id: string | null
          payment_id: string | null
          payment_link_id: string | null
          payment_link_status: string | null
          payment_link_url: string | null
          payment_status: string | null
          platform_fee: number | null
          prayog_awb: string | null
          prayog_commission: number | null
          prayog_order_id: string | null
          receiver_address: string
          receiver_city: string
          receiver_name: string
          receiver_phone: string
          receiver_pincode: string
          receiver_state: string
          refund_id: string | null
          refund_reason: string | null
          retail_price: number | null
          sender_address: string
          sender_city: string
          sender_name: string
          sender_phone: string
          sender_pincode: string
          sender_state: string
          service_code: string | null
          shipment_value: number | null
          status: string | null
          tracking_id: string | null
          updated_at: string
          urgency: string
          user_id: string
          volumetric_weight_g: number | null
          width: string | null
        }
        Insert: {
          account_type?: string
          admin_email_sent_at?: string | null
          base_fare?: number | null
          booking_source?: string | null
          box_count?: number
          business_account_id?: string | null
          chargeable_weight_g?: number | null
          courier_name: string
          courier_price: number
          courier_rate?: number | null
          created_at?: string
          created_by_admin_email?: string | null
          created_by_admin_id?: string | null
          dead_weight_g?: number | null
          delivery_time: string
          failure_reason?: string | null
          failure_step?: string | null
          goods_type: string
          gst?: number | null
          height?: string | null
          id?: string
          insurance_amount?: number | null
          insurance_required?: boolean | null
          is_admin_assisted?: boolean
          label_url?: string | null
          length?: string | null
          margin_amount?: number | null
          package_weight: string
          packaging_amount?: number | null
          packaging_required?: boolean | null
          parcel_photos?: Json
          parcel_photos_uploaded_at?: string | null
          partner_error_raw?: string | null
          partner_id?: string | null
          payment_id?: string | null
          payment_link_id?: string | null
          payment_link_status?: string | null
          payment_link_url?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          prayog_awb?: string | null
          prayog_commission?: number | null
          prayog_order_id?: string | null
          receiver_address: string
          receiver_city: string
          receiver_name: string
          receiver_phone: string
          receiver_pincode: string
          receiver_state: string
          refund_id?: string | null
          refund_reason?: string | null
          retail_price?: number | null
          sender_address: string
          sender_city: string
          sender_name: string
          sender_phone: string
          sender_pincode: string
          sender_state: string
          service_code?: string | null
          shipment_value?: number | null
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
          urgency: string
          user_id: string
          volumetric_weight_g?: number | null
          width?: string | null
        }
        Update: {
          account_type?: string
          admin_email_sent_at?: string | null
          base_fare?: number | null
          booking_source?: string | null
          box_count?: number
          business_account_id?: string | null
          chargeable_weight_g?: number | null
          courier_name?: string
          courier_price?: number
          courier_rate?: number | null
          created_at?: string
          created_by_admin_email?: string | null
          created_by_admin_id?: string | null
          dead_weight_g?: number | null
          delivery_time?: string
          failure_reason?: string | null
          failure_step?: string | null
          goods_type?: string
          gst?: number | null
          height?: string | null
          id?: string
          insurance_amount?: number | null
          insurance_required?: boolean | null
          is_admin_assisted?: boolean
          label_url?: string | null
          length?: string | null
          margin_amount?: number | null
          package_weight?: string
          packaging_amount?: number | null
          packaging_required?: boolean | null
          parcel_photos?: Json
          parcel_photos_uploaded_at?: string | null
          partner_error_raw?: string | null
          partner_id?: string | null
          payment_id?: string | null
          payment_link_id?: string | null
          payment_link_status?: string | null
          payment_link_url?: string | null
          payment_status?: string | null
          platform_fee?: number | null
          prayog_awb?: string | null
          prayog_commission?: number | null
          prayog_order_id?: string | null
          receiver_address?: string
          receiver_city?: string
          receiver_name?: string
          receiver_phone?: string
          receiver_pincode?: string
          receiver_state?: string
          refund_id?: string | null
          refund_reason?: string | null
          retail_price?: number | null
          sender_address?: string
          sender_city?: string
          sender_name?: string
          sender_phone?: string
          sender_pincode?: string
          sender_state?: string
          service_code?: string | null
          shipment_value?: number | null
          status?: string | null
          tracking_id?: string | null
          updated_at?: string
          urgency?: string
          user_id?: string
          volumetric_weight_g?: number | null
          width?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_account_id_fkey"
            columns: ["business_account_id"]
            isOneToOne: false
            referencedRelation: "business_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_accounts: {
        Row: {
          address: string | null
          approved_at: string | null
          city: string | null
          company_name: string
          contact_person: string
          created_at: string
          created_by: string | null
          documents: Json
          email: string
          gst_number: string | null
          id: string
          is_active: boolean
          monthly_shipments: number
          notes: string | null
          pan_number: string | null
          phone: string
          pincode: string | null
          shop_act_number: string | null
          state: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          city?: string | null
          company_name: string
          contact_person: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          email: string
          gst_number?: string | null
          id?: string
          is_active?: boolean
          monthly_shipments?: number
          notes?: string | null
          pan_number?: string | null
          phone: string
          pincode?: string | null
          shop_act_number?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          documents?: Json
          email?: string
          gst_number?: string | null
          id?: string
          is_active?: boolean
          monthly_shipments?: number
          notes?: string | null
          pan_number?: string | null
          phone?: string
          pincode?: string | null
          shop_act_number?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cancellation_disputes: {
        Row: {
          admin_notes: Json
          assigned_admin: string | null
          booking_id: string
          created_at: string
          id: string
          partner_error: string | null
          partner_status_at_attempt: string | null
          previous_booking_status: string | null
          reason: string
          refund_id: string | null
          resolved_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: Json
          assigned_admin?: string | null
          booking_id: string
          created_at?: string
          id?: string
          partner_error?: string | null
          partner_status_at_attempt?: string | null
          previous_booking_status?: string | null
          reason: string
          refund_id?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: Json
          assigned_admin?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          partner_error?: string | null
          partner_status_at_attempt?: string | null
          previous_booking_status?: string | null
          reason?: string
          refund_id?: string | null
          resolved_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cms_authors: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          linked_admin_user_id: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          linked_admin_user_id?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          linked_admin_user_id?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cms_content: {
        Row: {
          author_id: string | null
          body_html: string | null
          canonical_url: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          faq_order: number | null
          featured_image_alt: string | null
          featured_image_url: string | null
          focus_keyphrase: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          partner_code: string | null
          published_at: string | null
          robots: string | null
          schema_json: Json | null
          schema_type: string | null
          seo_score: number | null
          slug: string
          status: Database["public"]["Enums"]["cms_content_status"]
          tags: string[] | null
          title: string
          type: Database["public"]["Enums"]["cms_content_type"]
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          body_html?: string | null
          canonical_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          faq_order?: number | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          focus_keyphrase?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          partner_code?: string | null
          published_at?: string | null
          robots?: string | null
          schema_json?: Json | null
          schema_type?: string | null
          seo_score?: number | null
          slug: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          tags?: string[] | null
          title: string
          type: Database["public"]["Enums"]["cms_content_type"]
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          body_html?: string | null
          canonical_url?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          faq_order?: number | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          focus_keyphrase?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          partner_code?: string | null
          published_at?: string | null
          robots?: string | null
          schema_json?: Json | null
          schema_type?: string | null
          seo_score?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["cms_content_status"]
          tags?: string[] | null
          title?: string
          type?: Database["public"]["Enums"]["cms_content_type"]
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_content_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "cms_authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_content_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cms_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_media: {
        Row: {
          alt_text: string | null
          created_at: string
          file_path: string
          id: string
          mime_type: string | null
          public_url: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_path: string
          id?: string
          mime_type?: string | null
          public_url: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          public_url?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      courier_scores: {
        Row: {
          avg_delay_days: number | null
          courier_id: string
          courier_name: string
          id: string
          reliability_score: number | null
          total_ratings: number | null
          updated_at: string | null
        }
        Insert: {
          avg_delay_days?: number | null
          courier_id: string
          courier_name: string
          id?: string
          reliability_score?: number | null
          total_ratings?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_delay_days?: number | null
          courier_id?: string
          courier_name?: string
          id?: string
          reliability_score?: number | null
          total_ratings?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          otp_hash: string
          phone: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          otp_hash: string
          phone: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      partner_ratings: {
        Row: {
          badges: string[] | null
          cons: string[] | null
          created_at: string | null
          id: string
          last_fetched_at: string | null
          partner_code: string
          partner_name: string
          pros: string[] | null
          rating: number | null
          rating_source: string | null
          review_count: number | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          badges?: string[] | null
          cons?: string[] | null
          created_at?: string | null
          id?: string
          last_fetched_at?: string | null
          partner_code: string
          partner_name: string
          pros?: string[] | null
          rating?: number | null
          rating_source?: string | null
          review_count?: number | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          badges?: string[] | null
          cons?: string[] | null
          created_at?: string | null
          id?: string
          last_fetched_at?: string | null
          partner_code?: string
          partner_name?: string
          pros?: string[] | null
          rating?: number | null
          rating_source?: string | null
          review_count?: number | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          doc_number: string | null
          doc_type: string | null
          email: string | null
          full_name: string | null
          id: string
          kyc_completed_at: string | null
          kyc_status: string | null
          phone: string | null
          preferred_language: string | null
          promo_notifications: boolean | null
          sms_notifications: boolean | null
          status: string | null
          survey_completed_at: string | null
          survey_courier_type: string | null
          survey_frequency: string | null
          survey_source: string | null
          theme_preference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          kyc_completed_at?: string | null
          kyc_status?: string | null
          phone?: string | null
          preferred_language?: string | null
          promo_notifications?: boolean | null
          sms_notifications?: boolean | null
          status?: string | null
          survey_completed_at?: string | null
          survey_courier_type?: string | null
          survey_frequency?: string | null
          survey_source?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          kyc_completed_at?: string | null
          kyc_status?: string | null
          phone?: string | null
          preferred_language?: string | null
          promo_notifications?: boolean | null
          sms_notifications?: boolean | null
          status?: string | null
          survey_completed_at?: string | null
          survey_courier_type?: string | null
          survey_frequency?: string | null
          survey_source?: string | null
          theme_preference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          address: string
          city: string
          created_at: string | null
          district: string | null
          flat_no: string | null
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          name: string
          phone: string
          pincode: string
          state: string
          updated_at: string | null
          use_count: number | null
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          district?: string | null
          flat_no?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          phone: string
          pincode: string
          state: string
          updated_at?: string | null
          use_count?: number | null
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          district?: string | null
          flat_no?: string | null
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string
          pincode?: string
          state?: string
          updated_at?: string | null
          use_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      shadowfax_pincodes: {
        Row: {
          city: string | null
          created_at: string | null
          hub: string | null
          id: string
          is_active: boolean | null
          pincode: string
          pod: string | null
          region: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          hub?: string | null
          id?: string
          is_active?: boolean | null
          pincode: string
          pod?: string | null
          region?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          hub?: string | null
          id?: string
          is_active?: boolean | null
          pincode?: string
          pod?: string | null
          region?: string | null
          state?: string | null
        }
        Relationships: []
      }
      shipment_history: {
        Row: {
          actual_days: number | null
          booking_date: string | null
          courier_id: string
          created_at: string | null
          delivered_date: string | null
          destination_pincode: string
          id: string
          origin_pincode: string
          predicted_confidence: number | null
          predicted_days: number | null
          price_paid: number | null
          user_id: string | null
          weight_kg: number | null
        }
        Insert: {
          actual_days?: number | null
          booking_date?: string | null
          courier_id: string
          created_at?: string | null
          delivered_date?: string | null
          destination_pincode: string
          id?: string
          origin_pincode: string
          predicted_confidence?: number | null
          predicted_days?: number | null
          price_paid?: number | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Update: {
          actual_days?: number | null
          booking_date?: string | null
          courier_id?: string
          created_at?: string | null
          delivered_date?: string | null
          destination_pincode?: string
          id?: string
          origin_pincode?: string
          predicted_confidence?: number | null
          predicted_days?: number | null
          price_paid?: number | null
          user_id?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          category: string
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender_id: string
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      xpressbees_pincodes: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_cod: boolean | null
          is_pickup: boolean | null
          is_prepaid: boolean | null
          pincode: string
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_cod?: boolean | null
          is_pickup?: boolean | null
          is_prepaid?: boolean | null
          pincode: string
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_cod?: boolean | null
          is_pickup?: boolean | null
          is_prepaid?: boolean | null
          pincode?: string
          state?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_safe: {
        Row: {
          created_at: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          full_name: string | null
          id: string | null
          kyc_completed_at: string | null
          kyc_status: string | null
          phone: string | null
          preferred_language: string | null
          promo_notifications: boolean | null
          sms_notifications: boolean | null
          status: string | null
          theme_preference: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          doc_number?: never
          doc_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          kyc_completed_at?: string | null
          kyc_status?: string | null
          phone?: string | null
          preferred_language?: string | null
          promo_notifications?: boolean | null
          sms_notifications?: boolean | null
          status?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          doc_number?: never
          doc_type?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          kyc_completed_at?: string | null
          kyc_status?: string | null
          phone?: string | null
          preferred_language?: string | null
          promo_notifications?: boolean | null
          sms_notifications?: boolean | null
          status?: string | null
          theme_preference?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_manage_cms: { Args: { _user_id: string }; Returns: boolean }
      generate_canonical_url: {
        Args: { content_slug: string; content_type: string }
        Returns: string
      }
      get_admin_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      get_business_account_id: { Args: { _user_id: string }; Returns: string }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_business_user: { Args: { _user_id: string }; Returns: boolean }
      is_operations: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mask_doc_number: { Args: { doc: string }; Returns: string }
    }
    Enums: {
      admin_role: "super_admin" | "support" | "cms_editor" | "operations"
      cms_content_status: "draft" | "published" | "scheduled"
      cms_content_type: "post" | "page" | "faq" | "partner"
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
      admin_role: ["super_admin", "support", "cms_editor", "operations"],
      cms_content_status: ["draft", "published", "scheduled"],
      cms_content_type: ["post", "page", "faq", "partner"],
    },
  },
} as const
