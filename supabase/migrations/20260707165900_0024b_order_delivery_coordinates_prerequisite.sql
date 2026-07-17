-- Ensure order coordinate columns exist before the geospatial trigger in 0025.
-- This is additive and safe for databases where later location migrations have
-- already introduced these columns.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_latitude double precision,
  ADD COLUMN IF NOT EXISTS delivery_longitude double precision;
