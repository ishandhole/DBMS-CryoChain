// ================================================================
//  src/hooks.js — Reusable React Custom Hooks
//
//  React "Hooks" allow us to extract component logic into reusable functions.
//  This keeps our React components clean, focused on UI, and prevents
//  copy-pasting the same fetching/loading/error logic everywhere.
// ================================================================
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import { auth } from "./api";

// ── useFetch: Auto-loader Hook ──────────────────────────────────
// Used for HTTP GET requests. Automatically runs the provided API function
// when the component mounts. Manages internal state for the data, a loading
// boolean (to show spinners), and an error string.
// Usage: const { data, loading, error, refetch } = useFetch(api.orders.getAll)
// ────────────────────────────────────────────────────────────────
export function useFetch(fn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fn()); }
    catch (e) { setError(e.response?.data?.error || e.message || "Something went wrong"); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
}

// ── useSubmit: Mutation Hook ────────────────────────────────────
// Used for HTTP POST/PATCH/DELETE requests. Unlike useFetch, this doesn't
// run automatically. It gives the component a `run` trigger function to 
// call when a user clicks a button or submits a form. Includes advanced
// error unpacking (gracefully handling Joi validation errors from the server).
// ────────────────────────────────────────────────────────────────
export function useSubmit(fn) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(false);

  const run = async (...args) => {
    setLoading(true); setError(null); setSuccess(false);
    try {
      const result = await fn(...args);
      setSuccess(true);
      return result;
    } catch (e) {
      // ── ADVANCED ERROR UNPACKING ───────────────────────────────────
      // If the Node.js backend throws a 400 error because of Joi validation
      // (e.g., { details: ["\"email\" must be a valid email"] }), we try to 
      // extract that deeply nested array and join it into a human-readable string.
      // If `details` doesn't exist, we fall back to a generic API error message.
      const msg = e.response?.data?.details?.join(", ") || e.response?.data?.error || e.message || "Request failed";
      setError(msg);
      throw e;
    } finally { setLoading(false); }
  };

  return { run, loading, error, success, clearError: () => setError(null) };
}

// ── useAuth: Session Manager ────────────────────────────────────
// Extracts security and routing logic. Provides boolean flags (isOps, isClient)
// that the App.jsx router uses to determine which dashboards the user is allowed to see.
// ────────────────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState(() => auth.getUser());

  const login = async (email, password) => {
    const res = await auth.login(email, password);
    setUser({ name: res.name, role: res.role, tenant_id: res.tenant_id, user_id: res.user_id });
    return res;
  };

  const logout = () => { auth.logout(); setUser(null); };

  const isOps    = ["ops_admin","ops_staff"].includes(user?.role);
  const isClient = ["client_admin","client_user"].includes(user?.role);
  const isAdmin  = user?.role === "ops_admin";

  return { user, login, logout, isOps, isClient, isAdmin };
}

// ── useSocket: Real-Time Engine ─────────────────────────────────
// Establishes a persistent WebSocket connection to the Node.js backend.
// Joins specific encrypted 'rooms' based on the user's role/tenant ID.
// Whenever the server emits an "alert" event, this hook catches it
// and prepends it to the `liveAlerts` array, rendering the top banner instantly.
// ────────────────────────────────────────────────────────────────
export function useSocket(user) {
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [connected,  setConnected]  = useState(false);
  const sockRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const sock = io(process.env.REACT_APP_API_URL || "http://localhost:5000");
    sockRef.current = sock;

    sock.on("connect",    () => {
      setConnected(true);
      if (["ops_admin","ops_staff"].includes(user.role)) sock.emit("join_ops");
      else if (user.tenant_id) sock.emit("join_tenant", user.tenant_id);
    });
    sock.on("disconnect", () => setConnected(false));
    sock.on("alert",      data => {
      setLiveAlerts(prev => [{ ...data, id: Date.now(), time: new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }) }, ...prev].slice(0, 20));
    });

    return () => sock.disconnect();
  }, [user]);

  return { liveAlerts, connected, dismissAlert: () => setLiveAlerts(p => p.slice(1)), clearAlerts: () => setLiveAlerts([]) };
}

// ── useForm: Controlled Inputs Hook ─────────────────────────────
// React requires inputs to be "controlled" (bound to state). This hook
// eliminates the boilerplate of writing `onChange` handlers for every single input field.
// Usage: <input value={form.email} onChange={set("email")} />
// ────────────────────────────────────────────────────────────────
export function useForm(initial) {
  const [form, setForm] = useState(initial);
  const set   = field => e => setForm(p => ({ ...p, [field]: e.target.value }));
  const reset = ()     => setForm(initial);
  const patch = obj    => setForm(p => ({ ...p, ...obj }));
  return { form, set, reset, patch, setForm };
}

// ── useToast: Notification System ───────────────────────────────
// Manages the array of floating success/error messages at the bottom right.
// Automatically filters them out after 4000ms (4 seconds).
// ────────────────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, []);

  const success = msg => show(msg, "success");
  const error   = msg => show(msg, "error");
  const info    = msg => show(msg, "info");

  return { toasts, success, error, info };
}
