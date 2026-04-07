// ================================================================
//  src/api.js — Every server call in one place
//  Import: import api from "./api"
//  Use:    const data = await api.orders.getAll()
// ================================================================
import axios from "axios";

// One Axios instance pointing at the Express server
const server = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5001",
  timeout: 20000
});

// Attach JWT token to every request automatically
server.interceptors.request.use(config => {
  const token = localStorage.getItem("cryo_token");
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});

// If token expires, clear storage and go to login
server.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem("cryo_token");
      localStorage.removeItem("cryo_user");
      window.location.href = "/";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const auth = {
  login: async (email, password) => {
    const res = await server.post("/api/auth/login", { email, password });
    localStorage.setItem("cryo_token", res.data.token);
    // Align with server's flat response structure (token, role, name, tenant_id, user_id)
    localStorage.setItem("cryo_user", JSON.stringify({ 
      name: res.data.name, 
      role: res.data.role, 
      tenant_id: res.data.tenant_id, 
      user_id: res.data.user_id 
    }));
    return res.data;
  },
  register: async (data) => (await server.post("/api/auth/register", data)).data,
  logout: () => { localStorage.removeItem("cryo_token"); localStorage.removeItem("cryo_user"); },
  getUser: () => { const u = localStorage.getItem("cryo_user"); return u ? JSON.parse(u) : null; }
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboard = {
  getOps:    async () => (await server.get("/api/dashboard/ops")).data,
  getClient: async () => (await server.get("/api/dashboard/client")).data
};

// ── Setup / Admin ─────────────────────────────────────────────
export const tenants = {
  getAll:  async ()     => (await server.get("/api/tenants")).data,
  create:  async (data) => (await server.post("/api/tenants", data)).data
};

export const users = {
  getAll:  async ()     => (await server.get("/api/users")).data,
  create:  async (data) => (await server.post("/api/users", data)).data
};

export const materials = {
  getAll:  async ()     => (await server.get("/api/materials")).data,
  create:  async (data) => (await server.post("/api/materials", data)).data
};

export const warehouses = {
  getAll:  async ()     => (await server.get("/api/warehouses")).data,
  create:  async (data) => (await server.post("/api/warehouses", data)).data
};

export const carriers = {
  getAll:  async ()     => (await server.get("/api/carriers")).data,
  create:  async (data) => (await server.post("/api/carriers", data)).data
};

export const routes = {
  getAll:   async ()              => (await server.get("/api/routes")).data,
  create:   async (data)          => (await server.post("/api/routes", data)).data,
   evaluate: async (data) => (await server.post("/api/routes/evaluate", data)).data
};

// ── Procurement ───────────────────────────────────────────────
export const procurement = {
  getAll:  async ()                         => (await server.get("/api/procurement")).data,
  submit:  async (data)                     => (await server.post("/api/procurement", data)).data,
  review:  async (id, status, review_notes, origin_warehouse_id) => (await server.patch(`/api/procurement/${id}/review`, { status, review_notes, origin_warehouse_id })).data
};

// ── Shipments ─────────────────────────────────────────────────
export const orders = {
  getAll:       async ()         => (await server.get("/api/orders")).data,
  create:       async (data)     => (await server.post("/api/orders", data)).data,
  updateStatus: async (id, data) => (await server.patch(`/api/orders/${id}/status`, data)).data,
  downloadPdf:  async (id)       => {
    const res = await server.get(`/api/orders/${id}/pdf`, { responseType: "blob" });
    window.open(URL.createObjectURL(res.data), "_blank");
  }
};

// ── Temperature ───────────────────────────────────────────────
export const temperature = {
  getByShipment: async (id)   => (await server.get(`/api/temperature/${id}`)).data,
  logReading:    async (data) => (await server.post("/api/temperature", data)).data
};

// ── Inventory ─────────────────────────────────────────────────
export const inventory = {
  getAll:         async ()     => (await server.get("/api/inventory")).data,
  adjust:         async (data) => (await server.post("/api/inventory/adjust", data)).data,
  restockAlerts:  async ()     => (await server.get("/api/inventory/restock-alerts")).data
};

// ── Compliance ────────────────────────────────────────────────
export const compliance = {
  getByShipment: async (id)       => (await server.get(`/api/compliance/${id}`)).data,
  upload:        async (formData) => (await server.post("/api/compliance/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })).data
};

// ── Alerts ────────────────────────────────────────────────────
export const alerts = {
  getAll:  async ()   => (await server.get("/api/alerts")).data,
  resolve: async (id) => (await server.patch(`/api/alerts/${id}/resolve`)).data
};

// Default export — use as api.orders.getAll() etc.
export default { auth, dashboard, tenants, users, materials, warehouses, carriers, routes, procurement, orders, temperature, inventory, compliance, alerts };
