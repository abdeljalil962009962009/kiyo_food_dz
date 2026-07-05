-- Add driver role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';

-- Create driver profile view with computed fields
CREATE OR REPLACE VIEW driver_profile_view AS
SELECT 
  d.id as driver_id,
  d.user_id,
  p.full_name,
  p.email,
  p.phone,
  d.vehicle_type,
  d.vehicle_plate,
  d.vehicle_color,
  d.is_online,
  d.is_verified,
  d.is_active,
  d.current_latitude,
  d.current_longitude,
  d.last_location_update,
  d.rating,
  d.delivery_count,
  d.created_at
FROM drivers d
JOIN profiles p ON p.id = d.user_id;

-- Grant select on view
GRANT SELECT ON driver_profile_view TO authenticated;