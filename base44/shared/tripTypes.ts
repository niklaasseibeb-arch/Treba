export type TripRequestStatus =
  | "requested"
  | "offering"
  | "scheduled"
  | "partially_booked"
  | "fully_booked"
  | "completed"
  | "cancelled";

export type DriverOfferStatus =
  | "offered"
  | "available"
  | "unavailable"
  | "accepted"
  | "declined"
  | "expired";

export type AllocationStatus =
  | "awaiting_confirmation"
  | "confirmed"
  | "declined"
  | "reassigned"
  | "completed"
  | "cancelled";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export interface TripRequest {
  id: string;

  passenger_id: string;
  passenger_name?: string;

  origin: string;
  destination: string;

  route_id?: string;

  pickup_location: string;
  dropoff_location: string;

  pickup_is_standard?: boolean;
  dropoff_is_standard?: boolean;

  requested_date: string;
  requested_time: string;

  number_of_seats: number;

  luggage_small_bags?: number;
  luggage_standard_bags?: number;
  luggage_large_suitcases?: number;
  luggage_oversized_items?: number;
  luggage_weight_category?: string;
  luggage_details?: string;

  payment_method?: "direct_to_driver" | "cash_to_driver";

  request_status: TripRequestStatus;

  notes?: string;
}

export interface DriverOffer {
  id: string;

  trip_request_id: string;
  driver_id: string;

  route_id?: string;

  requested_date: string;
  requested_time: string;

  status: DriverOfferStatus;

  offered_at?: string;
  responded_at?: string;

  offer_sequence?: number;
  expires_at?: string;
}

export interface Allocation {
  id: string;

  trip_request_id?: string;

  driver_id: string;
  route_id?: string;

  origin: string;
  destination: string;

  date: string;
  departure_time: string;

  vehicle_id?: string;
  vehicle_label?: string;

  total_seats: number;
  booked_seats: number;
  available_seats: number;

  status: AllocationStatus;

  offer_sequence?: number;
}

export interface Booking {
  id: string;

  trip_request_id: string;
  allocation_id: string;

  passenger_id: string;

  passenger_name?: string;

  number_of_seats: number;

  agreed_fare?: number;

  payment_method: "direct_to_driver" | "cash_to_driver";

  payment_status:
    | "pending"
    | "fare_agreed"
    | "fare_received"
    | "cancelled";

  booking_status: BookingStatus;

  booked_at?: string;
}