-- ============================================================
-- AgriIQ — PostgreSQL + PostGIS Schema
-- Runs automatically on first container start
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for text search on crop names

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,        -- bcrypt
    full_name   VARCHAR(255) NOT NULL,
    phone       VARCHAR(20),
    role        VARCHAR(20)  NOT NULL DEFAULT 'FARMER',  -- FARMER | AGRONOMIST
    language    VARCHAR(10)  NOT NULL DEFAULT 'en',      -- en | hi | mr | te | ta
    district    VARCHAR(100),
    state       VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── FIELDS (geospatial) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fields (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(255) NOT NULL,
    boundary      GEOMETRY(POLYGON, 4326) NOT NULL,    -- WGS84 polygon
    area_hectares NUMERIC(10, 4),
    district      VARCHAR(100),
    state         VARCHAR(100),
    previous_crop VARCHAR(100),    -- last season crop (for rotation logic)
    prev_prev_crop VARCHAR(100),   -- 2 seasons ago
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fields_boundary_idx ON fields USING GIST(boundary);
CREATE INDEX IF NOT EXISTS fields_user_idx     ON fields(user_id);

-- ─── NDVI READINGS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ndvi_readings (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id      UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    observed_date DATE NOT NULL,
    ndvi_mean     NUMERIC(6, 4),    -- −1.0 to 1.0
    ndvi_max      NUMERIC(6, 4),
    ndvi_min      NUMERIC(6, 4),
    ndvi_std      NUMERIC(6, 4),
    ndvi_trend    NUMERIC(8, 5),    -- slope of NDVI over last 30 days
    cloud_cover   NUMERIC(5, 2),    -- percentage
    source        VARCHAR(50) DEFAULT 'mock',  -- mock | sentinel2 | modis
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (field_id, observed_date, source)
);

CREATE INDEX IF NOT EXISTS ndvi_field_date_idx ON ndvi_readings(field_id, observed_date DESC);

-- ─── SOIL PROFILES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS soil_profiles (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id       UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    ph             NUMERIC(4, 2),          -- 0–14
    nitrogen       NUMERIC(8, 3),          -- kg/ha
    phosphorus     NUMERIC(8, 3),          -- kg/ha
    potassium      NUMERIC(8, 3),          -- kg/ha
    organic_carbon NUMERIC(6, 3),          -- %
    texture        VARCHAR(50),            -- Sandy | Loamy | Clay | Silt | Clay Loam etc.
    sand_pct       NUMERIC(5, 2),
    silt_pct       NUMERIC(5, 2),
    clay_pct       NUMERIC(5, 2),
    bulk_density   NUMERIC(6, 3),          -- g/cm³
    water_capacity NUMERIC(6, 3),          -- mm/m
    source         VARCHAR(50) DEFAULT 'mock',  -- mock | soilgrids | healthcard
    fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (field_id, source)
);

-- ─── HISTORICAL YIELD ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS yield_history (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district     VARCHAR(100) NOT NULL,
    state        VARCHAR(100) NOT NULL,
    crop         VARCHAR(100) NOT NULL,
    season       VARCHAR(20)  NOT NULL,   -- Kharif | Rabi | Zaid
    year         INTEGER      NOT NULL,
    yield_kg_ha  NUMERIC(10, 2),          -- kg per hectare
    area_ha      NUMERIC(12, 2),
    production   NUMERIC(14, 2),
    source       VARCHAR(50)  DEFAULT 'icrisat',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (district, state, crop, season, year)
);

CREATE INDEX IF NOT EXISTS yield_district_crop_idx ON yield_history(district, state, crop, year);

-- ─── WEATHER READINGS ─────────────────────────────────────────────────────────
-- Monthly historical weather per district (10-year history, mock by default)
CREATE TABLE IF NOT EXISTS weather_readings (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    district       VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL,
    year           INTEGER      NOT NULL,
    month          INTEGER      NOT NULL,  -- 1–12
    rainfall_mm    NUMERIC(8, 2),           -- monthly total rainfall (mm)
    temp_max_c     NUMERIC(5, 2),           -- avg daily max temp (°C)
    temp_min_c     NUMERIC(5, 2),           -- avg daily min temp (°C)
    humidity_pct   NUMERIC(5, 2),           -- avg relative humidity (%)
    solar_rad_mj   NUMERIC(6, 2),           -- avg solar radiation (MJ/m²/day)
    et0_mm         NUMERIC(7, 2),           -- reference evapotranspiration (mm)
    source         VARCHAR(50)  DEFAULT 'mock',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (district, state, year, month, source)
);

CREATE INDEX IF NOT EXISTS weather_district_ym_idx ON weather_readings(district, state, year, month DESC);

-- ─── MANDI PRICES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mandi_prices (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    commodity    VARCHAR(100) NOT NULL,
    variety      VARCHAR(100),
    market       VARCHAR(150) NOT NULL,
    district     VARCHAR(100) NOT NULL,
    state        VARCHAR(100) NOT NULL,
    price_date   DATE         NOT NULL,
    min_price    NUMERIC(10, 2),          -- INR per quintal
    max_price    NUMERIC(10, 2),
    modal_price  NUMERIC(10, 2),
    source       VARCHAR(50)  DEFAULT 'mock',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (commodity, market, price_date, source)
);

CREATE INDEX IF NOT EXISTS mandi_commodity_date_idx ON mandi_prices(commodity, price_date DESC);
CREATE INDEX IF NOT EXISTS mandi_district_idx        ON mandi_prices(district, state);

-- ─── RECOMMENDATIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id            UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    season              VARCHAR(20),
    results             JSONB NOT NULL DEFAULT '[]',   -- array of crop recommendation objects
    ndvi_snapshot       JSONB,
    soil_snapshot       JSONB,
    price_snapshot      JSONB,
    model_version       VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS reco_field_idx ON recommendations(field_id, generated_at DESC);

-- ─── FEEDBACK (predicted vs actual) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_id          UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_id UUID REFERENCES recommendations(id),
    crop              VARCHAR(100) NOT NULL,
    season            VARCHAR(20),
    year              INTEGER,
    actual_yield_kg_ha NUMERIC(10, 2),    -- what the farmer actually harvested
    actual_revenue    NUMERIC(12, 2),     -- INR
    notes             TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INPUT COSTS (regional estimates) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS input_costs (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop          VARCHAR(100) NOT NULL,
    state         VARCHAR(100),
    season        VARCHAR(20),
    seed_cost     NUMERIC(10, 2),   -- INR/ha
    fertilizer    NUMERIC(10, 2),   -- INR/ha
    pesticide     NUMERIC(10, 2),   -- INR/ha
    labor         NUMERIC(10, 2),   -- INR/ha
    irrigation    NUMERIC(10, 2),   -- INR/ha
    other         NUMERIC(10, 2),   -- INR/ha
    total_cost    NUMERIC(10, 2) GENERATED ALWAYS AS
                    (COALESCE(seed_cost,0) + COALESCE(fertilizer,0) + COALESCE(pesticide,0)
                     + COALESCE(labor,0) + COALESCE(irrigation,0) + COALESCE(other,0)) STORED,
    source        VARCHAR(50) DEFAULT 'default',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (crop, state, season)
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin user (password: Admin@123)
INSERT INTO users (id, email, password, full_name, role, district, state)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@agriiq.in',
    '$2b$12$L.IOEwiYJ0K/XwCzqYfRZuiTcv2Pd7I0SmqE0QJDZbTrVbhhPVFvi',
    'AgriIQ Admin',
    'AGRONOMIST',
    'Pune',
    'Maharashtra'
) ON CONFLICT DO NOTHING;

-- Demo farmer (password: Farmer@123)
INSERT INTO users (id, email, password, full_name, role, district, state, language)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'farmer@agriiq.in',
    '$2b$12$o4k57CjQNjQ.eflqvDdQw.muukPLhc1OkUmUz17hxQbvhkCgTO/QS',
    'Ramesh Patil',
    'FARMER',
    'Nashik',
    'Maharashtra',
    'hi'
) ON CONFLICT DO NOTHING;

