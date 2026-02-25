-- Maintenance Enhancements Migration

CREATE TABLE IF NOT EXISTS public.parts_installed (
  part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE NOT NULL,
  maintenance_record_id UUID REFERENCES public.maintenance_records(record_id) ON DELETE SET NULL,
  part_name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  part_number VARCHAR(100),
  category VARCHAR(50) CHECK (category IN ('oil','coolant','transmission_fluid','brake_fluid','power_steering_fluid','fuel_filter','air_filter','cabin_filter','spark_plug','brake_pad','brake_rotor','tire','battery','belt','other')) DEFAULT 'other',
  install_date DATE NOT NULL,
  install_mileage INT,
  warranty_months INT,
  warranty_miles INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parts_vehicle_id ON public.parts_installed(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parts_category ON public.parts_installed(category);

CREATE TABLE IF NOT EXISTS public.service_providers (
  provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  address TEXT,
  specialty VARCHAR(100),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  is_preferred BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON public.service_providers(user_id);

CREATE TABLE IF NOT EXISTS public.maintenance_budgets (
  budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(user_id) ON DELETE CASCADE NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles(vehicle_id) ON DELETE CASCADE,
  period VARCHAR(20) CHECK (period IN ('monthly','annual')) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  alert_at_percent INT DEFAULT 80,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, vehicle_id, period)
);
