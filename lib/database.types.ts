export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      facilities: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          user_id: string;
          facility_id: number;
          reservation_date: string;
          start_time: number;
          end_time: number;
          reserved_by_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          facility_id: number;
          reservation_date: string;
          start_time: number;
          end_time: number;
          reserved_by_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          facility_id?: number;
          reservation_date?: string;
          start_time?: number;
          end_time?: number;
          reserved_by_name?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      enforce_med_kku_email_domain: {
        Args: { event: Json };
        Returns: Json;
      };
      can_cancel_reservation: {
        Args: { target_date: string; target_start_time: number };
        Returns: boolean;
      };
      can_reserve_reservation: {
        Args: { target_date: string; target_start_time: number };
        Returns: boolean;
      };
      cancel_reservation_hour: {
        Args: { target_reservation_id: string; target_start_time: number };
        Returns: undefined;
      };
      is_admin_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_med_kku_user: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Facility = Database["public"]["Tables"]["facilities"]["Row"];
export type Reservation = Database["public"]["Tables"]["reservations"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