-- Input cost estimates (representative, not precise)
INSERT INTO input_costs (crop, state, season, seed_cost, fertilizer, pesticide, labor, irrigation, other) VALUES
('Rice',       'Maharashtra', 'Kharif', 4000, 8000, 3000, 12000, 5000, 2000),
('Wheat',      'Maharashtra', 'Rabi',   3500, 7000, 2500, 9000,  4000, 1500),
('Maize',      'Maharashtra', 'Kharif', 3000, 6500, 2000, 8000,  3000, 1500),
('Soybean',    'Maharashtra', 'Kharif', 5000, 5000, 2500, 8000,  2000, 1000),
('Cotton',     'Maharashtra', 'Kharif', 8000, 9000, 6000, 18000, 4000, 2000),
('Groundnut',  'Maharashtra', 'Kharif', 7000, 5500, 2000, 10000, 3000, 1500),
('Sugarcane',  'Maharashtra', 'Kharif', 6000, 12000,4000, 25000, 8000, 3000),
('Tur (Arhar)','Maharashtra', 'Kharif', 3500, 4000, 2500, 7000,  1500, 1000),
('Gram',       'Maharashtra', 'Rabi',   5000, 4500, 2000, 7500,  2000, 1000),
('Rice',       'Punjab',      'Kharif', 4500, 9000, 3500, 11000, 6000, 2000),
('Wheat',      'Punjab',      'Rabi',   3800, 8000, 3000, 9500,  4500, 1500),
('Maize',      'Punjab',      'Kharif', 3200, 7000, 2500, 8500,  3500, 1500),
('Rice',       'Andhra Pradesh','Kharif',4200,8500, 3200, 13000, 5500, 2000),
('Groundnut',  'Andhra Pradesh','Kharif',7500,5000, 2200, 11000, 3500, 1500)
ON CONFLICT DO NOTHING;

