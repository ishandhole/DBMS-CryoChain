-- ================================================================
--  CryoChain v2 — Complete MySQL Database Schema
--
--  This file demonstrates ALL SQL concepts covered in DBMS lab:
--
--  Exp 2  → DDL: CREATE, ALTER, DROP, TRUNCATE, constraints
--  Exp 3  → DML: INSERT, UPDATE, DELETE, SELECT
--  Exp 5  → WHERE with AND, OR, NOT, IN, BETWEEN, LIKE
--  Exp 6  → ORDER BY, INNER JOIN, LEFT/RIGHT/FULL OUTER JOIN
--  Exp 7  → GROUP BY, HAVING, aggregate functions (COUNT, SUM,
--             AVG, MIN, MAX), subqueries, UNION/UNION ALL, VIEWS
--  Exp 9  → Indexes (CREATE INDEX, composite, unique indexes)
--  Exp 10 → TCL (COMMIT, ROLLBACK, SAVEPOINT), DCL (GRANT, REVOKE)
--
--  Run once:  mysql -u root -p < database/schema.sql
-- ================================================================

-- ================================================================
--  SECTION 1 — CREATE DATABASE (DDL)
--  Exp 2: CREATE is a DDL command. It defines database structure.
-- ================================================================

DROP DATABASE IF EXISTS cryochain;
CREATE DATABASE cryochain;
USE cryochain;


-- ================================================================
--  SECTION 2 — CREATE TABLES WITH CONSTRAINTS (DDL — Exp 2)
--
--  Constraints demonstrated:
--    PRIMARY KEY  — uniquely identifies each row
--    FOREIGN KEY  — links tables, enforces referential integrity
--    NOT NULL     — column must always have a value
--    UNIQUE       — no two rows can have the same value
--    DEFAULT      — value used when no value is provided
--    CHECK        — validates data before it is inserted (Exp 2)
--    ENUM         — a built-in CHECK that limits allowed values
-- ================================================================

-- ── Table 1: tenants ────────────────────────────────────────
-- Stores each pharmaceutical client company using the platform.
CREATE TABLE tenants (
    tenant_id    INT           AUTO_INCREMENT PRIMARY KEY,  -- PK: unique ID per company
    company_name VARCHAR(150)  NOT NULL,                   -- NOT NULL: name is mandatory
    country      VARCHAR(100),
    plan_type    ENUM('Standard','Enterprise') DEFAULT 'Standard',  -- ENUM acts as CHECK
    status       ENUM('ACTIVE','SUSPENDED','INACTIVE') DEFAULT 'ACTIVE',
    created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP   -- DEFAULT: auto-filled
);

-- ── Table 2: users ──────────────────────────────────────────
-- Stores login accounts for both ops team and client users.
CREATE TABLE users (
    user_id       INT          AUTO_INCREMENT PRIMARY KEY,
    tenant_id     INT,                                      -- NULL allowed: ops staff have no tenant
    email         VARCHAR(200) NOT NULL UNIQUE,             -- UNIQUE: no two users share an email
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
    iata_code    VARCHAR(5),                                -- Airport code, optional
    latitude     DECIMAL(9,6),                             -- GPS coordinates for live map
    longitude    DECIMAL(9,6),
    hub_status   ENUM('OPTIMAL','STRESSED','OFFLINE') DEFAULT 'OPTIMAL',
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    -- CHECK constraint (Exp 2): latitude must be a valid geographic value
    CONSTRAINT chk_latitude  CHECK (latitude  BETWEEN -90  AND 90),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180)
);

