-- ================================================================
--  CryoChain v2 — Database Schema
--
--  Zero hardcoded business data.
--  All clients, materials, warehouses, carriers, shipments
--  are added through the UI after first login.
--
--  Run this once:
--  mysql -u root -p < database/schema.sql
-- ================================================================

CREATE DATABASE IF NOT EXISTS cryochain;
USE cryochain;

-- ── 1. Tenants (Client Companies) ────────────────────────────────
-- Stores the profiles of various client pharmaceutical companies.
-- Each tenant represents an isolated workspace in the system protecting their data.
-- Status allows for soft-deletion / suspension of client accounts.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE tenants (
    tenant_id    INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    country      VARCHAR(100),
    plan_type    ENUM('Standard','Enterprise') DEFAULT 'Standard',
    status       ENUM('ACTIVE','SUSPENDED','INACTIVE') DEFAULT 'ACTIVE',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Users ───────────────────────────────────────────────────
-- Represents individuals who can log into the system.
-- Contains role-based access control flags via the ENUM 'role'.
-- Users are linked to a specific tenant unless they are an 'ops_admin' (system wide).
-- Secure bcrypt password hashes are stored rather than raw text.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT,
    email         VARCHAR(200) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150),
    role          ENUM('ops_admin','ops_staff','client_admin','client_user') NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    last_login    TIMESTAMP NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL
);

