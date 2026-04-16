-- ================================================================
--  CryoChain — Complete MySQL Database Schema
--  Run once:  mysql -u root -p < database/schema.sql
-- ================================================================
-- ================================================================
--  SECTION 1 — CREATE DATABASE (DDL)
-- ================================================================

DROP DATABASE IF EXISTS cryochain;
CREATE DATABASE cryochain;
USE cryochain;


-- ================================================================
--  SECTION 2 — CREATE TABLES WITH CONSTRAINTS 
-- ================================================================

-- ── Table 1: tenants ────────────────────────────────────────
-- Stores each pharmaceutical client company using the platform.
CREATE TABLE tenants (
    tenant_id    INT           AUTO_INCREMENT PRIMARY KEY,  
    company_name VARCHAR(150)  NOT NULL,                  
    country      VARCHAR(100),
    plan_type    ENUM('Standard','Enterprise') DEFAULT 'Standard',  
    status       ENUM('ACTIVE','SUSPENDED','INACTIVE') DEFAULT 'ACTIVE',
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP   
);

-- ── Table 2: users ──────────────────────────────────────────
-- Stores login accounts for both ops team and client users.
CREATE TABLE users (
    user_id       INT          AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT,                                     
    email         VARCHAR(200) NOT NULL UNIQUE,             
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150),
    role          ENUM('ops_admin','ops_staff','client_admin','client_user') NOT NULL,
    is_active     BOOLEAN      DEFAULT TRUE,
    last_login    TIMESTAMP    NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE SET NULL
    -- ON DELETE SET NULL: if a tenant is deleted, the user's tenant_id becomes NULL
);

