# ❄️ CryoChain v2
**Real-Time Cold Chain Supply & Logistics Platform**

CryoChain is an advanced, full-stack web application built for managing multi-tenant cold chain logistics, automated raw material procurement, and real-time shipment monitoring. It was architected defensively to manage temperature-sensitive pharmaceutical and biological logistics while strictly maintaining data isolation across multiple client domains. 

Built as a comprehensive Database Management Systems (DBMS) project.

---

## 🌟 Key Features

*   **⚡ Real-Time Operations Tower:** Ops dashboards receive live Socket.io updates for GPS tracking, temperature excursions, and low stock thresholds.
*   **🛡️ Multi-Tenant Architecture:** Strict SQL isolation ensures client companies log into their own workspaces, viewing only their proprietary supply chains and invoices.
*   **🗺️ Dynamic Fleet Tracking:** Live GPS coordination using React-Leaflet. Visual maps render dynamically animated, translucent status dots overlapping based on `lat`/`lng` coordinates—color-changing automatically based on real-time routing status.
*   **⚖️ Algorithmic Route Evaluation:** An internal ranking engine evaluates route viability based on shipment urgency (Critical/Economy), mandatory cold-chain parameters (e.g., -70°C limits flights only), base costs, and carrier capacity.
*   **🤖 Automated CRON Pipelines:** Background Node processes monitor daily compliance document expiry, automatically execute threshold-based material restocks, and simulate realistic carrier capacity bandwidths.
*   **📄 Automated Audit Generators:** Auto-generated structured PDF compliance reports mapping thermal logs, transport certificates, and carrier details.

---

## 🛠️ Technology Stack

**Frontend**
*   React 18
*   React-Leaflet Map
*   Axios

**Backend**
*   Node.js & Express.js
*   Socket.io (WebSockets)
*   JWT Auth + Bcryptjs
*   Joi Validation
*   PDFKit (Report Generation)
*   Node-Cron

**Database Engine**
*   MySQL 
*   *Highlights: Complex multi-table joins, optimized SQL Views (`v_tenant_shipments`, `v_low_inventory`), relational integrity matching, and robust entity constraints.*

---

## 🚀 Local Setup & Installation

### 1. Database Configuration
1. Ensure MySQL is running on your local machine.
2. Log into MySQL and run the architectural schema file to build the system:
```bash
mysql -u root -p < database/schema.sql
```

### 2. Backend Environment (Server)
1. Open a terminal and navigate to the `server` directory.
2. Install dependencies:
```bash
npm install
```
3. Set your environment variables (create a `.env` file):
```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=cryochain
DB_PORT=3306
JWT_SECRET=super_secret_dev_key
```
4. Start the Express server:
```bash
node server.js
```

### 3. Frontend Environment (Client)
1. Open a new terminal and navigate to the `client` directory.
2. Install dependencies:
```bash
npm install
```
3. Boot the React development server:
```bash
npm start
```

---

## 🔐 System Access / Demo
For presentation ease, an isolated "Emergency Bypass" is active. You can log into the central operational command tower immediately using the master credentials:
* **Email:** `admin@cryochain.io`
* **Password:** `Admin@1234`

From this Ops dashboard, you can define Client Tenant organizations, inject verified inventory hubs, and execute procurement shipments securely across the platform.
