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
      activity_runs: {
        Row: {
          activity_id: string
          activity_name: string
          actor_ids: string[]
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number | null
          expedition_id: string
          finder_id: string | null
          group_number: number
          id: string
          outcome: string
          rolls: Json
          spent: number
          travel_group_id: string | null
          undone: boolean
          updated_at: string
          version: number
          yield_line_id: string | null
          yield_name: string | null
          yield_qty: number
        }
        Insert: {
          activity_id: string
          activity_name: string
          actor_ids?: string[]
          campaign_id: string
          created_at?: string
          created_by?: string | null
          day?: number | null
          expedition_id: string
          finder_id?: string | null
          group_number: number
          id?: string
          outcome: string
          rolls?: Json
          spent?: number
          travel_group_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
          yield_line_id?: string | null
          yield_name?: string | null
          yield_qty?: number
        }
        Update: {
          activity_id?: string
          activity_name?: string
          actor_ids?: string[]
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          day?: number | null
          expedition_id?: string
          finder_id?: string | null
          group_number?: number
          id?: string
          outcome?: string
          rolls?: Json
          spent?: number
          travel_group_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
          yield_line_id?: string | null
          yield_name?: string | null
          yield_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_runs_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
          {
            foreignKeyName: "activity_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_runs_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_runs_finder_id_fkey"
            columns: ["finder_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_runs_travel_group_id_fkey"
            columns: ["travel_group_id"]
            isOneToOne: false
            referencedRelation: "travel_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      actor_secrets: {
        Row: {
          actor_id: string
          created_at: string
          created_by: string | null
          gm_notes: string
          hp_current: number | null
          hp_max: number | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          created_by?: string | null
          gm_notes?: string
          hp_current?: number | null
          hp_max?: number | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          created_by?: string | null
          gm_notes?: string
          hp_current?: number | null
          hp_max?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actor_secrets_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actor_secrets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      actors: {
        Row: {
          approval: string
          backstory: string
          campaign_id: string
          carrying_treasure: boolean | null
          classes: Json
          company_id: string | null
          created_at: string
          created_by: string | null
          creation: Json
          edited_fields: string[]
          expertise: Json
          fields: Json
          hp_current: number | null
          hp_max: number | null
          id: string
          kind: string
          level: number
          name: string
          notes: string
          owner_type: string
          owner_user_id: string | null
          portrait_asset_id: string | null
          race_ref: string | null
          review_note: string
          review_sections: string[]
          spell_book: Json
          status: string
          updated_at: string
          weapon_skills: Json
        }
        Insert: {
          approval?: string
          backstory?: string
          campaign_id: string
          carrying_treasure?: boolean | null
          classes?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          creation?: Json
          edited_fields?: string[]
          expertise?: Json
          fields?: Json
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          kind: string
          level?: number
          name: string
          notes?: string
          owner_type: string
          owner_user_id?: string | null
          portrait_asset_id?: string | null
          race_ref?: string | null
          review_note?: string
          review_sections?: string[]
          spell_book?: Json
          status?: string
          updated_at?: string
          weapon_skills?: Json
        }
        Update: {
          approval?: string
          backstory?: string
          campaign_id?: string
          carrying_treasure?: boolean | null
          classes?: Json
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          creation?: Json
          edited_fields?: string[]
          expertise?: Json
          fields?: Json
          hp_current?: number | null
          hp_max?: number | null
          id?: string
          kind?: string
          level?: number
          name?: string
          notes?: string
          owner_type?: string
          owner_user_id?: string | null
          portrait_asset_id?: string | null
          race_ref?: string | null
          review_note?: string
          review_sections?: string[]
          spell_book?: Json
          status?: string
          updated_at?: string
          weapon_skills?: Json
        }
        Relationships: [
          {
            foreignKeyName: "actors_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actors_company_id_campaign_id_fkey"
            columns: ["company_id", "campaign_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "campaign_id"]
          },
          {
            foreignKeyName: "actors_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actors_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actors_portrait_asset_id_fkey"
            columns: ["portrait_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          revealed_at: string | null
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          visibility: string
          visible_to: string[]
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name?: string
          revealed_at?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
          visible_to?: string[]
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          revealed_at?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
          visible_to?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_entries: {
        Row: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          actor_id: string
          at?: number
          camp_id: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          detail?: Json
          food_kind?: string | null
          food_name?: string | null
          from_pot?: boolean
          group_number: number
          id?: string
          kind: string
          line_id?: string | null
          outcome?: string | null
          qty?: number
          seconds?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string
          at?: number
          camp_id?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          detail?: Json
          food_kind?: string | null
          food_name?: string | null
          from_pot?: boolean
          group_number?: number
          id?: string
          kind?: string
          line_id?: string | null
          outcome?: string | null
          qty?: number
          seconds?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "camp_entries_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_entries_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_clocks: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          seconds: number
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          seconds?: number
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          seconds?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_clocks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_pack_secrets: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          overrides: Json
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id: string
          overrides?: Json
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          overrides?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_pack_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pack_secrets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_pack_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "campaign_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_packs: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          option_choices: Json
          overrides: Json
          pack_id: string
          pack_name: string
          priority: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          option_choices?: Json
          overrides?: Json
          pack_id: string
          pack_name?: string
          priority?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          option_choices?: Json
          overrides?: Json
          pack_id?: string
          pack_name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_packs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_packs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_rules_revs: {
        Row: {
          campaign_id: string
          seen_rev: number
        }
        Insert: {
          campaign_id: string
          seen_rev?: number
        }
        Update: {
          campaign_id?: string
          seen_rev?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_rules_revs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active_night: boolean
          adventure_mode: string
          created_at: string
          created_by: string | null
          id: string
          mode: string
          name: string
          out_day: boolean
          retired_at: string | null
          season_not_now_at: string | null
          settings: Json
          sigil_asset_id: string | null
          updated_at: string
        }
        Insert: {
          active_night?: boolean
          adventure_mode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          name: string
          out_day?: boolean
          retired_at?: string | null
          season_not_now_at?: string | null
          settings?: Json
          sigil_asset_id?: string | null
          updated_at?: string
        }
        Update: {
          active_night?: boolean
          adventure_mode?: string
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          name?: string
          out_day?: boolean
          retired_at?: string | null
          season_not_now_at?: string | null
          settings?: Json
          sigil_asset_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_sigil_asset_id_fkey"
            columns: ["sigil_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          applied_at: number | null
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          fire_name: string | null
          fire_type_id: string | null
          fuel_item: string | null
          group_number: number
          id: string
          quick: boolean
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          applied_at?: number | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          day: number
          expedition_id: string
          fire_name?: string | null
          fire_type_id?: string | null
          fuel_item?: string | null
          group_number: number
          id?: string
          quick?: boolean
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          applied_at?: number | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          day?: number
          expedition_id?: string
          fire_name?: string | null
          fire_type_id?: string | null
          fuel_item?: string | null
          group_number?: number
          id?: string
          quick?: boolean
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "camps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camps_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
          {
            foreignKeyName: "camps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camps_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_loads: {
        Row: {
          actor_id: string
          campaign_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          tier: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_loads_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_loads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_alignments: {
        Row: {
          actor_id: string
          alignment: string
          campaign_id: string
          created_at: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          actor_id: string
          alignment: string
          campaign_id: string
          created_at?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          actor_id?: string
          alignment?: string
          campaign_id?: string
          created_at?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_alignments_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_alignments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_alignments_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      character_layouts: {
        Row: {
          actor_id: string
          campaign_id: string
          sections: Json
          updated_at: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_layouts_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_layouts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_lights: {
        Row: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        Insert: {
          actor_id: string
          burn_seconds?: number | null
          campaign_id: string
          consumed?: boolean
          created_at?: string
          fuel_item?: string | null
          full_seconds?: number | null
          id?: string
          keep_lit?: boolean
          left_seconds?: number | null
          line_id?: string | null
          lit_at?: number | null
          name?: string
          out_at?: number | null
          type_id?: string | null
          updated_at?: string
          version?: number
          warn_seconds?: number | null
        }
        Update: {
          actor_id?: string
          burn_seconds?: number | null
          campaign_id?: string
          consumed?: boolean
          created_at?: string
          fuel_item?: string | null
          full_seconds?: number | null
          id?: string
          keep_lit?: boolean
          left_seconds?: number | null
          line_id?: string | null
          lit_at?: number | null
          name?: string
          out_at?: number | null
          type_id?: string | null
          updated_at?: string
          version?: number
          warn_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_lights_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_lights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_play: {
        Row: {
          ac_override: number | null
          actor_id: string
          campaign_id: string
          chosen: Json | null
          form_id: string | null
          form_name: string | null
          pins: Json
          prepared: Json
          spells_cast: Json
          updated_at: string
          uses_spent: Json
        }
        Insert: {
          ac_override?: number | null
          actor_id: string
          campaign_id: string
          chosen?: Json | null
          form_id?: string | null
          form_name?: string | null
          pins?: Json
          prepared?: Json
          spells_cast?: Json
          updated_at?: string
          uses_spent?: Json
        }
        Update: {
          ac_override?: number | null
          actor_id?: string
          campaign_id?: string
          chosen?: Json | null
          form_id?: string | null
          form_name?: string | null
          pins?: Json
          prepared?: Json
          spells_cast?: Json
          updated_at?: string
          uses_spent?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_play_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_play_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_rests: {
        Row: {
          actor_id: string
          called_at: number | null
          called_by: string | null
          campaign_id: string
          chosen_at: number | null
          created_at: string
          id: string
          next_due: Json | null
          period_from: number | null
          pushed_on_at: number | null
          pushing_at: number | null
          rested_at: number | null
          updated_at: string
          version: number
        }
        Insert: {
          actor_id: string
          called_at?: number | null
          called_by?: string | null
          campaign_id: string
          chosen_at?: number | null
          created_at?: string
          id?: string
          next_due?: Json | null
          period_from?: number | null
          pushed_on_at?: number | null
          pushing_at?: number | null
          rested_at?: number | null
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string
          called_at?: number | null
          called_by?: string | null
          campaign_id?: string
          chosen_at?: number | null
          created_at?: string
          id?: string
          next_due?: Json | null
          period_from?: number | null
          pushed_on_at?: number | null
          pushing_at?: number | null
          rested_at?: number | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_rests_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_rests_called_by_fkey"
            columns: ["called_by"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_rests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_statuses: {
        Row: {
          actor_id: string
          campaign_id: string
          condition_id: string | null
          created_at: string
          end_reason: string | null
          ended_at: number | null
          ends_at: number | null
          icon: string | null
          id: string
          level: number | null
          levels: Json | null
          name: string
          note: string | null
          secret: boolean
          source: string
          stacking: boolean
          stacks: number
          started_at: number
          total_seconds: number | null
          undone: boolean
          unit: string | null
          until_rest: boolean
          updated_at: string
          version: number
        }
        Insert: {
          actor_id: string
          campaign_id: string
          condition_id?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: number | null
          ends_at?: number | null
          icon?: string | null
          id?: string
          level?: number | null
          levels?: Json | null
          name: string
          note?: string | null
          secret?: boolean
          source?: string
          stacking?: boolean
          stacks?: number
          started_at?: number
          total_seconds?: number | null
          undone?: boolean
          unit?: string | null
          until_rest?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          condition_id?: string | null
          created_at?: string
          end_reason?: string | null
          ended_at?: number | null
          ends_at?: number | null
          icon?: string | null
          id?: string
          level?: number | null
          levels?: Json | null
          name?: string
          note?: string | null
          secret?: boolean
          source?: string
          stacking?: boolean
          stacks?: number
          started_at?: number
          total_seconds?: number | null
          undone?: boolean
          unit?: string | null
          until_rest?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_statuses_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_statuses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      check_results: {
        Row: {
          at_seconds: number
          campaign_id: string
          check_key: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          modifiers: Json
          name: string
          note: string | null
          outcome: string
          revealed: boolean
          revealed_by_hand: boolean
          roll: string | null
          row_text: string | null
          secret: boolean
          source: string
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          at_seconds?: number
          campaign_id: string
          check_key: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string | null
          id?: string
          modifiers?: Json
          name: string
          note?: string | null
          outcome: string
          revealed?: boolean
          revealed_by_hand?: boolean
          roll?: string | null
          row_text?: string | null
          secret?: boolean
          source?: string
          table_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          at_seconds?: number
          campaign_id?: string
          check_key?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string | null
          id?: string
          modifiers?: Json
          name?: string
          note?: string | null
          outcome?: string
          revealed?: boolean
          revealed_by_hand?: boolean
          roll?: string | null
          row_text?: string | null
          secret?: boolean
          source?: string
          table_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "check_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_results_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_results_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          founder_ids: string[]
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          founder_ids?: string[]
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          founder_ids?: string[]
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invitations: {
        Row: {
          actor_id: string
          campaign_id: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          status: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          status?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_invitations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_user_id: string | null
          after: Json | null
          audience: string
          before: Json | null
          campaign_id: string
          created_at: string
          fiat: boolean
          group_number: number | null
          group_user_ids: string[] | null
          id: string
          level: string
          owner_user_id: string | null
          reason: string | null
          request_id: string | null
          request_part: number | null
          reveal_at: string
          reverts_event_id: string | null
          seq: number
          target_id: string | null
          target_table: string
          type: string
        }
        Insert: {
          actor_user_id?: string | null
          after?: Json | null
          audience: string
          before?: Json | null
          campaign_id: string
          created_at?: string
          fiat?: boolean
          group_number?: number | null
          group_user_ids?: string[] | null
          id?: string
          level?: string
          owner_user_id?: string | null
          reason?: string | null
          request_id?: string | null
          request_part?: number | null
          reveal_at?: string
          reverts_event_id?: string | null
          seq?: never
          target_id?: string | null
          target_table: string
          type: string
        }
        Update: {
          actor_user_id?: string | null
          after?: Json | null
          audience?: string
          before?: Json | null
          campaign_id?: string
          created_at?: string
          fiat?: boolean
          group_number?: number | null
          group_user_ids?: string[] | null
          id?: string
          level?: string
          owner_user_id?: string | null
          reason?: string | null
          request_id?: string | null
          request_part?: number | null
          reveal_at?: string
          reverts_event_id?: string | null
          seq?: never
          target_id?: string | null
          target_table?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reverts_event_id_fkey"
            columns: ["reverts_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      expedition_places: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          id: string
          mode: string
          name: string
          undone: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          expedition_id: string
          id?: string
          mode: string
          name: string
          undone?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string
          id?: string
          mode?: string
          name?: string
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expedition_places_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expedition_places_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: true
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      expeditions: {
        Row: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        Insert: {
          campaign_id: string
          created_at?: string
          ended_at?: number | null
          ended_safe?: boolean | null
          id?: string
          mode: string
          safe_paths?: boolean
          session_id?: string | null
          started_at?: number
          started_by?: string | null
          summary?: Json | null
          undone?: boolean
          updated_at?: string
          version?: number
          who_went?: string[]
        }
        Update: {
          campaign_id?: string
          created_at?: string
          ended_at?: number | null
          ended_safe?: boolean | null
          id?: string
          mode?: string
          safe_paths?: boolean
          session_id?: string | null
          started_at?: number
          started_by?: string | null
          summary?: Json | null
          undone?: boolean
          updated_at?: string
          version?: number
          who_went?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "expeditions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expeditions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expeditions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_definitions: {
        Row: {
          applies_to: string
          campaign_id: string
          choices: string[]
          created_at: string
          created_by: string | null
          field_group: string
          fill: string | null
          from_list: string | null
          hidden: boolean
          id: string
          key: string
          label: string
          required: boolean
          show_on_card: boolean
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          applies_to?: string
          campaign_id: string
          choices?: string[]
          created_at?: string
          created_by?: string | null
          field_group?: string
          fill?: string | null
          from_list?: string | null
          hidden?: boolean
          id?: string
          key: string
          label: string
          required?: boolean
          show_on_card?: boolean
          sort_order?: number
          type: string
          updated_at?: string
        }
        Update: {
          applies_to?: string
          campaign_id?: string
          choices?: string[]
          created_at?: string
          created_by?: string | null
          field_group?: string
          fill?: string | null
          from_list?: string | null
          hidden?: boolean
          id?: string
          key?: string
          label?: string
          required?: boolean
          show_on_card?: boolean
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "field_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gm_messages: {
        Row: {
          body: string
          burn: boolean
          campaign_id: string
          created_at: string
          created_by: string | null
          everyone: boolean
          id: string
          keep: boolean
          kind: string
          undone: boolean
          updated_at: string
        }
        Insert: {
          body: string
          burn?: boolean
          campaign_id: string
          created_at?: string
          created_by?: string | null
          everyone?: boolean
          id?: string
          keep?: boolean
          kind?: string
          undone?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          burn?: boolean
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          everyone?: boolean
          id?: string
          keep?: boolean
          kind?: string
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gm_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gm_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_lost: {
        Row: {
          attempts: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          found_day: number | null
          group_number: number
          id: string
          note: string
          roll: string | null
          roll_by: string | null
          since_day: number
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          attempts?: number
          campaign_id: string
          created_at?: string
          created_by?: string | null
          expedition_id: string
          found_day?: number | null
          group_number: number
          id?: string
          note?: string
          roll?: string | null
          roll_by?: string | null
          since_day?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          attempts?: number
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string
          found_day?: number | null
          group_number?: number
          id?: string
          note?: string
          roll?: string | null
          roll_by?: string | null
          since_day?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_lost_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_lost_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
          {
            foreignKeyName: "group_lost_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_lost_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_lost_roll_by_fkey"
            columns: ["roll_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_place_signals: {
        Row: {
          campaign_id: string
          group_number: number
          tick: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          group_number: number
          tick?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          group_number?: number
          tick?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_place_signals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_place_signals_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: true
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
        ]
      }
      group_places: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          group_number: number
          id: string
          moved_on: boolean
          place_id: string | null
          shown: boolean
          undone: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          expedition_id: string
          group_number: number
          id?: string
          moved_on?: boolean
          place_id?: string | null
          shown?: boolean
          undone?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string
          group_number?: number
          id?: string
          moved_on?: boolean
          place_id?: string | null
          shown?: boolean
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_places_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
          {
            foreignKeyName: "group_places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      finds_seen: {
        Row: {
          actor_id: string
          campaign_id: string
          created_at: string
          id: string
          seen_at: string
          updated_at: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          created_at?: string
          id?: string
          seen_at?: string
          updated_at?: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          created_at?: string
          id?: string
          seen_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finds_seen_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finds_seen_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      hook_sends: {
        Row: {
          actor_id: string | null
          body: string
          campaign_id: string
          clock_seconds: number
          created_at: string
          created_by: string | null
          hook_key: string
          id: string
          kind: string
          name: string
          pack_id: string
          pays: string
          player_user_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          body: string
          campaign_id: string
          clock_seconds?: number
          created_at?: string
          created_by?: string | null
          hook_key: string
          id?: string
          kind?: string
          name: string
          pack_id: string
          pays?: string
          player_user_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string | null
          body?: string
          campaign_id?: string
          clock_seconds?: number
          created_at?: string
          created_by?: string | null
          hook_key?: string
          id?: string
          kind?: string
          name?: string
          pack_id?: string
          pays?: string
          player_user_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hook_sends_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hook_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hook_sends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hook_sends_player_user_id_fkey"
            columns: ["player_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_line_secrets: {
        Row: {
          campaign_id: string
          charges_total: number | null
          id: string
          last_roll: string | null
          spent: boolean
        }
        Insert: {
          campaign_id: string
          charges_total?: number | null
          id: string
          last_roll?: string | null
          spent?: boolean
        }
        Update: {
          campaign_id?: string
          charges_total?: number | null
          id?: string
          last_roll?: string | null
          spent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inventory_line_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_line_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_lines: {
        Row: {
          actor_id: string | null
          approval: string
          at_hand_hidden: boolean
          base_armour_id: string | null
          campaign_id: string
          category: string
          charges_hidden: boolean
          charges_left: number | null
          charges_used: number
          container_line_id: string | null
          cost: string
          created_at: string
          created_by: string | null
          equipped: boolean
          fuel_left_seconds: number | null
          given_to: string | null
          how_got: string
          id: string
          item_data: Json
          last_roll: string | null
          library_entry_id: string | null
          location_id: string | null
          mode_id: string | null
          name: string
          needs_fuel: boolean
          notes: string
          per_units: number
          pinned: boolean
          qty: number
          slots: number | null
          source_entry_id: string | null
          source_pack_id: string | null
          spent_shown: boolean
          stack: number
          updated_at: string
          version: number
          weight_coin: number | null
        }
        Insert: {
          actor_id?: string | null
          approval?: string
          at_hand_hidden?: boolean
          base_armour_id?: string | null
          campaign_id: string
          category?: string
          charges_hidden?: boolean
          charges_left?: number | null
          charges_used?: number
          container_line_id?: string | null
          cost?: string
          created_at?: string
          created_by?: string | null
          equipped?: boolean
          fuel_left_seconds?: number | null
          given_to?: string | null
          how_got: string
          id?: string
          item_data?: Json
          last_roll?: string | null
          library_entry_id?: string | null
          location_id?: string | null
          mode_id?: string | null
          name: string
          needs_fuel?: boolean
          notes?: string
          per_units?: number
          pinned?: boolean
          qty?: number
          slots?: number | null
          source_entry_id?: string | null
          source_pack_id?: string | null
          spent_shown?: boolean
          stack?: number
          updated_at?: string
          version?: number
          weight_coin?: number | null
        }
        Update: {
          actor_id?: string | null
          approval?: string
          at_hand_hidden?: boolean
          base_armour_id?: string | null
          campaign_id?: string
          category?: string
          charges_hidden?: boolean
          charges_left?: number | null
          charges_used?: number
          container_line_id?: string | null
          cost?: string
          created_at?: string
          created_by?: string | null
          equipped?: boolean
          fuel_left_seconds?: number | null
          given_to?: string | null
          how_got?: string
          id?: string
          item_data?: Json
          last_roll?: string | null
          library_entry_id?: string | null
          location_id?: string | null
          mode_id?: string | null
          name?: string
          needs_fuel?: boolean
          notes?: string
          per_units?: number
          pinned?: boolean
          qty?: number
          slots?: number | null
          source_entry_id?: string | null
          source_pack_id?: string | null
          spent_shown?: boolean
          stack?: number
          updated_at?: string
          version?: number
          weight_coin?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_lines_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_container_line_id_fkey"
            columns: ["container_line_id"]
            isOneToOne: false
            referencedRelation: "inventory_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_lines_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          campaign_id: string
          code: string
          created_at: string
          created_by: string | null
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          campaign_id: string
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          campaign_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_shares: {
        Row: {
          body: Json | null
          campaign_id: string
          created_at: string
          created_by: string | null
          entry_id: string
          group_number: number
          heading: string
          id: string
          pack_id: string
          place_name: string
          section_at: number
          shared: boolean
          shared_clock: number
          undone: boolean
          updated_at: string
        }
        Insert: {
          body?: Json | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          entry_id: string
          group_number: number
          heading?: string
          id?: string
          pack_id: string
          place_name?: string
          section_at: number
          shared: boolean
          shared_clock?: number
          undone?: boolean
          updated_at?: string
        }
        Update: {
          body?: Json | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          entry_id?: string
          group_number?: number
          heading?: string
          id?: string
          pack_id?: string
          place_name?: string
          section_at?: number
          shared?: boolean
          shared_clock?: number
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_shares_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_shares_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      known_items: {
        Row: {
          campaign_id: string
          item_id: string
          known_since: string
          revealed_facts: Json
        }
        Insert: {
          campaign_id: string
          item_id: string
          known_since?: string
          revealed_facts?: Json
        }
        Update: {
          campaign_id?: string
          item_id?: string
          known_since?: string
          revealed_facts?: Json
        }
        Relationships: [
          {
            foreignKeyName: "known_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      library_entries: {
        Row: {
          data: Json
          id: string
          kind: string
          name: string
          pack_entry_id: string
          pack_id: string
        }
        Insert: {
          data?: Json
          id?: string
          kind: string
          name: string
          pack_entry_id: string
          pack_id: string
        }
        Update: {
          data?: Json
          id?: string
          kind?: string
          name?: string
          pack_entry_id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_entries_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_entry_secrets: {
        Row: {
          data: Json
          id: string
          pack_id: string
        }
        Insert: {
          data?: Json
          id: string
          pack_id: string
        }
        Update: {
          data?: Json
          id?: string
          pack_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_entry_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "library_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_entry_secrets_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          kind: string
          name: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      logged_commands: {
        Row: {
          gm_only: boolean
          level: string
          name: string
        }
        Insert: {
          gm_only?: boolean
          level?: string
          name: string
        }
        Update: {
          gm_only?: boolean
          level?: string
          name?: string
        }
        Relationships: []
      }
      marching_orders: {
        Row: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          group_number?: number
          id?: string
          last_preset?: string | null
          locked?: boolean
          presets?: Json
          rows?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          group_number?: number
          id?: string
          last_preset?: string | null
          locked?: boolean
          presets?: Json
          rows?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "marching_orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marching_orders_group"
            columns: ["campaign_id", "group_number"]
            isOneToOne: true
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
        ]
      }
      members: {
        Row: {
          active_actor_id: string | null
          base_role: string
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          joined_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_actor_id?: string | null
          base_role: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_actor_id?: string | null
          base_role?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          joined_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_active_actor_id_fkey"
            columns: ["active_actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_recipients: {
        Row: {
          actor_id: string
          campaign_id: string
          closed_at: string | null
          created_at: string
          id: string
          message_id: string
          undone: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          actor_id: string
          campaign_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          message_id: string
          undone?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          message_id?: string
          undone?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_recipients_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "gm_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_recipients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          actor_id: string
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          campaign_id: string
          created_at: string
          disappears: boolean
          from_gm: boolean
          id: string
          player_user_id: string
          read_at: string | null
          sender_user_id: string | null
          undone: boolean
          updated_at: string
        }
        Insert: {
          actor_id: string
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          campaign_id: string
          created_at?: string
          disappears?: boolean
          from_gm: boolean
          id?: string
          player_user_id: string
          read_at?: string | null
          sender_user_id?: string | null
          undone?: boolean
          updated_at?: string
        }
        Update: {
          actor_id?: string
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          body?: string
          campaign_id?: string
          created_at?: string
          disappears?: boolean
          from_gm?: boolean
          id?: string
          player_user_id?: string
          read_at?: string | null
          sender_user_id?: string | null
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_player_user_id_fkey"
            columns: ["player_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          about_actor_id: string | null
          annotates_event_id: string | null
          audience: string
          campaign_id: string
          created_at: string
          created_by: string | null
          group_user_ids: string[] | null
          id: string
          owner_user_id: string | null
          reveal_at: string
          text: string
          updated_at: string
        }
        Insert: {
          about_actor_id?: string | null
          annotates_event_id?: string | null
          audience?: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          group_user_ids?: string[] | null
          id?: string
          owner_user_id?: string | null
          reveal_at?: string
          text: string
          updated_at?: string
        }
        Update: {
          about_actor_id?: string | null
          annotates_event_id?: string | null
          audience?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          group_user_ids?: string[] | null
          id?: string
          owner_user_id?: string | null
          reveal_at?: string
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_about_actor_id_fkey"
            columns: ["about_actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_annotates_event_id_fkey"
            columns: ["annotates_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          campaign_id: string | null
          content_rev: number
          created_at: string
          created_by: string | null
          extra_meta: Json
          format_version: number
          id: string
          kind: string
          name: string
          notes: string
          owner_user_id: string
          source: string
          updated_at: string
          version: string
        }
        Insert: {
          campaign_id?: string | null
          content_rev?: number
          created_at?: string
          created_by?: string | null
          extra_meta?: Json
          format_version?: number
          id?: string
          kind?: string
          name: string
          notes?: string
          owner_user_id?: string
          source?: string
          updated_at?: string
          version?: string
        }
        Update: {
          campaign_id?: string | null
          content_rev?: number
          created_at?: string
          created_by?: string | null
          extra_meta?: Json
          format_version?: number
          id?: string
          kind?: string
          name?: string
          notes?: string
          owner_user_id?: string
          source?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      party_group_members: {
        Row: {
          actor_id: string
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          updated_at: string
          version: number
        }
        Insert: {
          actor_id: string
          campaign_id: string
          created_at?: string
          group_number?: number
          id: string
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string
          campaign_id?: string
          created_at?: string
          group_number?: number
          id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "party_group_members_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_group_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "party_group_members_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
        ]
      }
      party_groups: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          number: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          number: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          number?: number
        }
        Relationships: [
          {
            foreignKeyName: "party_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      piece_shows: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          group_number: number
          group_place_id: string
          id: string
          piece_id: string
          shown: boolean
          shown_at: string
          undone: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          group_number: number
          group_place_id: string
          id?: string
          piece_id: string
          shown?: boolean
          shown_at?: string
          undone?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          group_number?: number
          group_place_id?: string
          id?: string
          piece_id?: string
          shown?: boolean
          shown_at?: string
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piece_shows_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_shows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_shows_group_place_id_fkey"
            columns: ["group_place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piece_shows_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "place_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      place_moves: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          from_group_place_id: string | null
          group_number: number
          group_place_id: string
          id: string
          seconds: number
          turns: number
          undone: boolean
          updated_at: string
          way_by: string | null
          way_name: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          expedition_id: string
          from_group_place_id?: string | null
          group_number: number
          group_place_id: string
          id?: string
          seconds: number
          turns: number
          undone?: boolean
          updated_at?: string
          way_by?: string | null
          way_name?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string
          from_group_place_id?: string | null
          group_number?: number
          group_place_id?: string
          id?: string
          seconds?: number
          turns?: number
          undone?: boolean
          updated_at?: string
          way_by?: string | null
          way_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_moves_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moves_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moves_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moves_from_group_place_id_fkey"
            columns: ["from_group_place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_moves_group_place_id_fkey"
            columns: ["group_place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_notes: {
        Row: {
          campaign_id: string
          created_at: string
          doors: string
          encounters: string
          id: string
          puzzles: string
          traps: string
          treasure: string
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          doors?: string
          encounters?: string
          id: string
          puzzles?: string
          traps?: string
          treasure?: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          doors?: string
          encounters?: string
          id?: string
          puzzles?: string
          traps?: string
          treasure?: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_notes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_notes_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_pieces: {
        Row: {
          asset_id: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string | null
          gm_stat_line: string
          gm_trigger: string
          gm_value: string
          id: string
          kind: string
          lead: string | null
          place_id: string
          position: number
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          asset_id?: string | null
          body: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          gm_stat_line?: string
          gm_trigger?: string
          gm_value?: string
          id?: string
          kind: string
          lead?: string | null
          place_id: string
          position?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          asset_id?: string | null
          body?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          gm_stat_line?: string
          gm_trigger?: string
          gm_value?: string
          id?: string
          kind?: string
          lead?: string | null
          place_id?: string
          position?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "place_pieces_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_pieces_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_pieces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_pieces_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_rule_switches: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          pack_id: string
          place_name: string
          rule_id: string
          rule_name: string
          undone: boolean
          updated_at: string
          value: boolean
          which: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          pack_id: string
          place_name?: string
          rule_id: string
          rule_name?: string
          undone?: boolean
          updated_at?: string
          value: boolean
          which: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          pack_id?: string
          place_name?: string
          rule_id?: string
          rule_name?: string
          undone?: boolean
          updated_at?: string
          value?: boolean
          which?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_rule_switches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_rule_switches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_rule_switches_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_asset_id: string | null
          map_asset_id: string | null
          name: string
          pack_entry_id: string | null
          pack_id: string | null
          pack_key: string | null
          pack_parent_id: string | null
          pack_type: string | null
          players_name: string
          region_id: string | null
          safety: string | null
          settlement: Json | null
          terrain_id: string | null
          town: Json
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_asset_id?: string | null
          map_asset_id?: string | null
          name: string
          pack_entry_id?: string | null
          pack_id?: string | null
          pack_key?: string | null
          pack_parent_id?: string | null
          pack_type?: string | null
          players_name?: string
          region_id?: string | null
          safety?: string | null
          settlement?: Json | null
          terrain_id?: string | null
          town?: Json
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          image_asset_id?: string | null
          map_asset_id?: string | null
          name?: string
          pack_entry_id?: string | null
          pack_id?: string | null
          pack_key?: string | null
          pack_parent_id?: string | null
          pack_type?: string | null
          players_name?: string
          region_id?: string | null
          safety?: string | null
          settlement?: Json | null
          terrain_id?: string | null
          town?: Json
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "places_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_image_asset_id_fkey"
            columns: ["image_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_map_asset_id_fkey"
            columns: ["map_asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_asset_id: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          named_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id: string
          named_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_asset_id?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          named_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purses: {
        Row: {
          actor_id: string | null
          campaign_id: string
          coins: Json
          created_at: string
          id: string
          location_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          campaign_id: string
          coins?: Json
          created_at?: string
          id?: string
          location_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string | null
          campaign_id?: string
          coins?: Json
          created_at?: string
          id?: string
          location_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "purses_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purses_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          active: boolean
          anchor: number
          campaign_id: string
          chance: Json | null
          created_at: string
          created_by: string | null
          encounter_check: boolean
          every_unit: string
          every_value: number
          id: string
          is_public: boolean
          kind: string
          label: string
          note: string | null
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          anchor?: number
          campaign_id: string
          chance?: Json | null
          created_at?: string
          created_by?: string | null
          encounter_check?: boolean
          every_unit: string
          every_value: number
          id?: string
          is_public?: boolean
          kind?: string
          label: string
          note?: string | null
          table_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          anchor?: number
          campaign_id?: string
          chance?: Json | null
          created_at?: string
          created_by?: string | null
          encounter_check?: boolean
          every_unit?: string
          every_value?: number
          id?: string
          is_public?: boolean
          kind?: string
          label?: string
          note?: string | null
          table_id?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reminders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          answer?: Json | null
          answer_kind?: string
          answered_at?: string | null
          answered_by?: string | null
          campaign_id: string
          cost_text?: string
          created_at?: string
          created_by?: string | null
          direction: string
          entry?: Json | null
          expedition_id?: string | null
          group_number?: number | null
          id?: string
          kind: string
          prompt?: Json
          replied_at?: string | null
          reply?: string | null
          requester_id?: string | null
          status?: string
          text?: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string | null
          answer?: Json | null
          answer_kind?: string
          answered_at?: string | null
          answered_by?: string | null
          campaign_id?: string
          cost_text?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          entry?: Json | null
          expedition_id?: string | null
          group_number?: number | null
          id?: string
          kind?: string
          prompt?: Json
          replied_at?: string | null
          reply?: string | null
          requester_id?: string | null
          status?: string
          text?: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "requests_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rolls: {
        Row: {
          campaign_id: string
          created_at: string
          entered_by: string
          expression: string
          gm_only: boolean
          id: string
          label: string
          method: string
          purpose: string
          result: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          entered_by?: string
          expression: string
          gm_only?: boolean
          id?: string
          label?: string
          method?: string
          purpose: string
          result: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          entered_by?: string
          expression?: string
          gm_only?: boolean
          id?: string
          label?: string
          method?: string
          purpose?: string
          result?: number
        }
        Relationships: [
          {
            foreignKeyName: "rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          campaign_id: string
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          number: number
          started_at: string
          started_by: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          number: number
          started_at?: string
          started_by?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          number?: number
          started_at?: string
          started_by?: string | null
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_changes: {
        Row: {
          actor_id: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          field: string
          from_value: number | null
          id: string
          label: string
          reason: string
          requester_id: string | null
          status: string
          to_value: number
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          actor_id: string
          answered_at?: string | null
          answered_by?: string | null
          campaign_id: string
          created_at?: string
          created_by?: string | null
          field: string
          from_value?: number | null
          id?: string
          label: string
          reason?: string
          requester_id?: string | null
          status?: string
          to_value: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          actor_id?: string
          answered_at?: string | null
          answered_by?: string | null
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          field?: string
          from_value?: number | null
          id?: string
          label?: string
          reason?: string
          requester_id?: string | null
          status?: string
          to_value?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sheet_changes_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_changes_answered_by_fkey"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_changes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_changes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheet_changes_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_stock: {
        Row: {
          answer: string
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          id: string
          item_id: string
          service_id: string
          undone: boolean
          updated_at: string
        }
        Insert: {
          answer: string
          campaign_id: string
          created_at?: string
          created_by?: string | null
          day: number
          id?: string
          item_id: string
          service_id: string
          undone?: boolean
          updated_at?: string
        }
        Update: {
          answer?: string
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          day?: number
          id?: string
          item_id?: string
          service_id?: string
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_stock_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_stock_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_secrets: {
        Row: {
          campaign_id: string
          created_at: string
          ends_at: number
          id: string
          total_seconds: number
          unit: string | null
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          ends_at: number
          id: string
          total_seconds: number
          unit?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          ends_at?: number
          id?: string
          total_seconds?: number
          unit?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "status_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "character_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      table_pins: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          pinned_at: string
          table_id: string
          undone: boolean
          unpinned_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned_at?: string
          table_id: string
          undone?: boolean
          unpinned_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          pinned_at?: string
          table_id?: string
          undone?: boolean
          unpinned_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_pins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_pins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      table_reads: {
        Row: {
          at_seconds: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          roll: string
          row_text: string
          table_id: string
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          at_seconds?: number
          campaign_id: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string | null
          id?: string
          roll: string
          row_text: string
          table_id: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          at_seconds?: number
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          expedition_id?: string | null
          id?: string
          roll?: string
          row_text?: string
          table_id?: string
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_reads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_reads_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      town_piece_resets: {
        Row: {
          campaign_id: string
          group_place_id: string
          id: string
          reset_at: string
        }
        Insert: {
          campaign_id: string
          group_place_id: string
          id?: string
          reset_at?: string
        }
        Update: {
          campaign_id?: string
          group_place_id?: string
          id?: string
          reset_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "town_piece_resets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "town_piece_resets_group_place_id_fkey"
            columns: ["group_place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["id"]
          },
        ]
      }
      town_piece_shows: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          group_number: number
          group_place_id: string
          id: string
          piece_id: string
          shown: boolean
          shown_at: string
          undone: boolean
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          group_number: number
          group_place_id: string
          id?: string
          piece_id: string
          shown?: boolean
          shown_at?: string
          undone?: boolean
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          group_number?: number
          group_place_id?: string
          id?: string
          piece_id?: string
          shown?: boolean
          shown_at?: string
          undone?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "town_piece_shows_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "town_piece_shows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "town_piece_shows_group_place_id_fkey"
            columns: ["group_place_id"]
            isOneToOne: false
            referencedRelation: "group_places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "town_piece_shows_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "place_pieces"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_group_secrets: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          pending_place_id: string | null
          pending_place_name: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id: string
          pending_place_id?: string | null
          pending_place_name?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          pending_place_id?: string | null
          pending_place_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_group_secrets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_group_secrets_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "travel_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_group_secrets_pending_place_id_fkey"
            columns: ["pending_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_groups: {
        Row: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          created_by?: string | null
          day?: number
          expedition_id: string
          forced?: number
          gm_per_day?: number | null
          group_number: number
          id?: string
          pace?: string
          pending_owed?: number | null
          pending_place_id?: string | null
          pending_place_name?: string | null
          pending_route_id?: string | null
          pending_terrain_id?: string | null
          route_id?: string | null
          spent?: number
          terrain_id?: string | null
          total?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          created_by?: string | null
          day?: number
          expedition_id?: string
          forced?: number
          gm_per_day?: number | null
          group_number?: number
          id?: string
          pace?: string
          pending_owed?: number | null
          pending_place_id?: string | null
          pending_place_name?: string | null
          pending_route_id?: string | null
          pending_terrain_id?: string | null
          route_id?: string | null
          spent?: number
          terrain_id?: string | null
          total?: number
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "travel_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_groups_campaign_id_group_number_fkey"
            columns: ["campaign_id", "group_number"]
            isOneToOne: false
            referencedRelation: "party_groups"
            referencedColumns: ["campaign_id", "number"]
          },
          {
            foreignKeyName: "travel_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_groups_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_groups_pending_place_id_fkey"
            columns: ["pending_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      undoable_deletions: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      undoable_makings: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      undoable_tables: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      waiting_encounters: {
        Row: {
          campaign_id: string
          check_result_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          expedition_id: string | null
          id: string
          started_at: string | null
          state: string
          undone: boolean
          updated_at: string
          version: number
          watch: string | null
        }
        Insert: {
          campaign_id: string
          check_result_id: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          expedition_id?: string | null
          id?: string
          started_at?: string | null
          state?: string
          undone?: boolean
          updated_at?: string
          version?: number
          watch?: string | null
        }
        Update: {
          campaign_id?: string
          check_result_id?: string
          created_at?: string
          created_by?: string | null
          dismissed_at?: string | null
          expedition_id?: string | null
          id?: string
          started_at?: string | null
          state?: string
          undone?: boolean
          updated_at?: string
          version?: number
          watch?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waiting_encounters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_encounters_check_result_id_fkey"
            columns: ["check_result_id"]
            isOneToOne: false
            referencedRelation: "check_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_encounters_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiting_encounters_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_rolls: {
        Row: {
          campaign_id: string
          corrected_by: string | null
          created_at: string
          entered_at: string
          entered_by: string | null
          expedition_id: string
          id: string
          period: number
          result: string
          roll: string
          starts_at: number
          table_id: string
          tags: Json
          undone: boolean
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id: string
          corrected_by?: string | null
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          expedition_id: string
          id?: string
          period: number
          result: string
          roll: string
          starts_at?: number
          table_id: string
          tags?: Json
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string
          corrected_by?: string | null
          created_at?: string
          entered_at?: string
          entered_by?: string | null
          expedition_id?: string
          id?: string
          period?: number
          result?: string
          roll?: string
          starts_at?: number
          table_id?: string
          tags?: Json
          undone?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "weather_rolls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_rolls_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_rolls_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_rolls_expedition_id_fkey"
            columns: ["expedition_id"]
            isOneToOne: false
            referencedRelation: "expeditions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_camp_fuel: {
        Args: {
          actor: string
          camp: string
          line: string
          qty: number
          seconds_each: number
        }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_place_piece: {
        Args: { body: string; kind: string; place: string }
        Returns: {
          asset_id: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string | null
          gm_stat_line: string
          gm_trigger: string
          gm_value: string
          id: string
          kind: string
          lead: string | null
          place_id: string
          position: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "place_pieces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_reminder: {
        Args: {
          campaign: string
          chance?: Json
          encounter_check: boolean
          every_unit: string
          every_value: number
          is_public: boolean
          kind: string
          label: string
          note?: string
          table_id?: string
        }
        Returns: {
          active: boolean
          anchor: number
          campaign_id: string
          chance: Json | null
          created_at: string
          created_by: string | null
          encounter_check: boolean
          every_unit: string
          every_value: number
          id: string
          is_public: boolean
          kind: string
          label: string
          note: string | null
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_status: {
        Args: {
          actors: string[]
          campaign: string
          condition_id?: string
          icon?: string
          levels?: Json
          note?: string
          secret?: boolean
          source?: string
          stacking?: boolean
          status_name: string
          timer_seconds?: number
          timer_unit?: string
          until_rest?: boolean
        }
        Returns: {
          actor_id: string
          campaign_id: string
          condition_id: string | null
          created_at: string
          end_reason: string | null
          ended_at: number | null
          ends_at: number | null
          icon: string | null
          id: string
          level: number | null
          levels: Json | null
          name: string
          note: string | null
          secret: boolean
          source: string
          stacking: boolean
          stacks: number
          started_at: number
          total_seconds: number | null
          undone: boolean
          unit: string | null
          until_rest: boolean
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "character_statuses"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      advance_clock: {
        Args: {
          by_seconds: number
          campaign: string
          days?: Json
          rest?: Json
          seen_version?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          seconds: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "campaign_clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_invitation: {
        Args: { accept: boolean; invitation: string }
        Returns: undefined
      }
      answer_request: {
        Args: {
          answer: Json
          cost_seconds?: number
          cost_text?: string
          request: string
          seen_version?: number
        }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_rest: {
        Args: { actors: string[]; answer: string }
        Returns: {
          actor_id: string
          called_at: number | null
          called_by: string | null
          campaign_id: string
          chosen_at: number | null
          created_at: string
          id: string
          next_due: Json | null
          period_from: number | null
          pushed_on_at: number | null
          pushing_at: number | null
          rested_at: number | null
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "character_rests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      answer_safe_place: {
        Args: { expedition: string; safe: boolean }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_secret_activity: {
        Args: {
          all_left?: boolean
          answer: Json
          request: string
          seen_version?: number
          spend?: number
        }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      answer_sheet_change: {
        Args: {
          approve: boolean
          change: string
          reason?: string
          seen_version?: number
        }
        Returns: {
          actor_id: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          field: string
          from_value: number | null
          id: string
          label: string
          reason: string
          requester_id: string | null
          status: string
          to_value: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "sheet_changes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_activity: {
        Args: {
          activity_id: string
          activity_name: string
          actors: string[]
          campaign: string
          finder: string
          group_no: number
          outcome: string
          rolls: Json
          spend: number
          yield_category?: string
          yield_entry?: string
          yield_name?: string
          yield_qty?: number
          yield_slots?: number
          yield_stack?: number
          yield_weight?: number
        }
        Returns: {
          activity_id: string
          activity_name: string
          actor_ids: string[]
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number | null
          expedition_id: string
          finder_id: string | null
          group_number: number
          id: string
          outcome: string
          rolls: Json
          spent: number
          travel_group_id: string | null
          undone: boolean
          updated_at: string
          version: number
          yield_line_id: string | null
          yield_name: string | null
          yield_qty: number
        }
        SetofOptions: {
          from: "*"
          to: "activity_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_camps: {
        Args: { campaign: string; camps: string[] }
        Returns: {
          applied_at: number | null
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          fire_name: string | null
          fire_type_id: string | null
          fuel_item: string | null
          group_number: number
          id: string
          quick: boolean
          undone: boolean
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "camps"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ask_or_invite: {
        Args: { actor: string; ask: boolean; company: string }
        Returns: string
      }
      ask_requests: {
        Args: {
          body?: string
          campaign: string
          kind: string
          prompt?: Json
          who: string
        }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      back_at_place: { Args: { visit: string }; Returns: number }
      call_rest: {
        Args: { actor: string }
        Returns: {
          actor_id: string
          called_at: number | null
          called_by: string | null
          campaign_id: string
          chosen_at: number | null
          created_at: string
          id: string
          next_due: Json | null
          period_from: number | null
          pushed_on_at: number | null
          pushing_at: number | null
          rested_at: number | null
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "character_rests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      camp_sleep: {
        Args: {
          actor: string
          camp: string
          difficulty?: string
          outcome?: string
          roll?: string
        }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      camp_talk: {
        Args: { actor: string; camp: string; outcome: string }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      campaign_calendars: {
        Args: { campaign: string }
        Returns: {
          data: Json
          id: string
          name: string
          pack_entry_id: string
          pack_id: string
          preferred: boolean
        }[]
      }
      campaign_exceptions: {
        Args: { campaign: string }
        Returns: {
          id: string
          overrides: Json
        }[]
      }
      campaign_library: {
        Args: {
          after_id?: string
          campaign: string
          packs?: string[]
          page_size?: number
        }
        Returns: {
          data: Json
          id: string
          kind: string
          name: string
          pack_entry_id: string
          pack_id: string
        }[]
      }
      campaign_ways_on: {
        Args: { campaign: string }
        Returns: {
          group_number: number
          route_id: string
          to_name: string
          to_place_id: string
          ways: Json
        }[]
      }
      cancel_invitation: { Args: { invitation: string }; Returns: undefined }
      cast_spell: {
        Args: {
          actor: string
          change: number
          spell: string
          spell_level: number
        }
        Returns: Json
      }
      choose_party_group: {
        Args: { actor: string; to_group?: number }
        Returns: {
          actor_id: string
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "party_group_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      choose_rest: {
        Args: { actors: string[]; resting: boolean }
        Returns: {
          actor_id: string
          called_at: number | null
          called_by: string | null
          campaign_id: string
          chosen_at: number | null
          created_at: string
          id: string
          next_due: Json | null
          period_from: number | null
          pushed_on_at: number | null
          pushing_at: number | null
          rested_at: number | null
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "character_rests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      close_message: { Args: { message: string }; Returns: number }
      cook_at_camp: {
        Args: {
          camp: string
          cook: string
          ingredients: Json
          portions: number
        }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      correct_weather: {
        Args: {
          roll: string
          seen_version?: number
          table_id: string
          weather: string
        }
        Returns: {
          campaign_id: string
          corrected_by: string | null
          created_at: string
          entered_at: string
          entered_by: string | null
          expedition_id: string
          id: string
          period: number
          result: string
          roll: string
          starts_at: number
          table_id: string
          tags: Json
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "weather_rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_campaign: { Args: { campaign_name: string }; Returns: string }
      delete_marching_preset: {
        Args: { campaign: string; preset_name: string; seen_version?: number }
        Returns: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marching_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dismiss_encounter: {
        Args: { encounter: string; seen_version?: number }
        Returns: {
          campaign_id: string
          check_result_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          expedition_id: string | null
          id: string
          started_at: string | null
          state: string
          undone: boolean
          updated_at: string
          version: number
          watch: string | null
        }
        SetofOptions: {
          from: "*"
          to: "waiting_encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      douse_light: {
        Args: { actor: string; seen_version?: number }
        Returns: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        SetofOptions: {
          from: "*"
          to: "character_lights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      eat_at_camp: {
        Args: { actor: string; camp: string; from_pot: boolean; line?: string }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      edit_place_piece: {
        Args: { body: string; kind: string; piece: string; seen?: number }
        Returns: {
          asset_id: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string | null
          gm_stat_line: string
          gm_trigger: string
          gm_value: string
          id: string
          kind: string
          lead: string | null
          place_id: string
          position: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "place_pieces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      edit_reminder: {
        Args: { changes: Json; reminder: string; seen_version?: number }
        Returns: {
          active: boolean
          anchor: number
          campaign_id: string
          chance: Json | null
          created_at: string
          created_by: string | null
          encounter_check: boolean
          every_unit: string
          every_value: number
          id: string
          is_public: boolean
          kind: string
          label: string
          note: string | null
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "reminders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      encounter_check_for_players:
        | {
            Args: { campaign: string }
            Returns: {
              checked: Json
              group_number: number
              place_name: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              checked: Json
              group_number: number
              place_name: string
            }[]
          }
      end_downtime: { Args: { campaign: string }; Returns: string }
      end_expedition: {
        Args: { expedition: string; seen_version?: number }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_session: {
        Args: { seen_version?: number; session: string }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          number: number
          started_at: string
          started_by: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enter_lost_roll: {
        Args: { lost: string; roll: string; seen_version?: number }
        Returns: {
          attempts: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          found_day: number | null
          group_number: number
          id: string
          note: string
          roll: string | null
          roll_by: string | null
          since_day: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "group_lost"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enter_request: {
        Args: { entry: Json; request: string; seen_version?: number }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      enter_weather: {
        Args: {
          campaign: string
          expedition: string
          period: number
          roll: string
          starts_at: number
          table_id: string
        }
        Returns: {
          campaign_id: string
          corrected_by: string | null
          created_at: string
          entered_at: string
          entered_by: string | null
          expedition_id: string
          id: string
          period: number
          result: string
          roll: string
          starts_at: number
          table_id: string
          tags: Json
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "weather_rolls"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      force_march: {
        Args: {
          added: number
          campaign: string
          group_no: number
          seen_version?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "travel_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      found_company: {
        Args: { actor: string; cofounders?: string[]; company_name: string }
        Returns: string
      }
      full_rest: {
        Args: { expedition: string; refills: Json }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      give_find: {
        Args: {
          campaign: string
          coins: Json
          place: string
          rows?: Json
          things: Json
          to_actor: string
        }
        Returns: string
      }
      give_rumour: {
        Args: {
          campaign: string
          pack: string
          row_max: number
          row_min: number
          table_key: string
          to_actor?: string
        }
        Returns: {
            actor_id: string | null
            body: string
            campaign_id: string
            clock_seconds: number
            created_at: string
            created_by: string | null
            hook_key: string
            id: string
            kind: string
            name: string
            pack_id: string
            pays: string
            player_user_id: string | null
            undone: boolean
            updated_at: string
            version: number
        }
        SetofOptions: {
          from: "*"
          to: "hook_sends"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      groups_meeting: {
        Args: { campaign: string }
        Returns: {
          group_number: number
          meets: number
        }[]
      }
      hide_all_pieces: { Args: { visit: string }; Returns: number }
      import_pack: {
        Args: { entries: Json; meta: Json; replace_pack_id?: string }
        Returns: string
      }
      inventory_line_triggers: {
        Args: never
        Returns: {
          name: string
          timing: string
        }[]
      }
      join_added_line: {
        Args: {
          actor: string
          campaign: string
          container: string
          cost?: string
          entry: string
          how_got?: string
          how_many: number
          location: string
          made_id: string
          note?: string
        }
        Returns: string
      }
      join_party_groups: {
        Args: { campaign: string; from_group: number; into_group: number }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          number: number
        }
        SetofOptions: {
          from: "*"
          to: "party_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      keep_light_lit: {
        Args: { actor: string; keep: boolean; seen_version?: number }
        Returns: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        SetofOptions: {
          from: "*"
          to: "character_lights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      knowledge_for_players:
        | {
            Args: { campaign: string }
            Returns: {
              body: Json
              group_number: number
              heading: string
              place_name: string
              share_id: string
              shared_clock: number
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              body: Json
              group_number: number
              heading: string
              place_name: string
              share_id: string
              shared_clock: number
            }[]
          }
      known_places: {
        Args: { campaign: string }
        Returns: {
          body: string
          group_number: number
          kind: string
          piece_id: string
          place_id: string
          place_name: string
          visit_id: string
          visited_at: string
        }[]
      }
      known_places_campaign:
        | {
            Args: { campaign: string }
            Returns: {
              body: string
              current: boolean
              expedition_id: string
              expedition_started: number
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_id: string
              place_name: string
              visit_id: string
              visited_at: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              body: string
              current: boolean
              expedition_id: string
              expedition_started: number
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_id: string
              place_name: string
              visit_id: string
              visited_at: string
            }[]
          }
      light_light: {
        Args: {
          actor: string
          burn_seconds: number
          consumed: boolean
          fuel_item: string
          light_name: string
          light_type: string
          line: string
          seen_version?: number
          warn_seconds: number
        }
        Returns: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        SetofOptions: {
          from: "*"
          to: "character_lights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lock_marching_order: {
        Args: { campaign: string; lock_it: boolean; seen_version?: number }
        Returns: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marching_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      make_place_from_pack: {
        Args: {
          campaign: string
          details?: Json
          entry_id: string
          notes?: Json
          pack: string
          pieces?: Json
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          image_asset_id: string | null
          map_asset_id: string | null
          name: string
          pack_entry_id: string | null
          pack_id: string | null
          pack_key: string | null
          pack_parent_id: string | null
          pack_type: string | null
          players_name: string
          region_id: string | null
          safety: string | null
          settlement: Json | null
          terrain_id: string | null
          town: Json
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "places"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_between_places: {
        Args: {
          by_seconds: number
          campaign: string
          place: string
          rest?: Json
          seen_version?: number
          turns: number
          way_by?: string
          way_name?: string
        }
        Returns: Json
      }
      move_into_stack: {
        Args: {
          how_many: number
          line: string
          seen_version?: number
          to_actor: string
          to_container: string
          to_location: string
        }
        Returns: string
      }
      note_rule_skipped: {
        Args: { campaign: string; hook: string }
        Returns: undefined
      }
      open_camp: {
        Args: {
          campaign: string
          day: number
          fire_name?: string
          fire_type_id?: string
          fuel_item?: string
          group_no: number
          quick?: boolean
        }
        Returns: {
          applied_at: number | null
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          fire_name: string | null
          fire_type_id: string | null
          fuel_item: string | null
          group_number: number
          id: string
          quick: boolean
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      party_moves: {
        Args: { campaign: string }
        Returns: {
          clock_event_id: string
          from_name: string
          to_name: string
          turns: number
        }[]
      }
      peek_invite: {
        Args: { invite_code: string }
        Returns: {
          already_member: boolean
          campaign_id: string
          campaign_name: string
          gm_name: string
        }[]
      }
      pin_table: {
        Args: { campaign: string; table_id: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          pinned_at: string
          table_id: string
          undone: boolean
          unpinned_at: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "table_pins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      place_card_for_players:
        | {
            Args: { campaign: string }
            Returns: {
              at: number
              group_number: number
              key: string
              kind: string
              line: string
              name: string
              place_id: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              at: number
              group_number: number
              key: string
              kind: string
              line: string
              name: string
              place_id: string
            }[]
          }
      place_rules_for_players:
        | {
            Args: { campaign: string }
            Returns: {
              body: Json
              button: string
              group_number: number
              name: string
              place_name: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              body: Json
              button: string
              group_number: number
              name: string
              place_name: string
            }[]
          }
      purse_add: {
        Args: { actor: string; campaign: string; coins: Json; location: string }
        Returns: undefined
      }
      purse_give: {
        Args: {
          campaign: string
          coins: Json
          from_actor: string
          to_actor: string
          to_location: string
        }
        Returns: undefined
      }
      purse_remove: {
        Args: { actor: string; campaign: string; coins: Json; location: string }
        Returns: undefined
      }
      purse_spend: {
        Args: {
          actor: string
          campaign: string
          coins: Json
          what_for?: string
        }
        Returns: undefined
      }
      purse_take: {
        Args: {
          campaign: string
          coins: Json
          from_actor: string
          from_location: string
          to_actor: string
        }
        Returns: undefined
      }
      queue_encounter: {
        Args: { result: string }
        Returns: {
          campaign_id: string
          check_result_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          expedition_id: string | null
          id: string
          started_at: string | null
          state: string
          undone: boolean
          updated_at: string
          version: number
          watch: string | null
        }
        SetofOptions: {
          from: "*"
          to: "waiting_encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_finds_seen: { Args: { character: string }; Returns: string }
      read_messages: { Args: { message_ids: string[] }; Returns: number }
      read_table_by_hand: {
        Args: {
          campaign: string
          roll: string
          row_text: string
          table_id: string
        }
        Returns: {
          at_seconds: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          roll: string
          row_text: string
          table_id: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "table_reads"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_check: {
        Args: {
          campaign: string
          check_key: string
          modifiers?: Json
          name: string
          note?: string
          outcome: string
          secret?: boolean
          source: string
        }
        Returns: {
          at_seconds: number
          campaign_id: string
          check_key: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          modifiers: Json
          name: string
          note: string | null
          outcome: string
          revealed: boolean
          revealed_by_hand: boolean
          roll: string | null
          row_text: string | null
          secret: boolean
          source: string
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "check_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_invite: { Args: { invite_code: string }; Returns: string }
      refill_and_light: {
        Args: {
          actor: string
          burn_seconds: number
          fuel_item: string
          light_name: string
          light_type: string
          line: string
          seen_version?: number
          warn_seconds: number
        }
        Returns: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        SetofOptions: {
          from: "*"
          to: "character_lights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      refill_light: {
        Args: { actor: string; seen_version?: number }
        Returns: {
          actor_id: string
          burn_seconds: number | null
          campaign_id: string
          consumed: boolean
          created_at: string
          fuel_item: string | null
          full_seconds: number | null
          id: string
          keep_lit: boolean
          left_seconds: number | null
          line_id: string | null
          lit_at: number | null
          name: string
          out_at: number | null
          type_id: string | null
          updated_at: string
          version: number
          warn_seconds: number | null
        }
        SetofOptions: {
          from: "*"
          to: "character_lights"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_place_piece: {
        Args: { piece: string }
        Returns: {
          asset_id: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string | null
          gm_stat_line: string
          gm_trigger: string
          gm_value: string
          id: string
          kind: string
          lead: string | null
          place_id: string
          position: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "place_pieces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_status: {
        Args: { seen_version?: number; status: string }
        Returns: {
          actor_id: string
          campaign_id: string
          condition_id: string | null
          created_at: string
          end_reason: string | null
          ended_at: number | null
          ends_at: number | null
          icon: string | null
          id: string
          level: number | null
          levels: Json | null
          name: string
          note: string | null
          secret: boolean
          source: string
          stacking: boolean
          stacks: number
          started_at: number
          total_seconds: number | null
          undone: boolean
          unit: string | null
          until_rest: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "character_statuses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reply_request: {
        Args: { accept: boolean; request: string; seen_version?: number }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_shop_stock: {
        Args: { campaign: string; items: string[]; on_day: number; service: string }
        Returns: number
      }
      request_sheet_change: {
        Args: { actor: string; field: string; label: string; to_value: number }
        Returns: {
          actor_id: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          field: string
          from_value: number | null
          id: string
          label: string
          reason: string
          requester_id: string | null
          status: string
          to_value: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "sheet_changes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resolve_lost: {
        Args: {
          day: number
          lost: string
          outcome: string
          seen_version?: number
        }
        Returns: {
          attempts: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          found_day: number | null
          group_number: number
          id: string
          note: string
          roll: string | null
          roll_by: string | null
          since_day: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "group_lost"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reveal_check: {
        Args: { result: string; seen_version?: number }
        Returns: {
          at_seconds: number
          campaign_id: string
          check_key: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          modifiers: Json
          name: string
          note: string | null
          outcome: string
          revealed: boolean
          revealed_by_hand: boolean
          roll: string | null
          row_text: string | null
          secret: boolean
          source: string
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "check_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_marching_preset: {
        Args: {
          campaign: string
          party_group?: number
          preset_name: string
          seen_version?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marching_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      scene_pictures:
        | {
            Args: { campaign: string }
            Returns: {
              asset_id: string
              group_number: number
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              asset_id: string
              group_number: number
            }[]
          }
      scene_pieces:
        | {
            Args: { campaign: string }
            Returns: {
              body: string
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_name: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              body: string
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_name: string
            }[]
          }
      scene_town:
        | {
            Args: { campaign: string }
            Returns: {
              entry_key: string
              group_number: number
              kind: string
              name: string
              open: boolean
              place_name: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              entry_key: string
              group_number: number
              kind: string
              name: string
              open: boolean
              place_name: string
            }[]
          }
      scene_town_pictures:
        | {
            Args: { campaign: string }
            Returns: {
              asset_id: string
              entry_key: string
              group_number: number
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              asset_id: string
              entry_key: string
              group_number: number
            }[]
          }
      scene_town_pieces:
        | {
            Args: { campaign: string }
            Returns: {
              body: string
              entry_key: string
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_name: string
            }[]
          }
        | {
            Args: { as_player: string; campaign: string }
            Returns: {
              body: string
              entry_key: string
              group_number: number
              kind: string
              lead: string
              piece_id: string
              place_name: string
            }[]
          }
      season_not_now: { Args: { campaign: string }; Returns: string }
      send_hook: {
        Args: {
          body: string
          campaign: string
          hook_key: string
          pack: string
          pays: string
          to_actor?: string
        }
        Returns: {
          actor_id: string | null
          body: string
          campaign_id: string
          clock_seconds: number
          created_at: string
          created_by: string | null
          hook_key: string
          id: string
          kind: string
          name: string
          pack_id: string
          pays: string
          player_user_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "hook_sends"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_message: {
        Args: {
          body: string
          burn?: boolean
          campaign: string
          keep?: boolean
          kind?: string
          to_characters?: string[]
        }
        Returns: {
          body: string
          burn: boolean
          campaign_id: string
          created_at: string
          created_by: string | null
          everyone: boolean
          id: string
          keep: boolean
          kind: string
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "gm_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_messages: {
        Args: {
          attachment?: Json
          body?: string
          campaign: string
          disappears?: boolean
          to_characters: string[]
        }
        Returns: {
          actor_id: string
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          body: string
          campaign_id: string
          created_at: string
          disappears: boolean
          from_gm: boolean
          id: string
          player_user_id: string
          read_at: string | null
          sender_user_id: string | null
          undone: boolean
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      send_request: {
        Args: {
          actor: string
          body: string
          campaign: string
          cost_text?: string
          kind: string
          prompt?: Json
        }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_camp_watches: {
        Args: { actor: string; camp: string; watches: Json }
        Returns: {
          actor_id: string
          at: number
          camp_id: string
          campaign_id: string
          created_at: string
          created_by: string | null
          detail: Json
          food_kind: string | null
          food_name: string | null
          from_pot: boolean
          group_number: number
          id: string
          kind: string
          line_id: string | null
          outcome: string | null
          qty: number
          seconds: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "camp_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_check_roll: {
        Args: {
          result: string
          roll: string
          row_text: string
          seen_version?: number
          table_id: string
        }
        Returns: {
          at_seconds: number
          campaign_id: string
          check_key: string
          created_at: string
          created_by: string | null
          expedition_id: string | null
          id: string
          modifiers: Json
          name: string
          note: string | null
          outcome: string
          revealed: boolean
          revealed_by_hand: boolean
          roll: string | null
          row_text: string | null
          secret: boolean
          source: string
          table_id: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "check_results"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_clock: {
        Args: { campaign: string; seen_version?: number; to_seconds: number }
        Returns: {
          campaign_id: string
          created_at: string
          id: string
          seconds: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "campaign_clocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_encounter_watch: {
        Args: { encounter: string; seen_version?: number; watch: string }
        Returns: {
          campaign_id: string
          check_result_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          expedition_id: string | null
          id: string
          started_at: string | null
          state: string
          undone: boolean
          updated_at: string
          version: number
          watch: string | null
        }
        SetofOptions: {
          from: "*"
          to: "waiting_encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_group_place: {
        Args: { campaign: string; group_no: number; place_name: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          group_number: number
          id: string
          moved_on: boolean
          place_id: string | null
          shown: boolean
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "group_places"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_group_place_at: {
        Args: { campaign: string; group_no: number; place: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          group_number: number
          id: string
          moved_on: boolean
          place_id: string | null
          shown: boolean
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "group_places"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_lost: {
        Args: { campaign: string; day: number; group_no: number; note?: string }
        Returns: {
          attempts: number
          campaign_id: string
          created_at: string
          created_by: string | null
          expedition_id: string
          found_day: number | null
          group_number: number
          id: string
          note: string
          roll: string | null
          roll_by: string | null
          since_day: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "group_lost"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_marching_order: {
        Args: {
          campaign: string
          new_rows: Json
          party_group?: number
          seen_version?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marching_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_place_picture: {
        Args: { asset: string; place: string }
        Returns: {
          asset_id: string | null
          body: string
          campaign_id: string
          created_at: string
          created_by: string | null
          gm_stat_line: string
          gm_trigger: string
          gm_value: string
          id: string
          kind: string
          lead: string | null
          place_id: string
          position: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "place_pieces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_knowledge_share: {
        Args: {
          campaign: string
          entry_id: string
          group_no: number
          pack: string
          section_at: number
          share: boolean
        }
        Returns: {
          body: Json | null
          campaign_id: string
          created_at: string
          created_by: string | null
          entry_id: string
          group_number: number
          heading: string
          id: string
          pack_id: string
          place_name: string
          section_at: number
          shared: boolean
          shared_clock: number
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "knowledge_shares"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_place_rule_switch: {
        Args: {
          campaign: string
          entry_id: string
          pack: string
          rule_id: string
          value: boolean
          which: string
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          pack_id: string
          place_name: string
          rule_id: string
          rule_name: string
          undone: boolean
          updated_at: string
          value: boolean
          which: string
        }
        SetofOptions: {
          from: "*"
          to: "place_rule_switches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_shop_stock: {
        Args: {
          answer: string
          campaign: string
          item: string
          on_day: number
          service: string
        }
        Returns: {
          answer: string
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          id: string
          item_id: string
          service_id: string
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "shop_stock"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_spells: {
        Args: {
          actor: string
          new_cast: Json
          new_chosen: Json
          new_ready: Json
        }
        Returns: undefined
      }
      set_status_time: {
        Args: { seconds_left: number; seen_version?: number; status: string }
        Returns: {
          actor_id: string
          campaign_id: string
          condition_id: string | null
          created_at: string
          end_reason: string | null
          ended_at: number | null
          ends_at: number | null
          icon: string | null
          id: string
          level: number | null
          levels: Json | null
          name: string
          note: string | null
          secret: boolean
          source: string
          stacking: boolean
          stacks: number
          started_at: number
          total_seconds: number | null
          undone: boolean
          unit: string | null
          until_rest: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "character_statuses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_travel_budget: {
        Args: {
          campaign: string
          gm_per_day?: number
          group_no: number
          pace?: string
          seen_version?: number
          total: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "travel_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      shop_stock_default_check: {
        Args: { availability: Json; town_size?: string }
        Returns: string
      }
      shop_stock_in: {
        Args: {
          campaign: string
          offered?: string[]
          on_day: number
          service: string
        }
        Returns: {
          item_id: string
        }[]
      }
      show_place_piece: {
        Args: { piece: string; show_it: boolean; visit: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          group_number: number
          group_place_id: string
          id: string
          piece_id: string
          shown: boolean
          shown_at: string
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "piece_shows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      show_town_place_piece: {
        Args: { piece: string; show_it: boolean; visit: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          group_number: number
          group_place_id: string
          id: string
          piece_id: string
          shown: boolean
          shown_at: string
          undone: boolean
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "town_piece_shows"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      spend_travel_day: {
        Args: { campaign: string; group_no: number; seen_version?: number }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "travel_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      split_inventory_line: {
        Args: { how_many: number; line: string; seen_version?: number }
        Returns: string
      }
      start_downtime: {
        Args: { campaign: string; refills?: Json }
        Returns: string
      }
      start_encounter: {
        Args: { encounter: string; seen_version?: number }
        Returns: {
          campaign_id: string
          check_result_id: string
          created_at: string
          created_by: string | null
          dismissed_at: string | null
          expedition_id: string | null
          id: string
          started_at: string | null
          state: string
          undone: boolean
          updated_at: string
          version: number
          watch: string | null
        }
        SetofOptions: {
          from: "*"
          to: "waiting_encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_expedition: {
        Args: { campaign: string; mode_id: string; place_name?: string }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_expedition_at: {
        Args: { campaign: string; mode_id: string; place: string }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_session: {
        Args: { campaign: string }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: string | null
          ended_by: string | null
          id: string
          number: number
          started_at: string
          started_by: string | null
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_travel_day: {
        Args: {
          campaign: string
          day: number
          gm_per_day?: number
          group_no: number
          pace?: string
          total: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "travel_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      step_status: {
        Args: { seen_version?: number; status: string; step: number }
        Returns: {
          actor_id: string
          campaign_id: string
          condition_id: string | null
          created_at: string
          end_reason: string | null
          ended_at: number | null
          ends_at: number | null
          icon: string | null
          id: string
          level: number | null
          levels: Json | null
          name: string
          note: string | null
          secret: boolean
          source: string
          stacking: boolean
          stacks: number
          started_at: number
          total_seconds: number | null
          undone: boolean
          unit: string | null
          until_rest: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "character_statuses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      table_pins_now: {
        Args: { campaign: string }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          pinned_at: string
          table_id: string
          undone: boolean
          unpinned_at: string | null
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "table_pins"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      take_back_sheet_change: {
        Args: { change: string; seen_version?: number }
        Returns: {
          actor_id: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          created_at: string
          created_by: string | null
          field: string
          from_value: number | null
          id: string
          label: string
          reason: string
          requester_id: string | null
          status: string
          to_value: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "sheet_changes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      town_parts_shown: {
        Args: { visit: string }
        Returns: {
          piece_id: string
        }[]
      }
      travel_move: {
        Args: {
          campaign: string
          cost: number
          group_no: number
          place_id?: string
          place_name?: string
          route_id?: string
          seen_version?: number
          terrain_id?: string
        }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number
          expedition_id: string
          forced: number
          gm_per_day: number | null
          group_number: number
          id: string
          pace: string
          pending_owed: number | null
          pending_place_id: string | null
          pending_place_name: string | null
          pending_route_id: string | null
          pending_terrain_id: string | null
          route_id: string | null
          spent: number
          terrain_id: string | null
          total: number
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "travel_groups"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_activity: {
        Args: { run_id: string }
        Returns: {
          activity_id: string
          activity_name: string
          actor_ids: string[]
          campaign_id: string
          created_at: string
          created_by: string | null
          day: number | null
          expedition_id: string
          finder_id: string | null
          group_number: number
          id: string
          outcome: string
          rolls: Json
          spent: number
          travel_group_id: string | null
          undone: boolean
          updated_at: string
          version: number
          yield_line_id: string | null
          yield_name: string | null
          yield_qty: number
        }
        SetofOptions: {
          from: "*"
          to: "activity_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_buy: {
        Args: { request: string }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      undo_find: { Args: { event_id: string }; Returns: undefined }
      undo_request: { Args: { event_id: string }; Returns: undefined }
      undo_request_said: { Args: { event_id: string }; Returns: Json }
      unpin_table: {
        Args: { pin: string; seen_version?: number }
        Returns: {
          campaign_id: string
          created_at: string
          created_by: string | null
          id: string
          pinned_at: string
          table_id: string
          undone: boolean
          unpinned_at: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "table_pins"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_ability: {
        Args: { ability: string; actor: string; spent: number }
        Returns: Json
      }
      use_marching_preset: {
        Args: {
          campaign: string
          party_group?: number
          preset_name: string
          seen_version?: number
        }
        Returns: {
          campaign_id: string
          created_at: string
          group_number: number
          id: string
          last_preset: string | null
          locked: boolean
          presets: Json
          rows: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "marching_orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      use_safe_paths: {
        Args: { expedition: string }
        Returns: {
          campaign_id: string
          created_at: string
          ended_at: number | null
          ended_safe: boolean | null
          id: string
          mode: string
          safe_paths: boolean
          session_id: string | null
          started_at: number
          started_by: string | null
          summary: Json | null
          undone: boolean
          updated_at: string
          version: number
          who_went: string[]
        }
        SetofOptions: {
          from: "*"
          to: "expeditions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      weather_die: {
        Args: { campaign: string; table_id: string }
        Returns: string
      }
      withdraw_request: {
        Args: { request: string; seen_version?: number }
        Returns: {
          actor_id: string | null
          answer: Json | null
          answer_kind: string
          answered_at: string | null
          answered_by: string | null
          campaign_id: string
          cost_text: string
          created_at: string
          created_by: string | null
          direction: string
          entry: Json | null
          expedition_id: string | null
          group_number: number | null
          id: string
          kind: string
          prompt: Json
          replied_at: string | null
          reply: string | null
          requester_id: string | null
          status: string
          text: string
          undone: boolean
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