-- ── Table 3: warehouses ─────────────────────────────────────
-- Cold-chain storage and dispatch hubs.
CREATE TABLE warehouses (
    warehouse_id INT          AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(150) NOT NULL,
    city         VARCHAR(100),
    country      VARCHAR(100),
    iata_code    VARCHAR(5),                                
    latitude     DECIMAL(9,6),                             
    longitude    DECIMAL(9,6),
    hub_status   ENUM('OPTIMAL','STRESSED','OFFLINE') DEFAULT 'OPTIMAL',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    -- CHECK constraint: latitude must be a valid geographic value
    CONSTRAINT chk_latitude  CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- ── Table 4: raw_materials ──────────────────────────────────
-- Certified pharmaceutical raw material catalog.
CREATE TABLE raw_materials (
    material_id     INT          AUTO_INCREMENT PRIMARY KEY,
    material_name   VARCHAR(200) NOT NULL,
    sku             VARCHAR(100) NOT NULL UNIQUE,           
    description     TEXT,
    temp_zone       ENUM('2_8C','minus20C','minus70C') NOT NULL,
    unit_of_measure VARCHAR(50),
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ── Table 5: material_certifications ────────────────────────
-- WHO, EMA, FDA certifications linked to each material.
CREATE TABLE material_certifications (
    cert_id       INT          AUTO_INCREMENT PRIMARY KEY,
    material_id   INT          NOT NULL,
    cert_body     VARCHAR(100) NOT NULL,                   
    cert_number   VARCHAR(100),
    cert_type     VARCHAR(100),
    issued_date   DATE,
    expiry_date   DATE,
    cert_status   ENUM('VALID','EXPIRING','EXPIRED') DEFAULT 'VALID',
    document_path VARCHAR(500),
    FOREIGN KEY (material_id) REFERENCES raw_materials(material_id) ON DELETE CASCADE,
    -- ON DELETE CASCADE: if a material is deleted, its certs are also deleted
    -- CHECK constraint: expiry must be after issue date
    CONSTRAINT chk_cert_dates CHECK (expiry_date > issued_date)
);

-- ── Table 6: inventory ──────────────────────────────────────
-- Tracks stock quantity per material per warehouse.
CREATE TABLE inventory (
    inventory_id      INT           AUTO_INCREMENT PRIMARY KEY,
    material_id       INT           NOT NULL,
    warehouse_id      INT           NOT NULL,
    quantity_on_hand  DECIMAL(12,2) DEFAULT 0,
    reorder_threshold DECIMAL(12,2) DEFAULT 0,
    last_updated      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- UNIQUE composite key: one row per material-warehouse pair
    UNIQUE KEY uq_mat_wh (material_id, warehouse_id),
    FOREIGN KEY (material_id)  REFERENCES raw_materials(material_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id),
    -- CHECK constraint: stock and threshold cannot be negative
    CONSTRAINT chk_qty_positive       CHECK (quantity_on_hand  >= 0),
    CONSTRAINT chk_threshold_positive CHECK (reorder_threshold >= 0)
);

-- ── Table 7: carriers ───────────────────────────────────────
-- Shipping companies (air, sea, road, rail).
CREATE TABLE carriers (
    carrier_id     INT          AUTO_INCREMENT PRIMARY KEY,
    carrier_name   VARCHAR(150) NOT NULL,
    transport_mode ENUM('AIR','SEA','ROAD','RAIL') NOT NULL,
    certifications VARCHAR(300),
    capacity_pct   INT          DEFAULT 100,
    contact_email  VARCHAR(200),
    is_active      BOOLEAN      DEFAULT TRUE,
    -- CHECK constraint: capacity must be between 0 and 100 percent
    CONSTRAINT chk_capacity CHECK (capacity_pct BETWEEN 0 AND 100)
);

-- ── Table 8: routes ─────────────────────────────────────────
-- Available shipping routes between cities/warehouses.
CREATE TABLE routes (
    route_id            INT           AUTO_INCREMENT PRIMARY KEY,
    origin_warehouse_id INT,
    origin_city         VARCHAR(100),
    dest_city           VARCHAR(100),
    carrier_id          INT,
    transport_mode      ENUM('AIR','SEA','ROAD','RAIL'),
    estimated_hours     INT,
    base_cost_usd       DECIMAL(10,2),
    risk_score          DECIMAL(3,2)  DEFAULT 0.10,
    is_active           BOOLEAN       DEFAULT TRUE,
    FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(warehouse_id),
    FOREIGN KEY (carrier_id)          REFERENCES carriers(carrier_id),
    -- CHECK constraints on valid ranges
    CONSTRAINT chk_hours_positive CHECK (estimated_hours > 0),
    CONSTRAINT chk_cost_positive  CHECK (base_cost_usd  > 0),
    CONSTRAINT chk_risk_range     CHECK (risk_score BETWEEN 0.00 AND 1.00)
);

-- ── Table 9: procurement_requests ──────────────────────────
-- Clients submit material requests; ops team reviews and approves.
CREATE TABLE procurement_requests (
    request_id         INT           AUTO_INCREMENT PRIMARY KEY,
    tenant_id          INT           NOT NULL,
    requested_by       INT           NOT NULL,
    material_id        INT           NOT NULL,
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
    FOREIGN KEY (reviewed_by)  REFERENCES users(user_id),
    -- CHECK: quantity must be positive
    CONSTRAINT chk_qty_requested CHECK (quantity_requested > 0)
);

-- ── Table 10: shipment_orders ───────────────────────────────
-- Created by ops or auto-created when a procurement is approved.
CREATE TABLE shipment_orders (
    order_id               INT           AUTO_INCREMENT PRIMARY KEY,
    tenant_id              INT           NOT NULL,
    created_by_user_id     INT           NOT NULL,
    procurement_request_id INT,
    material_id            INT           NOT NULL,
    quantity_ordered       DECIMAL(12,2) NOT NULL,
    origin_warehouse_id    INT,
    dest_city              VARCHAR(150),
    dest_country           VARCHAR(100),
    temp_zone              ENUM('2_8C','minus20C','minus70C') NOT NULL,
    urgency                ENUM('CRITICAL','STANDARD','ECONOMY') DEFAULT 'STANDARD',
    required_by_date       DATE,
    status                 ENUM('PENDING','APPROVED','ALLOCATED','DISPATCHED',
                                'IN_TRANSIT','AT_RISK','DELIVERED','CANCELLED') DEFAULT 'PENDING',
    estimated_cost_usd     DECIMAL(10,2),
    risk_score             DECIMAL(3,2),
    notes                  TEXT,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id)              REFERENCES tenants(tenant_id),
    FOREIGN KEY (created_by_user_id)     REFERENCES users(user_id),
    FOREIGN KEY (procurement_request_id) REFERENCES procurement_requests(request_id),
    FOREIGN KEY (material_id)            REFERENCES raw_materials(material_id),
    FOREIGN KEY (origin_warehouse_id)    REFERENCES warehouses(warehouse_id),
    CONSTRAINT chk_order_qty CHECK (quantity_ordered > 0)
);

-- ── Table 11: shipment_tracking ─────────────────────────────
-- Live GPS position and status per shipment checkpoint.
CREATE TABLE shipment_tracking (
    tracking_id      INT          AUTO_INCREMENT PRIMARY KEY,
    order_id         INT          NOT NULL,
    carrier_id       INT,
    route_id         INT,
    tracking_number  VARCHAR(100),
    current_location VARCHAR(200),
    current_lat      DECIMAL(9,6),
    current_lng      DECIMAL(9,6),
    status           ENUM('PENDING','IN_TRANSIT','CUSTOMS','DELIVERED','DELAYED','AT_RISK'),
    eta              DATETIME,
    progress_pct     INT          DEFAULT 0,
    last_updated     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES shipment_orders(order_id),
    FOREIGN KEY (carrier_id) REFERENCES carriers(carrier_id),
    FOREIGN KEY (route_id)   REFERENCES routes(route_id),
    CONSTRAINT chk_progress CHECK (progress_pct BETWEEN 0 AND 100)
);

-- ── Table 12: temperature_logs ──────────────────────────────
-- Every IoT or manual temperature reading for a shipment.
CREATE TABLE temperature_logs (
    log_id              INT          AUTO_INCREMENT PRIMARY KEY,
    order_id            INT          NOT NULL,
    sensor_id           VARCHAR(50)  DEFAULT 'MANUAL',
    recorded_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    temperature_celsius DECIMAL(5,2) NOT NULL,
    location            VARCHAR(200),
    is_excursion        BOOLEAN      DEFAULT FALSE,
    excursion_notes     TEXT,
    FOREIGN KEY (order_id) REFERENCES shipment_orders(order_id),
    -- CHECK: temperature must be a physically possible value
    CONSTRAINT chk_temp_range CHECK (temperature_celsius BETWEEN -100 AND 50)
);

-- ── Table 13: compliance_documents ─────────────────────────
-- Regulatory compliance PDFs attached to shipments.
CREATE TABLE compliance_documents (
    doc_id       INT          AUTO_INCREMENT PRIMARY KEY,
    order_id     INT          NOT NULL,
    doc_type     VARCHAR(100),
    issuing_body VARCHAR(100),
    file_path    VARCHAR(500),
    issued_date  DATE,
    expiry_date  DATE,
    status       ENUM('VALID','EXPIRING','EXPIRED','PENDING') DEFAULT 'PENDING',
    uploaded_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES shipment_orders(order_id)
);

-- ── Table 14: alerts ────────────────────────────────────────
-- System-generated alerts for excursions, low stock, expiring docs.
CREATE TABLE alerts (
    alert_id    INT       AUTO_INCREMENT PRIMARY KEY,
    tenant_id   INT,
    order_id    INT,
    alert_type  ENUM('TEMP_EXCURSION','DELAY','COMPLIANCE','INVENTORY','CARRIER') NOT NULL,
    severity    ENUM('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'MEDIUM',
    message     TEXT      NOT NULL,
    is_resolved BOOLEAN   DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
    FOREIGN KEY (order_id)  REFERENCES shipment_orders(order_id)
);

-- ── Table 15: audit_log ─────────────────────────────────────
-- Immutable record of every significant action in the system.
-- Never UPDATE or DELETE from this table.
CREATE TABLE audit_log (
    log_id      INT          AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    tenant_id   INT,
    action      VARCHAR(200) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   INT,
    old_value   JSON,
    new_value   JSON,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);


-- ================================================================
--  SECTION 3 — ALTER TABLE 
-- ================================================================

-- ADD a new column to an existing table
ALTER TABLE tenants
    ADD COLUMN contact_email VARCHAR(200);

-- ADD a column with a CHECK constraint
ALTER TABLE carriers
    ADD COLUMN rating DECIMAL(3,2) DEFAULT 5.00;

ALTER TABLE carriers
    ADD CONSTRAINT chk_rating CHECK (rating BETWEEN 0.00 AND 5.00);

-- MODIFY a column's data type (make it wider)
ALTER TABLE warehouses
    MODIFY COLUMN name VARCHAR(200) NOT NULL;

-- ADD a new column to track who last updated a carrier's details
ALTER TABLE carriers
    ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;


-- ================================================================
--  SECTION 4 — INDEXES 
-- ================================================================

-- Single-column index on shipment status
-- When the app queries "WHERE status = 'IN_TRANSIT'", this index is used.
CREATE INDEX idx_orders_status
    ON shipment_orders (status);

-- Single-column index on tenant_id in shipment_orders
-- Multi-tenant filtering (WHERE tenant_id = ?) is very frequent.
CREATE INDEX idx_orders_tenant
    ON shipment_orders (tenant_id);

-- Composite index on order_id + recorded_at in temperature_logs
-- Used by "WHERE order_id = ? ORDER BY recorded_at DESC"
CREATE INDEX idx_temp_order_time
    ON temperature_logs (order_id, recorded_at);

-- Index on excursion flag in temperature_logs
-- Used by dashboard query: "WHERE is_excursion = 1 AND recorded_at > ..."
CREATE INDEX idx_temp_excursions
    ON temperature_logs (is_excursion, recorded_at);

-- Index on material SKU for fast catalog search
CREATE INDEX idx_materials_sku
    ON raw_materials (sku);

-- Index on alerts for fast unresolved alert lookup
CREATE INDEX idx_alerts_resolved
    ON alerts (is_resolved, created_at);

-- Composite index on inventory for fast stock lookup
CREATE INDEX idx_inventory_lookup
    ON inventory (material_id, warehouse_id);

-- Index on procurement status for ops dashboard
CREATE INDEX idx_procurement_status
    ON procurement_requests (status, tenant_id);


-- ================================================================
--  SECTION 5 — VIEWS 
-- ================================================================

-- View 1: Full shipment summary joining 5 tables
-- Uses INNER JOIN (tenant, material) and LEFT JOIN (tracking, carrier, warehouse)
CREATE OR REPLACE VIEW v_tenant_shipments AS
SELECT
    so.order_id,
    so.tenant_id,
    t.company_name,
    rm.material_name,
    rm.sku,
    so.quantity_ordered,
    so.temp_zone,
    so.status,
    so.urgency,
    so.estimated_cost_usd,
    so.risk_score,
    so.required_by_date,
    so.notes,
    so.created_at,
    st.current_location,
    st.progress_pct,
    st.eta,
    st.tracking_number,
    st.current_lat,
    st.current_lng,
    c.carrier_name,
    c.transport_mode,
    w.name         AS origin_warehouse,
    w.city         AS origin_city,
    w.latitude     AS origin_lat,
    w.longitude    AS origin_lng,
    so.dest_city,
    so.dest_country
FROM shipment_orders so
    INNER JOIN tenants       t  ON so.tenant_id            = t.tenant_id
    INNER JOIN raw_materials rm ON so.material_id          = rm.material_id
    LEFT JOIN  shipment_tracking st ON so.order_id         = st.order_id
    LEFT JOIN  carriers          c  ON st.carrier_id       = c.carrier_id
    LEFT JOIN  warehouses        w  ON so.origin_warehouse_id = w.warehouse_id;


-- View 2: Low inventory alert view
-- Uses CASE WHEN expression and INNER JOIN
CREATE OR REPLACE VIEW v_low_inventory AS
SELECT
    i.inventory_id,
    rm.material_id,
    rm.material_name,
    rm.sku,
    rm.temp_zone,
    i.quantity_on_hand,
    i.reorder_threshold,
    w.name AS warehouse_name,
    w.city,
    -- CASE expression: categorises stock level
    CASE
        WHEN i.quantity_on_hand = 0                          THEN 'CRITICAL'
        WHEN i.quantity_on_hand < i.reorder_threshold        THEN 'LOW'
        WHEN i.quantity_on_hand < i.reorder_threshold * 1.5  THEN 'WATCH'
        ELSE 'OK'
    END AS stock_status
FROM inventory i
    INNER JOIN raw_materials rm ON i.material_id  = rm.material_id
    INNER JOIN warehouses    w  ON i.warehouse_id = w.warehouse_id;


-- View 3: Compliance documents expiring within 14 days
-- Used by the daily cron job (node-cron) in server.js
CREATE OR REPLACE VIEW v_expiring_compliance AS
SELECT
    cd.doc_id,
    cd.order_id,
    cd.doc_type,
    cd.issuing_body,
    cd.file_path,
    cd.issued_date,
    cd.expiry_date,
    cd.status,
    cd.uploaded_at,
    so.tenant_id,
    t.company_name,
    DATEDIFF(cd.expiry_date, CURDATE()) AS days_until_expiry
FROM compliance_documents cd
    INNER JOIN shipment_orders so ON cd.order_id  = so.order_id
    INNER JOIN tenants         t  ON so.tenant_id = t.tenant_id
WHERE cd.expiry_date IS NOT NULL
  AND cd.expiry_date > CURDATE()
  AND DATEDIFF(cd.expiry_date, CURDATE()) <= 14;


-- View 4: Active shipments per tenant with carrier info
-- Used for the client dashboard and live map
CREATE OR REPLACE VIEW v_active_shipments AS
SELECT
    so.order_id,
    so.tenant_id,
    t.company_name,
    so.status,
    so.temp_zone,
    so.dest_city,
    so.dest_country,
    so.urgency,
    st.current_location,
    st.current_lat,
    st.current_lng,
    st.progress_pct,
    st.eta,
    c.carrier_name,
    c.transport_mode
FROM shipment_orders so
    INNER JOIN tenants t ON so.tenant_id = t.tenant_id
    LEFT JOIN  shipment_tracking st ON so.order_id   = st.order_id
    LEFT JOIN  carriers          c  ON st.carrier_id = c.carrier_id
WHERE so.status IN ('IN_TRANSIT', 'AT_RISK', 'DISPATCHED');


-- ================================================================
--  SECTION 6 — USEFUL QUERIES DEMONSTRATING ALL DBMS CONCEPTS
--
--  These are ready-to-run queries you can test in MySQL Workbench
--  or the command line. They cover every experiment topic.
-- ================================================================

-- ── DML: INSERT (Exp 3) ──────────────────────────────────────
-- First login account — one ops admin to start with
INSERT INTO users (tenant_id, email, password_hash, full_name, role)
VALUES (NULL, 'admin@cryochain.io',
        '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        'System Admin', 'ops_admin');
-- Password is Admin@1234 (bcrypt hash — never store plain text)



