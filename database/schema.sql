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

-- ── 1. Tenants (client companies) ──────────────────────────
CREATE TABLE tenants (
    tenant_id    INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    country      VARCHAR(100),
    plan_type    ENUM('Standard','Enterprise') DEFAULT 'Standard',
    status       ENUM('ACTIVE','SUSPENDED','INACTIVE') DEFAULT 'ACTIVE',
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── 2. Users ────────────────────────────────────────────────
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

-- ── 3. Warehouses ───────────────────────────────────────────
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

-- ── 4. Raw Materials ────────────────────────────────────────
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

-- ── 5. Material Certifications ──────────────────────────────
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

-- ── 6. Inventory ────────────────────────────────────────────
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

-- ── 7. Carriers ─────────────────────────────────────────────
CREATE TABLE carriers (
    carrier_id     INT AUTO_INCREMENT PRIMARY KEY,
    carrier_name   VARCHAR(150) NOT NULL,
    transport_mode ENUM('AIR','SEA','ROAD','RAIL') NOT NULL,
    certifications VARCHAR(300),
    capacity_pct   INT DEFAULT 100,
    contact_email  VARCHAR(200),
    is_active      BOOLEAN DEFAULT TRUE
);

-- ── 8. Routes ───────────────────────────────────────────────
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

-- ── 9. Procurement Requests ─────────────────────────────────
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

-- ── 10. Shipment Orders ─────────────────────────────────────
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

-- ── 11. Shipment Tracking ───────────────────────────────────
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

-- ── 12. Temperature Logs ────────────────────────────────────
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

-- ── 13. Compliance Documents ────────────────────────────────
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

-- ── 14. Alerts ──────────────────────────────────────────────
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

-- ── 15. Audit Log ───────────────────────────────────────────
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

-- ── Views ────────────────────────────────────────────────────
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