-- ── Table 4: raw_materials ──────────────────────────────────
-- Certified pharmaceutical raw material catalog.
CREATE TABLE raw_materials (
    material_id     INT          AUTO_INCREMENT PRIMARY KEY,
    material_name   VARCHAR(200) NOT NULL,
    sku             VARCHAR(100) NOT NULL UNIQUE,           -- UNIQUE: no duplicate SKUs
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
    cert_body     VARCHAR(100) NOT NULL,                   -- e.g. WHO, EMA, FDA
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
--  SECTION 3 — ALTER TABLE (DDL — Exp 2)
--
--  ALTER is used to change table structure AFTER it is created.
--  It can ADD, MODIFY, or DROP columns and constraints.
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
--  SECTION 4 — INDEXES (Exp 9)
--
--  Indexes speed up SELECT queries on frequently searched columns.
--  Without an index, MySQL does a full table scan (reads every row).
--  With an index, it jumps directly to the matching rows.
--
--  Types used here:
--    Single-column index   — speeds up queries filtering on one column
--    Composite index       — speeds up queries filtering on two columns together
--    Unique index          — enforces uniqueness AND speeds up lookup
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
--  SECTION 5 — VIEWS (Exp 7)
--
--  A VIEW is a saved SELECT query. It looks like a table but
--  stores no data itself — it fetches from the real tables each
--  time it is queried. Views simplify complex joins.
--
--  Joins used in views (Exp 6):
--    INNER JOIN  — only rows with a match in BOTH tables
--    LEFT JOIN   — all rows from the left table, NULLs for no match
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


-- ================================================================
--  SECTION 7 — SAMPLE ANALYTICAL QUERIES
--  (Run these after adding data through the UI to see results)
-- ================================================================

-- ── Exp 3: Basic SELECT, UPDATE, DELETE ──────────────────────

-- SELECT all active users
-- SELECT * FROM users WHERE is_active = TRUE;

-- SELECT specific columns with a condition
-- SELECT full_name, email, role FROM users WHERE role = 'ops_admin';

-- UPDATE: mark a carrier as inactive
-- UPDATE carriers SET is_active = FALSE WHERE carrier_id = 1;

-- DELETE: remove a resolved alert
-- DELETE FROM alerts WHERE is_resolved = 1 AND resolved_at < NOW() - INTERVAL 30 DAY;


-- ── Exp 5: WHERE with AND, OR, NOT, IN, BETWEEN, LIKE ────────

-- AND: shipments that are critical AND at risk
-- SELECT * FROM shipment_orders
-- WHERE urgency = 'CRITICAL' AND status = 'AT_RISK';

-- OR: shipments that are in transit OR at risk
-- SELECT * FROM shipment_orders
-- WHERE status = 'IN_TRANSIT' OR status = 'AT_RISK';

-- NOT: all shipments that are NOT delivered or cancelled
-- SELECT * FROM shipment_orders
-- WHERE status NOT IN ('DELIVERED', 'CANCELLED');

-- IN: shipments for specific urgency levels
-- SELECT order_id, dest_city, urgency FROM shipment_orders
-- WHERE urgency IN ('CRITICAL', 'STANDARD');

-- BETWEEN: temperature logs recorded in a date range
-- SELECT * FROM temperature_logs
-- WHERE recorded_at BETWEEN '2025-01-01' AND '2025-12-31';

-- BETWEEN: inventory with stock between two values
-- SELECT material_id, quantity_on_hand FROM inventory
-- WHERE quantity_on_hand BETWEEN 100 AND 500;

-- LIKE with % wildcard: find companies whose name starts with 'Bio'
-- SELECT * FROM tenants WHERE company_name LIKE 'Bio%';

-- LIKE with _ wildcard: find warehouses with a 3-letter IATA code matching _U_
-- SELECT name, iata_code FROM warehouses WHERE iata_code LIKE '_U_';

-- IS NULL: find shipments with no carrier assigned yet
-- SELECT order_id, status FROM shipment_orders
-- WHERE origin_warehouse_id IS NULL;


-- ── Exp 6: ORDER BY, JOINS ────────────────────────────────────

-- ORDER BY ASC (ascending): cheapest routes first
-- SELECT origin_city, dest_city, base_cost_usd, transport_mode
-- FROM routes
-- ORDER BY base_cost_usd ASC;

-- ORDER BY DESC (descending): most recent shipments first
-- SELECT order_id, dest_city, status, created_at
-- FROM shipment_orders
-- ORDER BY created_at DESC;

-- ORDER BY multiple columns: sort by status then by cost
-- SELECT order_id, status, estimated_cost_usd
-- FROM shipment_orders
-- ORDER BY status ASC, estimated_cost_usd DESC;

-- INNER JOIN: show shipments with their client company name
-- SELECT so.order_id, t.company_name, so.status, so.dest_city
-- FROM shipment_orders so
-- INNER JOIN tenants t ON so.tenant_id = t.tenant_id;

-- LEFT OUTER JOIN: show all materials even if they have no inventory yet
-- SELECT rm.material_name, rm.sku, i.quantity_on_hand, w.name AS warehouse
-- FROM raw_materials rm
-- LEFT JOIN inventory i   ON rm.material_id  = i.material_id
-- LEFT JOIN warehouses w  ON i.warehouse_id  = w.warehouse_id;

-- RIGHT OUTER JOIN: all warehouses even if no inventory stored there
-- SELECT w.name AS warehouse, w.city, rm.material_name, i.quantity_on_hand
-- FROM inventory i
-- RIGHT JOIN warehouses w ON i.warehouse_id = w.warehouse_id
-- LEFT  JOIN raw_materials rm ON i.material_id = rm.material_id;

-- Multi-table JOIN: shipment with material, client, and carrier
-- SELECT so.order_id, t.company_name, rm.material_name,
--        so.quantity_ordered, c.carrier_name, so.status
-- FROM shipment_orders so
-- INNER JOIN tenants       t  ON so.tenant_id    = t.tenant_id
-- INNER JOIN raw_materials rm ON so.material_id  = rm.material_id
-- LEFT JOIN  shipment_tracking st ON so.order_id = st.order_id
-- LEFT JOIN  carriers c ON st.carrier_id         = c.carrier_id
-- ORDER BY so.created_at DESC;


-- ── Exp 7: Aggregate Functions ───────────────────────────────

-- COUNT: total number of shipments
-- SELECT COUNT(*) AS total_shipments FROM shipment_orders;

-- COUNT with condition: how many shipments are currently in transit
-- SELECT COUNT(*) AS in_transit_count
-- FROM shipment_orders
-- WHERE status = 'IN_TRANSIT';

-- SUM: total value of all shipments
-- SELECT SUM(estimated_cost_usd) AS total_value FROM shipment_orders;

-- AVG: average cost per shipment
-- SELECT AVG(estimated_cost_usd) AS average_cost FROM shipment_orders;

-- MIN and MAX: cheapest and most expensive shipment
-- SELECT MIN(estimated_cost_usd) AS cheapest,
--        MAX(estimated_cost_usd) AS most_expensive
-- FROM shipment_orders;

-- MIN and MAX together with difference (like Exp 7 example)
-- SELECT MAX(estimated_cost_usd) - MIN(estimated_cost_usd) AS cost_range
-- FROM shipment_orders;

-- COUNT excursions in the last 24 hours
-- SELECT COUNT(*) AS excursions_24h
-- FROM temperature_logs
-- WHERE is_excursion = 1
--   AND recorded_at > NOW() - INTERVAL 24 HOUR;


-- ── Exp 7: GROUP BY and HAVING ───────────────────────────────

-- GROUP BY: count shipments per client (each tenant)
-- SELECT t.company_name, COUNT(so.order_id) AS shipment_count
-- FROM shipment_orders so
-- INNER JOIN tenants t ON so.tenant_id = t.tenant_id
-- GROUP BY t.company_name
-- ORDER BY shipment_count DESC;

-- GROUP BY: total quantity shipped per material
-- SELECT rm.material_name, SUM(so.quantity_ordered) AS total_shipped
-- FROM shipment_orders so
-- INNER JOIN raw_materials rm ON so.material_id = rm.material_id
-- GROUP BY rm.material_name;

-- GROUP BY: count shipments by status
-- SELECT status, COUNT(*) AS count
-- FROM shipment_orders
-- GROUP BY status
-- ORDER BY count DESC;

-- GROUP BY + HAVING: only show clients with more than 5 shipments
-- SELECT t.company_name, COUNT(so.order_id) AS shipment_count
-- FROM shipment_orders so
-- INNER JOIN tenants t ON so.tenant_id = t.tenant_id
-- GROUP BY t.company_name
-- HAVING COUNT(so.order_id) > 5;

-- GROUP BY + HAVING: warehouses with total stock below 500 units
-- SELECT w.name, SUM(i.quantity_on_hand) AS total_stock
-- FROM inventory i
-- INNER JOIN warehouses w ON i.warehouse_id = w.warehouse_id
-- GROUP BY w.name
-- HAVING SUM(i.quantity_on_hand) < 500;

-- GROUP BY + AVG: average temperature per shipment
-- SELECT order_id, AVG(temperature_celsius) AS avg_temp,
--        MIN(temperature_celsius) AS min_temp,
--        MAX(temperature_celsius) AS max_temp
-- FROM temperature_logs
-- GROUP BY order_id;

-- GROUP BY + COUNT: number of excursions per shipment
-- SELECT order_id, COUNT(*) AS excursion_count
-- FROM temperature_logs
-- WHERE is_excursion = 1
-- GROUP BY order_id
-- HAVING COUNT(*) > 0
-- ORDER BY excursion_count DESC;


-- ── Exp 7: Subqueries / Nested Queries ───────────────────────

-- Subquery: find clients who have NEVER placed a shipment
-- (equivalent to Exp 7 Q1a pattern: distributors who never supplied)
-- SELECT company_name FROM tenants
-- WHERE tenant_id NOT IN (
--     SELECT DISTINCT tenant_id FROM shipment_orders
-- );

-- Subquery: find materials that have NEVER been shipped
-- SELECT material_name, sku FROM raw_materials
-- WHERE material_id NOT IN (
--     SELECT DISTINCT material_id FROM shipment_orders
-- );

-- Subquery in WHERE: find all shipments costing more than the average
-- SELECT order_id, dest_city, estimated_cost_usd
-- FROM shipment_orders
-- WHERE estimated_cost_usd > (
--     SELECT AVG(estimated_cost_usd) FROM shipment_orders
-- );

-- Correlated subquery: for each tenant, find their most expensive shipment
-- SELECT t.company_name, so.order_id, so.estimated_cost_usd
-- FROM shipment_orders so
-- INNER JOIN tenants t ON so.tenant_id = t.tenant_id
-- WHERE so.estimated_cost_usd = (
--     SELECT MAX(s2.estimated_cost_usd)
--     FROM shipment_orders s2
--     WHERE s2.tenant_id = so.tenant_id
-- );

-- Subquery: find all at-risk shipments and their last temperature reading
-- SELECT so.order_id, t.company_name,
--        (SELECT temperature_celsius FROM temperature_logs tl
--         WHERE tl.order_id = so.order_id
--         ORDER BY recorded_at DESC LIMIT 1) AS latest_temp
-- FROM shipment_orders so
-- INNER JOIN tenants t ON so.tenant_id = t.tenant_id
-- WHERE so.status = 'AT_RISK';


-- ── Exp 7: SET Operations — UNION and UNION ALL ───────────────

-- UNION: list all cities that are either an origin or a destination
-- (UNION removes duplicates — a city appearing in both lists appears once)
-- SELECT origin_city AS city FROM routes  WHERE origin_city IS NOT NULL
-- UNION
-- SELECT dest_city   AS city FROM routes  WHERE dest_city IS NOT NULL
-- ORDER BY city;

-- UNION ALL: same but keeps duplicates
-- (shows how many times each city appears across both columns)
-- SELECT origin_city AS city FROM routes WHERE origin_city IS NOT NULL
-- UNION ALL
-- SELECT dest_city   AS city FROM routes WHERE dest_city IS NOT NULL
-- ORDER BY city;

-- UNION: show all critical issues (excursions + critical alerts)
-- SELECT 'EXCURSION' AS issue_type, CAST(order_id AS CHAR) AS ref_id,
--        location AS detail, recorded_at AS issue_time
-- FROM temperature_logs
-- WHERE is_excursion = 1
-- UNION
-- SELECT 'ALERT' AS issue_type, CAST(alert_id AS CHAR) AS ref_id,
--        severity AS detail, created_at AS issue_time
-- FROM alerts
-- WHERE severity = 'CRITICAL' AND is_resolved = 0
-- ORDER BY issue_time DESC;


-- ================================================================
--  SECTION 8 — TRANSACTION CONTROL LANGUAGE / TCL (Exp 10)
--
--  TCL commands manage transactions. A transaction is a group of
--  DML statements (INSERT/UPDATE/DELETE) treated as ONE unit.
--  Either ALL succeed (COMMIT) or ALL are undone (ROLLBACK).
--
--  TCL works ONLY with DML. DDL commands like CREATE and DROP
--  are auto-committed and cannot be rolled back.
-- ================================================================

-- Example: Safe shipment status update using TCL
-- (Run in MySQL Workbench or CLI — not in this file directly)

-- START TRANSACTION;
--
--     -- Step 1: Update the shipment status
--     UPDATE shipment_orders
--     SET status = 'IN_TRANSIT', updated_at = NOW()
--     WHERE order_id = 1;
--
--     -- Step 2: Create a SAVEPOINT before inserting the audit log
--     SAVEPOINT before_audit;
--
--     -- Step 3: Insert audit log entry
--     INSERT INTO audit_log (user_id, tenant_id, action, entity_type, entity_id)
--     VALUES (1, 1, 'SHIPMENT_DISPATCHED', 'shipment_orders', 1);
--
--     -- If the audit log insert fails, roll back ONLY to the savepoint
--     -- (the shipment status update is still intact)
--     -- ROLLBACK TO SAVEPOINT before_audit;
--
--     -- Step 4: Update tracking position
--     UPDATE shipment_tracking
--     SET status = 'IN_TRANSIT', progress_pct = 10,
--         current_location = 'Mumbai Airport', last_updated = NOW()
--     WHERE order_id = 1;
--
-- -- If everything succeeded, commit all changes permanently
-- COMMIT;
--
-- -- If anything went wrong anywhere, undo everything
-- -- ROLLBACK;


-- TCL Example 2: Inventory adjustment with rollback on error
-- START TRANSACTION;
--
--     SAVEPOINT start_adjustment;
--
--     -- Deduct stock from warehouse
--     UPDATE inventory
--     SET quantity_on_hand = quantity_on_hand - 200
--     WHERE material_id = 1 AND warehouse_id = 1;
--
--     -- Check if stock went negative (business rule)
--     -- If quantity_on_hand < 0, rollback
--     -- ROLLBACK TO SAVEPOINT start_adjustment;
--
--     -- Otherwise commit
-- COMMIT;


-- ================================================================
--  SECTION 9 — DATA CONTROL LANGUAGE / DCL (Exp 10)
--
--  DCL commands control WHO can do WHAT in the database.
--  GRANT gives permissions. REVOKE removes them.
--  This is essential in a multi-user pharmaceutical system where
--  different users should see different data.
-- ================================================================

-- First create separate MySQL database users for each role
-- (Run as root in MySQL CLI)

-- CREATE USER 'cryo_ops'@'localhost'      IDENTIFIED BY 'OpsSecurePass#1';
-- CREATE USER 'cryo_client'@'localhost'   IDENTIFIED BY 'ClientSecurePass#2';
-- CREATE USER 'cryo_readonly'@'localhost' IDENTIFIED BY 'ReadOnlyPass#3';

-- GRANT: give ops team full access to all tables
-- GRANT SELECT, INSERT, UPDATE, DELETE ON cryochain.* TO 'cryo_ops'@'localhost';

-- GRANT: give client users access only to their own relevant tables
-- (They should NOT see other tenants' data — enforced at app level too)
-- GRANT SELECT ON cryochain.shipment_orders     TO 'cryo_client'@'localhost';
-- GRANT SELECT ON cryochain.procurement_requests TO 'cryo_client'@'localhost';
-- GRANT SELECT ON cryochain.temperature_logs    TO 'cryo_client'@'localhost';
-- GRANT SELECT ON cryochain.compliance_documents TO 'cryo_client'@'localhost';
-- GRANT SELECT ON cryochain.alerts              TO 'cryo_client'@'localhost';
-- GRANT INSERT ON cryochain.procurement_requests TO 'cryo_client'@'localhost';

-- GRANT: give a read-only reporting user SELECT access only
-- GRANT SELECT ON cryochain.* TO 'cryo_readonly'@'localhost';

-- GRANT: give access to a specific view only (extra security)
-- GRANT SELECT ON cryochain.v_low_inventory TO 'cryo_readonly'@'localhost';

-- Apply the grants immediately
-- FLUSH PRIVILEGES;

-- REVOKE: remove INSERT permission from client user (read-only from now on)
-- REVOKE INSERT ON cryochain.procurement_requests FROM 'cryo_client'@'localhost';

-- REVOKE: remove ALL permissions from a user (e.g. when they leave)
-- REVOKE ALL PRIVILEGES ON cryochain.* FROM 'cryo_client'@'localhost';

-- Show current grants for a user
-- SHOW GRANTS FOR 'cryo_ops'@'localhost';


-- ================================================================
--  SECTION 10 — TRUNCATE (DDL — Exp 2)
--
--  TRUNCATE removes ALL rows from a table instantly.
--  Faster than DELETE because it does not log individual rows.
--  It CANNOT be rolled back (it is auto-committed like DDL).
--  The table structure is preserved.
-- ================================================================

-- WARNING: Only use TRUNCATE during development/testing.
-- TRUNCATE TABLE temperature_logs;   -- Removes ALL temperature readings
-- TRUNCATE TABLE alerts;             -- Removes ALL alerts

-- Safe way to truncate in MySQL (requires disabling foreign key checks):
-- SET FOREIGN_KEY_CHECKS = 0;
-- TRUNCATE TABLE audit_log;
-- TRUNCATE TABLE alerts;
-- TRUNCATE TABLE compliance_documents;
-- TRUNCATE TABLE temperature_logs;
-- TRUNCATE TABLE shipment_tracking;
-- TRUNCATE TABLE shipment_orders;
-- TRUNCATE TABLE procurement_requests;
-- TRUNCATE TABLE inventory;
-- SET FOREIGN_KEY_CHECKS = 1;


-- ================================================================
--  SECTION 11 — REMOVE INDEX (Exp 9)
--
--  Indexes use disk space. If a column is rarely searched,
--  the index wastes space. Use ALTER TABLE to remove it.
-- ================================================================

-- Syntax to remove an index (Exp 9):
-- ALTER TABLE temperature_logs DROP INDEX idx_temp_excursions;
-- ALTER TABLE shipment_orders  DROP INDEX idx_orders_status;

-- To check existing indexes on a table:
-- SHOW INDEX FROM shipment_orders;
-- SHOW INDEX FROM temperature_logs;


-- ================================================================
--  FIRST LOGIN
--
--  Email:    admin@cryochain.io
--  Password: Admin@1234
--
--  After logging in, go to System Setup and add:
--  Client companies → Users → Materials → Warehouses → Carriers → Routes
--  Then Procurement → Shipments → Temperature → Compliance will all work.
-- ================================================================