-- ── 3. Warehouses ──────────────────────────────────────────────
-- Represents physical storage hubs globally.
-- Contains coordinates (lat/lng) for distance calculations and map plotting.
-- 'hub_status' helps ops plan routing (avoiding OFF or STRESSED hubs).
-- ───────────────────────────────────────────────────────────────
CREATE TABLE warehouses (
    warehouse_id INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    city         VARCHAR(100),
    country      VARCHAR(100),
    iata_code    VARCHAR(5),
    latitude     DECIMAL(9,6),
    longitude    DECIMAL(9,6),
    hub_status   ENUM('OPTIMAL','STRESSED','OFFLINE') DEFAULT 'OPTIMAL',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 4. Raw Materials ───────────────────────────────────────────
-- The overarching catalog of materials (e.g., vaccines, biological samples).
-- Essential constraint: 'temp_zone' enforces the logistical handling rules 
-- (e.g., transporting minus70C biologicals requires different carriers).
-- ───────────────────────────────────────────────────────────────
CREATE TABLE raw_materials (
    material_id     INT AUTO_INCREMENT PRIMARY KEY,
    material_name   VARCHAR(200) NOT NULL,
    sku             VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    temp_zone       ENUM('2_8C','minus20C','minus70C') NOT NULL,
    unit_of_measure VARCHAR(50),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 5. Material Certifications ─────────────────────────────────
-- Links compliance paperwork proving a material is safe/certified.
-- Demonstrates One-to-Many dependency: One material has multiple certs.
-- The system's CRON job checks 'expiry_date' daily to alert admins.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE material_certifications (
    cert_id       INT AUTO_INCREMENT PRIMARY KEY,
    material_id   INT NOT NULL,
    cert_body     VARCHAR(100) NOT NULL,
    cert_number   VARCHAR(100),
    cert_type     VARCHAR(100),
    issued_date   DATE,
    expiry_date   DATE,
    cert_status   ENUM('VALID','EXPIRING','EXPIRED') DEFAULT 'VALID',
    document_path VARCHAR(500),
    FOREIGN KEY (material_id) REFERENCES raw_materials(material_id) ON DELETE CASCADE
);

-- ── 6. Inventory ───────────────────────────────────────────────
-- Tracks stock levels for materials AT specific warehouses.
-- Uses a Composite Unique Key (material_id, warehouse_id) to prevent duplicate rows.
-- 'reorder_threshold' allows for automated restocking alerts when stock dips.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE inventory (
    inventory_id      INT AUTO_INCREMENT PRIMARY KEY,
    material_id       INT NOT NULL,
    warehouse_id      INT NOT NULL,
    quantity_on_hand  DECIMAL(12,2) DEFAULT 0,
    reorder_threshold DECIMAL(12,2) DEFAULT 0,
    last_updated      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mat_wh (material_id, warehouse_id),
    FOREIGN KEY (material_id)  REFERENCES raw_materials(material_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
);

-- ── 7. Carriers ────────────────────────────────────────────────
-- Third-party logistics providers (e.g., FedEx, Maersk).
-- 'capacity_pct' can dynamically scale to simulate network constraints.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE carriers (
    carrier_id     INT AUTO_INCREMENT PRIMARY KEY,
    carrier_name   VARCHAR(150) NOT NULL,
    transport_mode ENUM('AIR','SEA','ROAD','RAIL') NOT NULL,
    certifications VARCHAR(300),
    capacity_pct   INT DEFAULT 100,
    contact_email  VARCHAR(200),
    is_active      BOOLEAN DEFAULT TRUE
);

-- ── 8. Routes ──────────────────────────────────────────────────
-- Defines the predefined shipping lanes connecting a warehouse to a city.
-- Critical for the 'findBestRoute' algorithm.
-- 'risk_score' is weighted mechanically backend to decide the most viable route.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE routes (
    route_id            INT AUTO_INCREMENT PRIMARY KEY,
    origin_warehouse_id INT,
    origin_city         VARCHAR(100),
    dest_city           VARCHAR(100),
    carrier_id          INT,
    transport_mode      ENUM('AIR','SEA','ROAD','RAIL'),
    estimated_hours     INT,
    base_cost_usd       DECIMAL(10,2),
    risk_score          DECIMAL(3,2) DEFAULT 0.10,
    is_active           BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(warehouse_id),
    FOREIGN KEY (carrier_id)          REFERENCES carriers(carrier_id)
);

-- ── 9. Procurement Requests ────────────────────────────────────
-- When a Client needs material, they generate a PRQ here.
-- Acts as the first step in the logistics workflow.
-- Once 'APPROVED' by Ops, a matching Shipment Order is instantiated automatically.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE procurement_requests (
    request_id         INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id          INT NOT NULL,
    requested_by       INT NOT NULL,
    material_id        INT NOT NULL,
    quantity_requested DECIMAL(12,2) NOT NULL,
    temp_zone          ENUM('2_8C','minus20C','minus70C'),
    urgency            ENUM('CRITICAL','STANDARD','ECONOMY') DEFAULT 'STANDARD',
    required_by_date   DATE,
    delivery_address   VARCHAR(300),
    notes              TEXT,
    status             ENUM('PENDING','UNDER_REVIEW','APPROVED','REJECTED','FULFILLED') DEFAULT 'PENDING',
    reviewed_by        INT,
    review_notes       TEXT,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at        TIMESTAMP NULL,
    FOREIGN KEY (tenant_id)    REFERENCES tenants(tenant_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (material_id)  REFERENCES raw_materials(material_id),
    FOREIGN KEY (reviewed_by)  REFERENCES users(user_id)
);

-- ── 10. Shipment Orders ────────────────────────────────────────
-- The master record for a validated logistics run.
-- Maintains a hard link to the PRQ it originated from.
-- Uses ENUMs for 'status' (finite state machine representing the lifecycle)
-- and 'urgency' to apply priority cost multipliers.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE shipment_orders (
    order_id               INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id              INT NOT NULL,
    created_by_user_id     INT NOT NULL,
    procurement_request_id INT,
    material_id            INT NOT NULL,
    quantity_ordered       DECIMAL(12,2) NOT NULL,
    origin_warehouse_id    INT,
    dest_city              VARCHAR(150),
    dest_country           VARCHAR(100),
    temp_zone              ENUM('2_8C','minus20C','minus70C') NOT NULL,
    urgency                ENUM('CRITICAL','STANDARD','ECONOMY') DEFAULT 'STANDARD',
    required_by_date       DATE,
    status                 ENUM('PENDING','APPROVED','ALLOCATED','DISPATCHED','IN_TRANSIT','AT_RISK','DELIVERED','CANCELLED') DEFAULT 'PENDING',
    estimated_cost_usd     DECIMAL(10,2),
    risk_score             DECIMAL(3,2),
    notes                  TEXT,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)              REFERENCES tenants(tenant_id),
    FOREIGN KEY (created_by_user_id)     REFERENCES users(user_id),
    FOREIGN KEY (procurement_request_id) REFERENCES procurement_requests(request_id),
    FOREIGN KEY (material_id)            REFERENCES raw_materials(material_id),
    FOREIGN KEY (origin_warehouse_id)    REFERENCES warehouses(warehouse_id)
);

-- ── 11. Shipment Tracking ──────────────────────────────────────
-- Houses the "live" transactional and spatial data for a shipment.
-- Supports the frontend map via 'current_lat' and 'current_lng'.
-- Extracted from shipment_orders to allow frequent updates without locking the master record.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE shipment_tracking (
    tracking_id      INT AUTO_INCREMENT PRIMARY KEY,
    order_id         INT NOT NULL,
    carrier_id       INT,
    route_id         INT,
    tracking_number  VARCHAR(100),
    current_location VARCHAR(200),
    current_lat      DECIMAL(9,6),
    current_lng      DECIMAL(9,6),
    status           ENUM('PENDING','IN_TRANSIT','CUSTOMS','DELIVERED','DELAYED','AT_RISK'),
    eta              DATETIME,
    progress_pct     INT DEFAULT 0,
    last_updated     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES shipment_orders(order_id),
    FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
    FOREIGN KEY (route_id)   REFERENCES routes(route_id)
);

-- ── 12. Temperature Logs ───────────────────────────────────────
-- Emulates an IoT sensor stream inside a cold chain container.
-- Tracks 'is_excursion' to immediately spot if the temp violated safe zones.
-- Uses compound INDEXing (order_id, recorded_at) to dramatically speed up 
-- the frequent timeline queries required by the frontend charts.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE temperature_logs (
    log_id              INT AUTO_INCREMENT PRIMARY KEY,
    order_id            INT NOT NULL,
    sensor_id           VARCHAR(50) DEFAULT 'MANUAL',
    recorded_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    temperature_celsius DECIMAL(5,2) NOT NULL,
    location            VARCHAR(200),
    is_excursion        BOOLEAN DEFAULT FALSE,
    excursion_notes     TEXT,
    INDEX idx_order_time (order_id, recorded_at),
    INDEX idx_excursions (is_excursion, recorded_at),
    FOREIGN KEY (order_id) REFERENCES shipment_orders(order_id)
);

-- ── 13. Compliance Documents ───────────────────────────────────
-- Metadata tracking for physically uploaded pdfs/images tied to shipments.
-- Expiry dates tie into the system-wide CRON compliance checker.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE compliance_documents (
    doc_id      INT AUTO_INCREMENT PRIMARY KEY,
    order_id    INT NOT NULL,
    doc_type    VARCHAR(100),
    issuing_body VARCHAR(100),
    file_path   VARCHAR(500),
    issued_date DATE,
    expiry_date DATE,
    status      ENUM('VALID','EXPIRING','EXPIRED','PENDING') DEFAULT 'PENDING',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES shipment_orders(order_id)
);

-- ── 14. Alerts ─────────────────────────────────────────────────
-- Centralised Notification engine.
-- Instead of hardcoding alerts in code, backend drops records here.
-- The frontend polls or receives socket events for these records.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE alerts (
    alert_id    INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT,
    order_id    INT,
    alert_type  ENUM('TEMP_EXCURSION','DELAY','COMPLIANCE','INVENTORY','CARRIER') NOT NULL,
    severity    ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
    message     TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (order_id)  REFERENCES shipment_orders(order_id)
);

-- ── 15. Audit Log ──────────────────────────────────────────────
-- Provides a crucial security and compliance trail (who did what, when).
-- Stores state snapshots using JSON fields.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    tenant_id   INT,
    action      VARCHAR(200) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   INT,
    old_value   JSON,
    new_value   JSON,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ── Views (Virtual Tables for complex reads) ───────────────────
-- Views abstract complex JOIN operations so the Node.js API can query 
-- them cleanly as if they were standard flat tables.
-- 
-- 1. v_tenant_shipments: Aggregates everything needed to show a shipment row.
-- 2. v_low_inventory: Contains business logic (CASE WHEN) to dynamically calculate stock risk.
-- 3. v_expiring_compliance: Instantly finds docs expiring in next 14 days globally.
-- ───────────────────────────────────────────────────────────────
CREATE VIEW v_tenant_shipments AS
SELECT so.order_id, so.tenant_id, t.company_name, rm.material_name, rm.sku,
       so.quantity_ordered, so.temp_zone, so.status, so.urgency,
       so.estimated_cost_usd, so.risk_score, so.required_by_date,
       so.notes, so.created_at, st.current_location, st.progress_pct,
       st.eta, st.tracking_number, st.current_lat, st.current_lng,
       c.carrier_name, c.transport_mode,
       w.name AS origin_warehouse, w.city AS origin_city,
       w.latitude AS origin_lat, w.longitude AS origin_lng,
       so.dest_city, so.dest_country
FROM shipment_orders so
JOIN tenants t        ON so.tenant_id             = t.tenant_id
JOIN raw_materials rm ON so.material_id           = rm.material_id
LEFT JOIN shipment_tracking st ON so.order_id     = st.order_id
LEFT JOIN carriers c           ON st.carrier_id   = c.carrier_id
LEFT JOIN warehouses w         ON so.origin_warehouse_id = w.warehouse_id;

CREATE VIEW v_low_inventory AS
SELECT i.inventory_id, rm.material_id, rm.material_name, rm.sku, rm.temp_zone,
       i.quantity_on_hand, i.reorder_threshold, w.name AS warehouse_name, w.city,
       CASE WHEN i.quantity_on_hand=0                          THEN 'CRITICAL'
            WHEN i.quantity_on_hand < i.reorder_threshold      THEN 'LOW'
            WHEN i.quantity_on_hand < i.reorder_threshold*1.5  THEN 'WATCH'
            ELSE 'OK' END AS stock_status
FROM inventory i
JOIN raw_materials rm ON i.material_id  = rm.material_id
JOIN warehouses w     ON i.warehouse_id = w.warehouse_id;

CREATE VIEW v_expiring_compliance AS
SELECT cd.*, so.tenant_id, t.company_name,
       DATEDIFF(cd.expiry_date, CURDATE()) AS days_until_expiry
FROM compliance_documents cd
JOIN shipment_orders so ON cd.order_id  = so.order_id
JOIN tenants t          ON so.tenant_id = t.tenant_id
WHERE cd.expiry_date IS NOT NULL
  AND cd.expiry_date > CURDATE()
  AND DATEDIFF(cd.expiry_date, CURDATE()) <= 14;

-- ================================================================
--  FIRST LOGIN ACCOUNT
--
--  Email:    admin@cryochain.io
--  Password: Admin@1234
--
--  Log in → go to System Setup → add everything from the UI.
--  To change this password, generate a new hash:
--  node -e "const b=require('bcryptjs');console.log(b.hashSync('YourPassword',10))"
-- ================================================================
INSERT INTO users (tenant_id, email, password_hash, full_name, role)
VALUES (NULL, 'admin@cryochain.io', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'ops_admin');

-- ================================================================
--  AFTER LOGGING IN, ADD EVERYTHING THROUGH THE UI:
--
--  System Setup → Client Companies  → add your pharma clients
--  System Setup → Users             → add ops staff + client logins
--  System Setup → Materials         → add certified raw materials
--  System Setup → Warehouses        → add storage hubs
--  System Setup → Carriers          → add shipping companies
--  System Setup → Routes            → add shipping routes
--
--  Then the rest of the app works automatically:
--  Procurement → Shipments → Temperature → Compliance → Alerts
-- ================================================================