-- Mandi price seed data (recent representative prices, INR/quintal)
INSERT INTO mandi_prices (commodity, market, district, state, price_date, min_price, max_price, modal_price) VALUES
('Rice',       'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  1800, 2200, 2050),
('Wheat',      'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  2100, 2600, 2350),
('Maize',      'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  1500, 1900, 1700),
('Soybean',    'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  4200, 5000, 4600),
('Cotton',     'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  6000, 7500, 6800),
('Groundnut',  'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  5000, 6500, 5700),
('Sugarcane',  'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  340,  380,  360),
('Tur (Arhar)','Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  5800, 7000, 6400),
('Gram',       'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 1,  4500, 5500, 5000),
('Rice',       'Amritsar Mandi','Amritsar',  'Punjab',      CURRENT_DATE - 1,  1900, 2300, 2100),
('Wheat',      'Amritsar Mandi','Amritsar',  'Punjab',      CURRENT_DATE - 1,  2150, 2550, 2350),
('Rice',       'Guntur APMC',   'Guntur',    'Andhra Pradesh',CURRENT_DATE - 1,1850, 2250, 2050),
('Groundnut',  'Guntur APMC',   'Guntur',    'Andhra Pradesh',CURRENT_DATE - 1,5100, 6400, 5700),
-- Historical mandi prices for trend charts
('Rice',       'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 30, 1750, 2150, 1980),
('Wheat',      'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 30, 2050, 2500, 2280),
('Soybean',    'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 30, 4000, 4800, 4400),
('Cotton',     'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 30, 5800, 7200, 6600),
('Rice',       'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 60, 1700, 2100, 1920),
('Wheat',      'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 60, 2000, 2450, 2220),
('Soybean',    'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 60, 3900, 4700, 4300),
('Cotton',     'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 60, 5600, 7000, 6400),
('Rice',       'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 90, 1680, 2080, 1900),
('Wheat',      'Nashik APMC',   'Nashik',    'Maharashtra', CURRENT_DATE - 90, 1950, 2400, 2180)
ON CONFLICT DO NOTHING;

-- Historical yield seed data (district-level, ICRISAT-format)
INSERT INTO yield_history (district, state, crop, season, year, yield_kg_ha, area_ha, production) VALUES
-- Maharashtra - Nashik
('Nashik','Maharashtra','Rice',      'Kharif',2019,2450,45000,110250000),
('Nashik','Maharashtra','Rice',      'Kharif',2020,2580,46000,118680000),
('Nashik','Maharashtra','Rice',      'Kharif',2021,2610,47500,124175000),
('Nashik','Maharashtra','Rice',      'Kharif',2022,2490,46800,116532000),
('Nashik','Maharashtra','Rice',      'Kharif',2023,2720,48000,130560000),
('Nashik','Maharashtra','Wheat',     'Rabi',  2019,2980,38000,113240000),
('Nashik','Maharashtra','Wheat',     'Rabi',  2020,3050,39000,118950000),
('Nashik','Maharashtra','Wheat',     'Rabi',  2021,3120,40000,124800000),
('Nashik','Maharashtra','Wheat',     'Rabi',  2022,2990,39500,118105000),
('Nashik','Maharashtra','Wheat',     'Rabi',  2023,3200,41000,131200000),
('Nashik','Maharashtra','Maize',     'Kharif',2019,2800,22000,61600000),
('Nashik','Maharashtra','Maize',     'Kharif',2020,2950,23000,67850000),
('Nashik','Maharashtra','Maize',     'Kharif',2021,3100,24000,74400000),
('Nashik','Maharashtra','Maize',     'Kharif',2022,2880,23500,67680000),
('Nashik','Maharashtra','Maize',     'Kharif',2023,3250,25000,81250000),
('Nashik','Maharashtra','Soybean',   'Kharif',2019,1050,35000,36750000),
('Nashik','Maharashtra','Soybean',   'Kharif',2020,1120,36000,40320000),
('Nashik','Maharashtra','Soybean',   'Kharif',2021,980, 34000,33320000),
('Nashik','Maharashtra','Soybean',   'Kharif',2022,1180,37000,43660000),
('Nashik','Maharashtra','Soybean',   'Kharif',2023,1240,38000,47120000),
('Nashik','Maharashtra','Cotton',    'Kharif',2019,420, 85000,35700000),
('Nashik','Maharashtra','Cotton',    'Kharif',2020,450, 87000,39150000),
('Nashik','Maharashtra','Cotton',    'Kharif',2021,380, 82000,31160000),
('Nashik','Maharashtra','Cotton',    'Kharif',2022,480, 89000,42720000),
('Nashik','Maharashtra','Cotton',    'Kharif',2023,510, 91000,46410000),
('Nashik','Maharashtra','Groundnut', 'Kharif',2019,1680,18000,30240000),
('Nashik','Maharashtra','Groundnut', 'Kharif',2020,1750,19000,33250000),
('Nashik','Maharashtra','Groundnut', 'Kharif',2021,1620,17500,28350000),
('Nashik','Maharashtra','Groundnut', 'Kharif',2022,1820,20000,36400000),
('Nashik','Maharashtra','Groundnut', 'Kharif',2023,1900,21000,39900000),
('Nashik','Maharashtra','Tur (Arhar)','Kharif',2019,880, 28000,24640000),
('Nashik','Maharashtra','Tur (Arhar)','Kharif',2020,920, 29000,26680000),
('Nashik','Maharashtra','Tur (Arhar)','Kharif',2021,850, 27000,22950000),
('Nashik','Maharashtra','Tur (Arhar)','Kharif',2022,960, 30000,28800000),
('Nashik','Maharashtra','Tur (Arhar)','Kharif',2023,1010,31000,31310000),
('Nashik','Maharashtra','Gram',      'Rabi',  2019,920, 15000,13800000),
('Nashik','Maharashtra','Gram',      'Rabi',  2020,980, 16000,15680000),
('Nashik','Maharashtra','Gram',      'Rabi',  2021,870, 14500,12615000),
('Nashik','Maharashtra','Gram',      'Rabi',  2022,1050,17000,17850000),
('Nashik','Maharashtra','Gram',      'Rabi',  2023,1100,18000,19800000),
-- Punjab - Amritsar
('Amritsar','Punjab','Rice',  'Kharif',2019,3800,120000,456000000),
('Amritsar','Punjab','Rice',  'Kharif',2020,3950,122000,481900000),
('Amritsar','Punjab','Rice',  'Kharif',2021,4100,125000,512500000),
('Amritsar','Punjab','Rice',  'Kharif',2022,3900,121000,471900000),
('Amritsar','Punjab','Rice',  'Kharif',2023,4250,127000,539750000),
('Amritsar','Punjab','Wheat', 'Rabi',  2019,4500,130000,585000000),
('Amritsar','Punjab','Wheat', 'Rabi',  2020,4650,132000,613800000),
('Amritsar','Punjab','Wheat', 'Rabi',  2021,4800,135000,648000000),
('Amritsar','Punjab','Wheat', 'Rabi',  2022,4550,131000,596050000),
('Amritsar','Punjab','Wheat', 'Rabi',  2023,4900,137000,671300000),
('Amritsar','Punjab','Maize', 'Kharif',2019,3200,25000,80000000),
('Amritsar','Punjab','Maize', 'Kharif',2020,3400,26000,88400000),
('Amritsar','Punjab','Maize', 'Kharif',2021,3600,27000,97200000),
('Amritsar','Punjab','Maize', 'Kharif',2022,3300,25500,84150000),
('Amritsar','Punjab','Maize', 'Kharif',2023,3700,28000,103600000),
-- Andhra Pradesh - Guntur
('Guntur','Andhra Pradesh','Rice',     'Kharif',2019,3200,280000,896000000),
('Guntur','Andhra Pradesh','Rice',     'Kharif',2020,3350,285000,954750000),
('Guntur','Andhra Pradesh','Rice',     'Kharif',2021,3500,290000,1015000000),
('Guntur','Andhra Pradesh','Rice',     'Kharif',2022,3280,282000,925920000),
('Guntur','Andhra Pradesh','Rice',     'Kharif',2023,3600,295000,1062000000),
('Guntur','Andhra Pradesh','Groundnut','Kharif',2019,1900,95000,180500000),
('Guntur','Andhra Pradesh','Groundnut','Kharif',2020,2000,97000,194000000),
('Guntur','Andhra Pradesh','Groundnut','Kharif',2021,1850,92000,170200000),
('Guntur','Andhra Pradesh','Groundnut','Kharif',2022,2100,100000,210000000),
('Guntur','Andhra Pradesh','Groundnut','Kharif',2023,2200,103000,226600000)
ON CONFLICT DO NOTHING;
