import type { ContactLink } from "../contacts";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; username: string | null; display_name: string; avatar_url: string | null; profile_completed: boolean; role: "user" | "admin"; created_at: string; updated_at: string };
        Insert: { id: string; username?: string | null; display_name?: string; avatar_url?: string | null; profile_completed?: boolean; role?: "user" | "admin"; created_at?: string; updated_at?: string };
        Update: { username?: string | null; display_name?: string; avatar_url?: string | null; profile_completed?: boolean; role?: "user" | "admin"; updated_at?: string };
        Relationships: [];
      };
      listings: {
        Row: { id: string; owner_id: string; title: string; description: string; category: string; price: number; location_name: string; latitude: number | null; longitude: number | null; image_path: string; contact_url: string; contact_links: ContactLink[]; status: "active" | "inactive" | "sold"; view_count: number; save_count: number; display_name_override: string | null; display_name_override_enabled: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; owner_id: string; title: string; description: string; category: string; price: number; location_name: string; latitude?: number | null; longitude?: number | null; image_path: string; contact_url: string; contact_links: ContactLink[]; status?: "active" | "inactive" | "sold"; view_count?: number; save_count?: number; display_name_override?: string | null; display_name_override_enabled?: boolean; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["listings"]["Insert"]>;
        Relationships: [{ foreignKeyName: "listings_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      saves: {
        Row: { user_id: string; listing_id: string; created_at: string };
        Insert: { user_id: string; listing_id: string; created_at?: string };
        Update: never;
        Relationships: [
          { foreignKeyName: "saves_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "saves_listing_id_fkey"; columns: ["listing_id"]; isOneToOne: false; referencedRelation: "listings"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: { increment_listing_views: { Args: { listing_uuid: string }; Returns: undefined } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
