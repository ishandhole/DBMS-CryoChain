// ================================================================
//  src/App.jsx — CryoChain UI  (Inter font · clean dark theme)
//  All data live from MySQL. Zero hardcoded values.
//  New: Toast system · Search · Admin Setup page · Empty states
// ================================================================
import { useState, useRef, useEffect } from "react";
import * as api from "./api";
import { useFetch, useSubmit, useAuth, useSocket, useForm, useToast } from "./hooks";

// ── Design Tokens ─────────────────────────────────────────────
const C = {
  bg:      "#09090b",
  surface: "#18181b",
  card:    "#1c1c22",
  border:  "#2e2e38",
  blue:    "#3b82f6",
  green:   "#22c55e",
  red:     "#ef4444",
  amber:   "#f59e0b",
  purple:  "#a855f7",
  cyan:    "#06b6d4",
  text:    "#f4f4f5",
  muted:   "#a1a1aa",
  dim:     "#52525b",
};

// ── Helpers ───────────────────────────────────────────────────
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "—";
const fmtNum  = n => n != null ? Number(n).toLocaleString() : "—";

const TEMP_LABEL = { "2_8C":"2–8°C", "minus20C":"−20°C", "minus70C":"−70°C" };
const TEMP_COL   = { "2_8C": C.green, "minus20C": C.blue, "minus70C": C.purple };
const TEMP_RANGE = { "2_8C": {min:2,max:8}, "minus20C": {min:-22,max:-18}, "minus70C": {min:-70,max:-65} };

const STATUS_COL = { IN_TRANSIT:C.blue, AT_RISK:C.red, DELIVERED:C.green, PENDING:C.dim, APPROVED:C.amber, REJECTED:C.red, UNDER_REVIEW:C.amber, ALLOCATED:C.purple, DISPATCHED:C.amber, FULFILLED:C.green, CANCELLED:C.dim };
const STOCK_COL  = { OK:C.green, LOW:C.amber, CRITICAL:C.red, WATCH:C.amber };

// ── Shared UI Components ──────────────────────────────────────

function Badge({ label, colour }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, background:(colour||C.blue)+"20", color:colour||C.blue, border:`1px solid ${(colour||C.blue)}40`, whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, cursor:onClick?"pointer":undefined, transition:"border-color .2s", ...style }}
      onMouseEnter={onClick ? e => e.currentTarget.style.borderColor=C.blue : undefined}
      onMouseLeave={onClick ? e => e.currentTarget.style.borderColor=C.border : undefined}>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, colour, icon, onClick }) {
  return (
    <Card onClick={onClick}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:".06em", textTransform:"uppercase", marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:700, color:colour||C.text, lineHeight:1.1 }}>{value ?? 0}</div>
          {sub && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>{sub}</div>}
        </div>
        <div style={{ fontSize:26, opacity:.6, background: (colour||C.text)+"15", width:48, height:48, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>{icon}</div>
      </div>
    </Card>
  );
}

function Btn({ children, onClick, variant="ghost", disabled, style, type="button" }) {
  const vars = {
    primary: { background:C.blue,   color:"#fff",    border:"none" },
    success: { background:C.green,  color:"#fff",    border:"none" },
    danger:  { background:C.red,    color:"#fff",    border:"none" },
    outline: { background:"transparent", color:C.blue,   border:`1px solid ${C.blue}55` },
    amber:   { background:"transparent", color:C.amber,  border:`1px solid ${C.amber}55` },
    ghost:   { background:"transparent", color:C.muted,  border:`1px solid ${C.border}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:500, cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit", opacity:disabled?.5:1, transition:"opacity .15s, transform .1s", display:"flex", alignItems:"center", gap:6, ...vars[variant], ...style }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform="scale(.97)")}
      onMouseUp={e   => e.currentTarget.style.transform="scale(1)"}
      onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
      {children}
    </button>
  );
}

function Inp({ label, hint, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <div style={{ fontSize:12, color:C.muted, marginBottom:5, fontWeight:500 }}>{label}</div>}
      <input {...props} style={{ background:"#111117", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:13, fontFamily:"inherit", width:"100%", boxSizing:"border-box", outline:"none", transition:"border-color .2s", ...props.style }}
        onFocus={e => e.target.style.borderColor=C.blue}
        onBlur={e  => e.target.style.borderColor=C.border} />
      {hint && <div style={{ fontSize:11, color:C.dim, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function Sel({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <div style={{ fontSize:12, color:C.muted, marginBottom:5, fontWeight:500 }}>{label}</div>}
      <select {...props} style={{ background:"#111117", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:13, fontFamily:"inherit", width:"100%", boxSizing:"border-box", outline:"none" }}>
        {children}
      </select>
    </div>
  );
}

function Textarea({ label, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <div style={{ fontSize:12, color:C.muted, marginBottom:5, fontWeight:500 }}>{label}</div>}
      <textarea {...props} rows={3} style={{ background:"#111117", border:`1px solid ${C.border}`, borderRadius:8, padding:"10px 12px", color:C.text, fontSize:13, fontFamily:"inherit", width:"100%", boxSizing:"border-box", outline:"none", resize:"vertical" }}
        onFocus={e => e.target.style.borderColor=C.blue}
        onBlur={e  => e.target.style.borderColor=C.border} />
    </div>
  );
}

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ background:C.red+"15", border:`1px solid ${C.red}40`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red, marginBottom:14 }}>⚠ {msg}</div>;
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const handler = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", backdropFilter:"blur(4px)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:28, width:wide?740:560, maxHeight:"88vh", overflowY:"auto", boxSizing:"border-box" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{title}</div>
          <Btn onClick={onClose}>✕ Close</Btn>
        </div>
        {children}
      </div>
    </div>
  );
}

function Search({ value, onChange, placeholder }) {
  return (
    <div style={{ position:"relative", minWidth:220 }}>
      <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:C.muted, fontSize:14 }}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder||"Search..."}
        style={{ background:"#111117", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px 8px 32px", color:C.text, fontSize:13, fontFamily:"inherit", width:"100%", outline:"none", boxSizing:"border-box" }} />
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, color:C.muted, fontSize:11, fontWeight:600, textAlign:"left", letterSpacing:".08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{children}</th>;
}

function Td({ children, colour, style }) {
  return <td style={{ padding:"12px 14px", borderBottom:`1px solid ${C.border}18`, color:colour||C.text, fontSize:13, verticalAlign:"middle", ...style }}>{children}</td>;
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ textAlign:"center", padding:"56px 20px" }}>
      <div style={{ fontSize:42, marginBottom:12, opacity:.4 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:C.muted, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:C.dim }}>{desc}</div>
    </div>
  );
}

function LoadRows({ cols, rows=5 }) {
  return <>{Array.from({length:rows}).map((_,i) => <tr key={i}>{Array.from({length:cols}).map((_,j) => <td key={j} style={{padding:"12px 14px",borderBottom:`1px solid ${C.border}18`}}><div style={{height:14,borderRadius:4,background:C.border,width:(30+Math.random()*50)+"%",animation:"pulse 1.5s infinite"}}/></td>)}</tr>)}</>;
}

function SectionHead({ sub, title }) {
  return (
    <div style={{ marginBottom:24 }}>
      {sub && <div style={{ fontSize:11, color:C.muted, letterSpacing:".1em", textTransform:"uppercase", marginBottom:4 }}>{sub}</div>}
      <div style={{ fontSize:24, fontWeight:700, color:C.text }}>{title}</div>
    </div>
  );
}

function Grid({ cols=4, gap=14, children }) {
  return <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap, marginBottom:20 }}>{children}</div>;
}

function Table({ children }) {
  return <table style={{ width:"100%", borderCollapse:"collapse" }}>{children}</table>;
}

// ── Toast System ──────────────────────────────────────────────
function Toasts({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed", bottom:24, right:24, zIndex:2000, display:"flex", flexDirection:"column", gap:10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background:t.type==="error"?C.red:t.type==="info"?C.blue:C.green, color:"#fff", padding:"12px 18px", borderRadius:10, fontSize:13, fontWeight:500, minWidth:260, boxShadow:"0 4px 20px rgba(0,0,0,.4)", display:"flex", alignItems:"center", gap:10 }}>
          <span>{t.type==="error"?"✗":t.type==="info"?"ℹ":"✓"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Live Alert Banner ─────────────────────────────────────────
function AlertBanner({ alerts, onDismiss, onAction }) {
  if (!alerts.length) return null;
  const a   = alerts[0];
  const col = { TEMP_EXCURSION:C.red, COMPLIANCE:C.amber, APPROVED:C.green, INVENTORY:C.amber }[a.type] || C.blue;
  return (
    <div style={{ position:"fixed", top:56, left:0, right:0, zIndex:900, background:col+"14", borderBottom:`2px solid ${col}44`, padding:"9px 24px", display:"flex", alignItems:"center", gap:12, fontSize:13 }}>
      <span style={{ width:8, height:8, borderRadius:"50%", background:col, display:"block", flexShrink:0 }}/>
      <span style={{ fontSize:11, fontWeight:700, color:col, flexShrink:0 }}>LIVE · {(a.type||"ALERT").replace(/_/g," ")}</span>
      <span style={{ flex:1, color:C.text }}>{a.message}</span>
      {a.material_id && onAction && (
        <Btn variant="amber" style={{ fontSize:10, padding:"3px 8px", height:24 }} onClick={() => onAction(a)}>
          View in Inventory →
        </Btn>
      )}
      <span style={{ fontSize:11, color:C.muted }}>{a.time}</span>
      <button onClick={onDismiss} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16, lineHeight:1 }}>✕</button>
    </div>
  );
}

// ================================================================
//  PAGES
// ================================================================

// ── Login ─────────────────────────────────────────────────────
function LoginPage({ onLogin, onGoSignup }) {
  const { form, set } = useForm({ email:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function submit() {
    setError(""); setLoading(true);
    try { await onLogin(form.email, form.password); }
    catch (e) { setError(e.response?.data?.error || "Incorrect email or password"); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:420, padding:20 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, margin:"0 auto 14px" }}>❄</div>
          <div style={{ fontSize:22, fontWeight:800, letterSpacing:".04em", color:C.text }}>CryoChain</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Cold Chain Supply & Logistics</div>
        </div>

        <Card>
          <div style={{ fontSize:15, fontWeight:600, color:C.text, marginBottom:20 }}>Sign in to your account</div>
          <ErrBox msg={error} />
          <Inp label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com"
            onKeyDown={e => e.key==="Enter" && submit()} />
          <Inp label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••"
            onKeyDown={e => e.key==="Enter" && submit()} />
          <Btn variant="primary" onClick={submit} disabled={loading} style={{ width:"100%", justifyContent:"center", marginTop:8, padding:"11px 0" }}>
            {loading ? "Signing in..." : "Sign in →"}
          </Btn>
          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#71717a" }}>
            Need to onboard your firm?{" "}
            <span style={{ color: "#3b82f6", cursor: "pointer", fontWeight: 600 }} onClick={onGoSignup}>Create Account →</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function SignupPage({ onBackToLogin }) {
  const { form, set, reset } = useForm({ company_name: "", full_name: "", email: "", password: "" });
  const signupA = useSubmit(api.auth.register);
  const [done, setDone] = useState(false);

  async function handleSignup(e) {
    e.preventDefault();
    try {
      await signupA.run(form);
      setDone(true);
      reset();
    } catch {}
  }

  if (done) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
        <Card style={{ width: 400, padding: 32, border: `1px solid ${C.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.text }}>Account Created!</div>
          <div style={{ color: C.muted, marginBottom: 24, lineHeight: 1.6, fontSize:14 }}>Your company workspace is ready. You can now log in to manage your global shipments.</div>
          <Btn variant="primary" style={{ width: "100%" }} onClick={onBackToLogin}>Back to Login</Btn>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#09090b" }}>
      <Card style={{ width: 440, padding: 32, border: `1px solid ${C.border}`, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, cursor: "pointer", color: C.muted }} onClick={onBackToLogin}>
           <span>←</span> <span style={{fontSize:13}}>Back to login</span>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>Onboard New Company</div>
          <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Initialize your isolated cold chain environment</div>
        </div>
        <form onSubmit={handleSignup}>
          <Inp label="Company Name" value={form.company_name} onChange={set("company_name")} placeholder="e.g. Acme Global Pharma" required />
          <Inp label="Primary Admin Name" value={form.full_name} onChange={set("full_name")} placeholder="Full Name" required />
          <Inp label="Company Email" type="email" value={form.email} onChange={set("email")} placeholder="admin@company.com" required />
          <Inp label="Admin Password" type="password" value={form.password} onChange={set("password")} placeholder="Create secure password" required />
          <Btn variant="primary" type="submit" style={{ width: "100%", height: 44, marginTop: 12 }} disabled={signupA.loading}>
            {signupA.loading ? "Registering..." : "Initialize Workspace →"}
          </Btn>
          <ErrBox msg={signupA.error} />
        </form>
      </Card>
    </div>
  );
}

// ── Control Tower (Ops Dashboard) ────────────────────────────
function ControlTower({ user, setPage, connected, onStockAction }) {
  const { data, loading, refetch } = useFetch(api.dashboard.getOps);
  const [lastSync, setLastSync] = useState(new Date());

  // Auto-refresh every 5 seconds for real-time feel
  useEffect(() => {
    const t = setInterval(() => {
      refetch().then(() => setLastSync(new Date()));
    }, 5000);
    return () => clearInterval(t);
  }, [refetch]);

  const urgentTasks = (data?.at_risk || 0) + (data?.pending_procurement || 0) + (data?.low_inventory?.length || 0);

  return (
    <div style={{ animation: "fadeIn .4s ease-out" }}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      {/* Welcome Hero */}
      <div style={{ marginBottom:30, background:`linear-gradient(135deg, ${C.surface}, ${C.bg})`, padding:30, borderRadius:16, border:`1px solid ${C.border}`, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:-20, right:-20, fontSize:120, opacity:0.05, pointerEvents:"none" }}>⬡</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:13, color:C.blue, fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", marginBottom:8 }}>Operations Hub</div>
            <h1 style={{ fontSize:28, fontWeight:800, color:C.text, margin:0 }}>Welcome back, {user.name.split(" ")[0]}</h1>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:connected?C.green:C.red, fontWeight:600, display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:connected?C.green:C.red, display:"block" }}/>
              {connected ? "LIVE SYNC ACTIVE" : "OFFLINE"}
            </div>
            <div style={{ fontSize:10, color:C.dim, marginTop:4 }}>Last updated: {lastSync.toLocaleTimeString()}</div>
          </div>
        </div>
        <p style={{ fontSize:15, color:C.muted, marginTop:12, maxWidth:600, lineHeight:1.6 }}>
          You have <b style={{color:C.amber}}>{urgentTasks} urgent tasks</b> that require attention. 
          Real-time cold chain oversight is active across {(data?.active_shipments || 0) + (data?.delivered || 0)} total nodes.
        </p>
      </div>

      <SectionHead sub="Real-time Stream" title="Logistics Pipeline" />
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:24, marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:12, color:C.muted, fontWeight:600, textTransform:"uppercase" }}>Active Flow Stages</div>
          <div style={{ fontSize:11, color:C.dim }}>Data refreshes automatically</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
          <PipeStep label="Procurement" count={data?.pending_procurement} color={C.purple} icon="📋" active />
          <PipeConnector />
          <PipeStep label="Approved" count={data?.approved_needs_allocation} color={C.green} icon="✓" />
          <PipeConnector />
          <PipeStep label="Allocated" count={data?.allocated_needs_dispatch} color={C.blue} icon="▦" />
          <PipeConnector />
          <PipeStep label="In Transit" count={data?.active_shipments} color={C.amber} icon="◈" pulse />
          <PipeConnector />
          <PipeStep label="Delivered" count={data?.delivered} color={C.green} icon="🏁" />
        </div>
      </div>

      <Grid cols={4}>
        <KPI label="Active Shipments"    value={data?.active_shipments}    sub="Tracking live GPS"  colour={C.blue}   icon="◈" onClick={()=>setPage("map")}/>
        <KPI label="At Risk"             value={data?.at_risk}             sub="Breach proximity"    colour={C.red}    icon="⚠" onClick={()=>setPage("temperature")}/>
        <KPI label="Excursions (24h)"    value={data?.excursions_24h}      sub="Temp violations"     colour={C.amber}  icon="❄" onClick={()=>setPage("compliance")}/>
        <KPI label="Pending Tasks"       value={urgentTasks}               sub="Needs your review"   colour={C.purple} icon="📋" onClick={()=>setPage("procurement")}/>
      </Grid>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
        <div>
          <SectionHead sub="History" title="Recent Logistics Activity" />
          <Card style={{ padding:0, overflow:"hidden" }}>
            {loading ? (
              <div style={{padding:20}}><Table><tbody><LoadRows cols={5}/></tbody></Table></div>
            ) : !data?.recent_shipments?.length ? (
              <EmptyState icon="📦" title="No shipments yet" desc="Shipments will appear here once created." />
            ) : (
              <Table>
                <thead><tr><Th>Shipment ID</Th><Th>Client Company</Th><Th>Route / Dest</Th><Th>Status</Th><Th>Monitor</Th></tr></thead>
                <tbody>
                  {data.recent_shipments.map(s => (
                    <tr key={s.order_id} style={{ cursor:"pointer" }} onClick={()=>setPage("shipments")}>
                      <Td colour={C.blue} style={{ fontWeight:700 }}>SHP-{s.order_id}</Td>
                      <Td>{s.company_name}</Td>
                      <Td colour={C.muted}>✈ {s.dest_city}, {s.dest_country}</Td>
                      <Td><Badge label={s.status?.replace("_"," ")} colour={STATUS_COL[s.status]}/></Td>
                      <Td><Btn variant="outline" style={{fontSize:11,padding:"4px 10px"}} onClick={(e)=>{e.stopPropagation(); api.orders.downloadPdf(s.order_id)}}>View Audit</Btn></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <div style={{ padding:14, textAlign:"center", borderTop:`1px solid ${C.border}18`, background:C.border+"08" }}>
              <Btn variant="ghost" style={{ fontSize:11, width:"100%", justifyContent:"center" }} onClick={()=>setPage("shipments")}>View All Shipments →</Btn>
            </div>
          </Card>
        </div>

        <div>
          <SectionHead sub="Inventory" title="Action Center" />
          <Card style={{ background:C.amber+"08", borderColor:C.amber+"33", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.amber, marginBottom:12, display:"flex", alignItems:"center", gap:6 }}>
              <span>⚠</span> Low Stock Inventory
            </div>
            {!data?.low_inventory?.length ? (
              <div style={{ fontSize:12, color:C.muted }}>All material levels are currently optimal.</div>
            ) : (
              <div>
                {(data?.low_inventory||[]).slice(0,3).map((item,i) => (
                  <div key={i} style={{ marginBottom:10, paddingBottom:10, borderBottom:`1px solid ${C.amber}22`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{item.material_name}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{item.warehouse} · {fmtNum(item.quantity_on_hand)} left</div>
                    </div>
                    <Btn variant="ghost" style={{ fontSize:10, padding:"2px 6px", color:C.amber }} onClick={() => onStockAction && onStockAction(item)}>Fix stock →</Btn>
                  </div>
                ))}
                <Btn variant="amber" style={{ width:"100%", justifyContent:"center", fontSize:11, marginTop:6 }} onClick={()=>setPage("inventory")}>Resolve Stock Issues</Btn>
              </div>
            )}
          </Card>

          <Card>
            <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:15 }}>Quick Operations</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Btn variant="outline" style={{ width:"100%", justifyContent:"flex-start" }} onClick={()=>setPage("procurement")}>📋 Review Procurement</Btn>
              <Btn variant="outline" style={{ width:"100%", justifyContent:"flex-start" }} onClick={()=>setPage("map")}>🗺 Track Fleet Live</Btn>
              <Btn variant="outline" style={{ width:"100%", justifyContent:"flex-start" }} onClick={()=>setPage("temperature")}>❄ Thermal Compliance</Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PipeStep({ label, count, color, icon, pulse }) {
  return (
    <div style={{ flex:1, textAlign:"center", position:"relative" }}>
      <div style={{ 
        width:54, height:54, borderRadius:16, background:color+"15", color:color, 
        border:`2px solid ${color}33`, display:"flex", alignItems:"center", justifyContent:"center", 
        fontSize:22, margin:"0 auto 10px", position:"relative",
        animation: pulse ? "pulse 2s infinite" : "none"
      }}>
        {icon}
        {count > 0 && (
          <div style={{ position:"absolute", top:-6, right:-6, background:color, color:"#fff", fontSize:10, fontWeight:800, width:20, height:20, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", border:`2px solid ${C.bg}` }}>
            {count}
          </div>
        )}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{label}</div>
    </div>
  );
}

function PipeConnector() {
  return (
    <div style={{ flex:0.4, height:2, background:C.border, marginTop:-20, position:"relative" }}>
      <div style={{ position:"absolute", right:0, top:-4, borderTop:"5px solid transparent", borderBottom:"5px solid transparent", borderLeft:`8px solid ${C.border}` }} />
    </div>
  );
}

// ── Procurement ───────────────────────────────────────────────
function ProcurementPage({ isOps, toast, onUpdate }) {
  const { data, loading, error, refetch } = useFetch(api.procurement.getAll);
  const { data: mats }    = useFetch(api.materials.getAll);
  const { data: tenants } = useFetch(isOps ? api.tenants.getAll : () => Promise.resolve([]));
  const { data: whs }     = useFetch(isOps ? api.warehouses.getAll : () => Promise.resolve([]));
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState("ALL");
  const [showNew, setShowNew]         = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const { form, set, reset }          = useForm({ tenant_id:"", material_id:"", quantity_requested:"", temp_zone:"2_8C", urgency:"STANDARD", required_by_date:"", delivery_address:"", notes:"" });
  const { form: rf, set: rset, reset: rreset } = useForm({ review_notes:"" });
  const submitA = useSubmit(api.procurement.submit);
  const reviewA = useSubmit((id, status, notes, wh) => api.procurement.review(id, status, notes, wh));

  const rows = (data||[]).filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.material_name?.toLowerCase().includes(q) || p.company_name?.toLowerCase().includes(q);
    const matchFilter = filter === "ALL" || p.status === filter;
    return matchSearch && matchFilter;
  });

  async function doSubmit() {
    try {
      const payload = { ...form, quantity_requested: parseFloat(form.quantity_requested) };
      if (isOps && form.tenant_id) payload.tenant_id = parseInt(form.tenant_id);
      await submitA.run(payload);
      toast.success("Request submitted successfully");
      reset(); setShowNew(false); refetch(); if (onUpdate) onUpdate();
    } catch {}
  }

  async function doReview(status) {
    try {
      const res = await reviewA.run(reviewTarget.request_id, status, rf.review_notes, rf.origin_warehouse_id);
      toast.success(res.message || "Request " + status.toLowerCase());
      rreset(); setReviewTarget(null); refetch(); if (onUpdate) onUpdate();
    } catch {}
  }

  return (
    <div>
      <SectionHead sub="Sourcing" title="Procurement Requests" />
      <Grid cols={4}>
        {["PENDING","UNDER_REVIEW","APPROVED","REJECTED"].map(s => (
          <KPI key={s} label={s.replace("_"," ")} value={(data||[]).filter(p=>p.status===s).length} sub="requests" colour={STATUS_COL[s]} icon="📋"/>
        ))}
      </Grid>

      <Card>
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
          <Search value={search} onChange={setSearch} placeholder="Search by material or client..." />
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["ALL","PENDING","UNDER_REVIEW","APPROVED","REJECTED","FULFILLED"].map(s => (
              <Btn key={s} variant={filter===s?"outline":"ghost"} style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setFilter(s)}>{s.replace("_"," ")}</Btn>
            ))}
          </div>
          <div style={{flex:1}}/>
          <Btn variant="primary" onClick={()=>setShowNew(true)}>+ New Request</Btn>
        </div>

        <ErrBox msg={error} />
        <Table>
          <thead><tr><Th>ID</Th><Th>Client</Th><Th>Material</Th><Th>Qty</Th><Th>Temp</Th><Th>Urgency</Th><Th>Required By</Th><Th>Status</Th>{isOps&&<Th>Action</Th>}</tr></thead>
          <tbody>
            {loading ? <LoadRows cols={isOps?9:8}/> :
             !rows.length ? <tr><td colSpan={isOps?9:8}><EmptyState icon="📋" title="No requests found" desc="Adjust your search or filters." /></td></tr> :
             rows.map(p => (
              <tr key={p.request_id}>
                <Td colour={C.blue}>PRQ-{p.request_id}</Td>
                <Td>{p.company_name}</Td>
                <Td style={{fontWeight:600}}>{p.material_name}</Td>
                <Td colour={C.muted}>{fmtNum(p.quantity_requested)}</Td>
                <Td><Badge label={TEMP_LABEL[p.temp_zone]||p.temp_zone} colour={TEMP_COL[p.temp_zone]}/></Td>
                <Td><Badge label={p.urgency} colour={p.urgency==="CRITICAL"?C.red:p.urgency==="ECONOMY"?C.green:C.blue}/></Td>
                <Td colour={C.muted}>{fmtDate(p.required_by_date)}</Td>
                <Td><Badge label={p.status?.replace("_"," ")} colour={STATUS_COL[p.status]}/></Td>
                {isOps && <Td>{["PENDING","UNDER_REVIEW"].includes(p.status) && <Btn variant="outline" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setReviewTarget(p)}>Review →</Btn>}</Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {showNew && (
        <Modal title="New Procurement Request" onClose={()=>setShowNew(false)}>
          <ErrBox msg={submitA.error}/>
          {isOps && (
            <Sel label="Client Company" value={form.tenant_id} onChange={set("tenant_id")}>
              <option value="">— Select client company —</option>
              {(tenants||[]).map(t => <option key={t.tenant_id} value={t.tenant_id}>{t.company_name}</option>)}
            </Sel>
          )}
          <Sel label="Material" value={form.material_id} onChange={set("material_id")}>
            <option value="">— Select from certified catalog —</option>
            {(mats||[]).map(m => <option key={m.material_id} value={m.material_id}>{m.material_name} [{TEMP_LABEL[m.temp_zone]}] · {fmtNum(m.total_stock)} {m.unit_of_measure} available</option>)}
          </Sel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Quantity" type="number" value={form.quantity_requested} onChange={set("quantity_requested")} placeholder="e.g. 500"/>
            <Inp label="Required By Date" type="date" value={form.required_by_date} onChange={set("required_by_date")}/>
            <Sel label="Temperature Zone" value={form.temp_zone} onChange={set("temp_zone")}>
              <option value="2_8C">2–8°C (Refrigerated)</option>
              <option value="minus20C">−20°C (Frozen)</option>
              <option value="minus70C">−70°C (Deep Frozen)</option>
            </Sel>
            <Sel label="Urgency" value={form.urgency} onChange={set("urgency")}>
              <option value="CRITICAL">Critical — 24–48 hours</option>
              <option value="STANDARD">Standard — 3–5 days</option>
              <option value="ECONOMY">Economy — 7–14 days</option>
            </Sel>
          </div>
          <Inp label="Delivery Address" value={form.delivery_address} onChange={set("delivery_address")} placeholder="Full delivery address"/>
          <Textarea label="Notes (optional)" value={form.notes} onChange={set("notes")} placeholder="Special handling requirements..."/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>setShowNew(false)}>Cancel</Btn>
            <Btn variant="primary" disabled={submitA.loading} onClick={doSubmit}>{submitA.loading?"Submitting...":"Submit Request →"}</Btn>
          </div>
        </Modal>
      )}

      {reviewTarget && (
        <Modal title={`Review — PRQ-${reviewTarget.request_id}`} onClose={()=>setReviewTarget(null)}>
          <ErrBox msg={reviewA.error}/>
          <Card style={{marginBottom:16,background:C.surface}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
              {[["Client",reviewTarget.company_name],["Material",reviewTarget.material_name],["Quantity",fmtNum(reviewTarget.quantity_requested)],["Urgency",reviewTarget.urgency],["Required By",fmtDate(reviewTarget.required_by_date)],["Address",reviewTarget.delivery_address]].map(([k,v])=>(
                <div key={k}><span style={{color:C.muted}}>{k}: </span><span style={{fontWeight:600}}>{v}</span></div>
              ))}
            </div>
          </Card>
          
          <Sel label="Fulfilling Warehouse (Origin)" value={rf.origin_warehouse_id} onChange={rset("origin_warehouse_id")}>
             <option value="">— Select origin hub —</option>
             {(whs||[]).map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} ({w.city})</option>)}
          </Sel>

          <Textarea label="Review Notes" value={rf.review_notes} onChange={rset("review_notes")} placeholder="Approval details or rejection reason..."/>
          <div style={{fontSize:12,color:C.dim,marginBottom:14}}>On approval: a shipment order is auto-created and the client is notified instantly via socket.io.</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setReviewTarget(null)}>Cancel</Btn>
            <Btn variant="danger"  disabled={reviewA.loading} onClick={()=>doReview("REJECTED")}>✕ Reject</Btn>
            <Btn variant="amber"   disabled={reviewA.loading} onClick={()=>doReview("UNDER_REVIEW")}>⟳ Needs Info</Btn>
            <Btn variant="success" disabled={reviewA.loading} onClick={()=>doReview("APPROVED")}>{reviewA.loading?"Processing...":"✓ Approve"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shipments ─────────────────────────────────────────────────
function ShipmentsPage({ isOps, toast, onUpdate }) {
  const { data, loading, error, refetch } = useFetch(api.orders.getAll);
  const { data: tenants }   = useFetch(api.tenants.getAll);
  const { data: mats }      = useFetch(api.materials.getAll);
  const { data: warehouses} = useFetch(api.warehouses.getAll);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("ALL");
  const [updateT, setUpdateT] = useState(null);
  const [showCreate,setShowCreate]=useState(false);
  const { form:uf, set:uset, reset:ureset } = useForm({ status:"", current_location:"", current_lat:"", current_lng:"", revised_eta:"", checkpoint_notes:"" });
  const { form:cf, set:cset, reset:creset } = useForm({ tenant_id:"", material_id:"", quantity_ordered:"", origin_warehouse_id:"", dest_city:"", dest_country:"", temp_zone:"2_8C", urgency:"STANDARD", required_by_date:"", notes:"" });
  const updateA = useSubmit((id,d) => api.orders.updateStatus(id,d));
  const createA = useSubmit(api.orders.create);

  const rows = (data||[]).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.company_name?.toLowerCase().includes(q) || s.dest_city?.toLowerCase().includes(q) || String(s.order_id).includes(q);
    return matchSearch && (filter==="ALL" || s.status===filter);
  });

  async function doUpdate() {
    try {
      await updateA.run(updateT.order_id, { ...uf, current_lat:uf.current_lat?parseFloat(uf.current_lat):null, current_lng:uf.current_lng?parseFloat(uf.current_lng):null });
      toast.success("Shipment status updated");
      ureset(); setUpdateT(null); refetch(); if (onUpdate) onUpdate();
    } catch {}
  }

  async function doCreate() {
    try {
      const res = await createA.run({ ...cf, tenant_id:parseInt(cf.tenant_id), material_id:parseInt(cf.material_id), quantity_ordered:parseFloat(cf.quantity_ordered), origin_warehouse_id:cf.origin_warehouse_id?parseInt(cf.origin_warehouse_id):null });
      toast.success(res.message || "Shipment created");
      creset(); setShowCreate(false); refetch(); if (onUpdate) onUpdate();
    } catch {}
  }

  return (
    <div>
      <SectionHead sub="Logistics" title="Shipment Management"/>
      <Grid cols={3}>
        <KPI label="In Transit" value={(data||[]).filter(s=>s.status==="IN_TRANSIT").length}  sub="Moving now"    colour={C.blue}  icon="✈"/>
        <KPI label="At Risk"    value={(data||[]).filter(s=>s.status==="AT_RISK").length}      sub="Needs attention" colour={C.red}   icon="⚠"/>
        <KPI label="Delivered"  value={(data||[]).filter(s=>s.status==="DELIVERED").length}    sub="Completed"      colour={C.green} icon="✓"/>
      </Grid>

      <Card>
        <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <Search value={search} onChange={setSearch} placeholder="Search by client, destination, ID..."/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["ALL","IN_TRANSIT","AT_RISK","PENDING","DELIVERED","CANCELLED"].map(s=>(
              <Btn key={s} variant={filter===s?"outline":"ghost"} style={{fontSize:11,padding:"5px 10px"}} onClick={()=>setFilter(s)}>{s.replace("_"," ")}</Btn>
            ))}
          </div>
          <div style={{flex:1}}/>
          {isOps && <Btn variant="primary" onClick={()=>setShowCreate(true)}>+ Create Shipment</Btn>}
        </div>

        <ErrBox msg={error}/>
        <Table>
          <thead><tr><Th>ID</Th><Th>Client</Th><Th>Destination</Th><Th>Status</Th><Th>Temp</Th><Th>ETA</Th><Th>Cost</Th><Th>PDF</Th>{isOps&&<Th>Update</Th>}</tr></thead>
          <tbody>
            {loading ? <LoadRows cols={isOps?9:8}/> :
             !rows.length ? <tr><td colSpan={isOps?9:8}><EmptyState icon="📦" title="No shipments found" desc="Create a shipment or adjust your filters."/></td></tr> :
             rows.map(s=>(
              <tr key={s.order_id}>
                <Td colour={C.blue}>SHP-{s.order_id}</Td>
                <Td>{s.company_name}</Td>
                <Td colour={C.muted}>{s.dest_city}, {s.dest_country}</Td>
                <Td><Badge label={s.status?.replace("_"," ")} colour={STATUS_COL[s.status]}/></Td>
                <Td><Badge label={TEMP_LABEL[s.temp_zone]||s.temp_zone} colour={TEMP_COL[s.temp_zone]}/></Td>
                <Td colour={C.muted}>{fmtDate(s.eta)}</Td>
                <Td colour={C.muted}>${fmtNum(s.estimated_cost_usd)}</Td>
                <Td><Btn style={{fontSize:11,padding:"4px 10px"}} onClick={()=>api.orders.downloadPdf(s.order_id)}>⬇ PDF</Btn></Td>
                {isOps&&<Td><Btn variant="outline" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setUpdateT(s)}>Update</Btn></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {updateT && (
        <Modal title={`Update — SHP-${updateT.order_id}`} onClose={()=>setUpdateT(null)}>
          <ErrBox msg={updateA.error}/>
          {/* Status explanation banner */}
          {uf.status && (
            <div style={{marginBottom:14, padding:"10px 14px", borderRadius:8, fontSize:12, background:
              uf.status==="DISPATCHED"  ? C.amber+"22"  :
              uf.status==="IN_TRANSIT" ? C.blue+"22"   :
              uf.status==="AT_RISK"    ? C.red+"22"    :
              uf.status==="DELIVERED"  ? C.green+"22"  :
              uf.status==="CANCELLED"  ? C.dim+"22"    : C.border,
              border:"1px solid " + (
              uf.status==="DISPATCHED"  ? C.amber+"55"  :
              uf.status==="IN_TRANSIT" ? C.blue+"55"   :
              uf.status==="AT_RISK"    ? C.red+"55"    :
              uf.status==="DELIVERED"  ? C.green+"55"  :
              uf.status==="CANCELLED"  ? C.dim+"55"    : C.border),
              color: C.text}}>
              {{
                DISPATCHED:  "📦 Cargo has left the warehouse and is on the road to the carrier hub. Not yet actively tracked on the live GPS map.",
                IN_TRANSIT:  "✈ Shipment is actively moving. GPS coordinates entered below will appear on the Live Map immediately.",
                AT_RISK:     "⚠ A problem has been detected (temperature breach, delay, or customs hold). The client will be alerted and this shipment will appear in red on the map.",
                DELIVERED:   "✅ Shipment has been successfully received at the destination. This closes the active shipment and marks it complete.",
                CANCELLED:   "✕ Shipment is cancelled. No further updates will be tracked. This cannot be undone easily.",
              }[uf.status]}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Sel label="New Status" value={uf.status} onChange={uset("status")}>
              <option value="">— Select status —</option>
              <option value="DISPATCHED">📦 Dispatched — Left warehouse</option>
              <option value="IN_TRANSIT">✈ In Transit — Actively moving (updates map)</option>
              <option value="AT_RISK">⚠ At Risk — Alert client & ops</option>
              <option value="DELIVERED">✅ Delivered — Completed</option>
              <option value="CANCELLED">✕ Cancelled</option>
            </Sel>
            <Inp label="Revised ETA" type="date" value={uf.revised_eta} onChange={uset("revised_eta")}/>
            <div style={{gridColumn:"span 2"}}>
              <Inp label="Current Location" value={uf.current_location} onChange={uset("current_location")} placeholder="e.g. Dubai International Airport"/>
            </div>
            <Inp label="Latitude (for live map)" type="number" step=".001" value={uf.current_lat} onChange={uset("current_lat")} placeholder="e.g. 25.204" hint="Required for IN_TRANSIT to appear on GPS map"/>
            <Inp label="Longitude (for live map)" type="number" step=".001" value={uf.current_lng} onChange={uset("current_lng")} placeholder="e.g. 55.270"/>
            <div style={{gridColumn:"span 2"}}><Textarea label="Checkpoint Notes" value={uf.checkpoint_notes} onChange={uset("checkpoint_notes")} placeholder="e.g. Cleared customs, temperature verified at 5.2°C"/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>setUpdateT(null)}>Cancel</Btn>
            <Btn variant="primary" disabled={updateA.loading} onClick={doUpdate}>{updateA.loading?"Saving...":"Save Update →"}</Btn>
          </div>
        </Modal>
      )}

      {showCreate && (
        <Modal title="Create Shipment Order" onClose={()=>setShowCreate(false)} wide>
          <ErrBox msg={createA.error}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Sel label="Client Company" value={cf.tenant_id} onChange={cset("tenant_id")}>
              <option value="">— Select client —</option>
              {(tenants||[]).map(t=><option key={t.tenant_id} value={t.tenant_id}>{t.company_name}</option>)}
            </Sel>
            <Sel label="Material" value={cf.material_id} onChange={cset("material_id")}>
              <option value="">— Select material —</option>
              {(mats||[]).map(m=><option key={m.material_id} value={m.material_id}>{m.material_name} [{TEMP_LABEL[m.temp_zone]}]</option>)}
            </Sel>
            <Inp label="Quantity" type="number" value={cf.quantity_ordered} onChange={cset("quantity_ordered")} placeholder="Units"/>
            <Sel label="Origin Warehouse" value={cf.origin_warehouse_id} onChange={cset("origin_warehouse_id")}>
              <option value="">— Select warehouse —</option>
              {(warehouses||[]).map(w=><option key={w.warehouse_id} value={w.warehouse_id}>{w.name}, {w.city}</option>)}
            </Sel>
            <Inp label="Destination City" value={cf.dest_city} onChange={cset("dest_city")} placeholder="e.g. Mumbai"/>
            <Inp label="Destination Country" value={cf.dest_country} onChange={cset("dest_country")} placeholder="e.g. India"/>
            <Sel label="Temperature Zone" value={cf.temp_zone} onChange={cset("temp_zone")}>
              <option value="2_8C">2–8°C</option><option value="minus20C">−20°C</option><option value="minus70C">−70°C</option>
            </Sel>
            <Sel label="Urgency" value={cf.urgency} onChange={cset("urgency")}>
              <option value="CRITICAL">Critical</option><option value="STANDARD">Standard</option><option value="ECONOMY">Economy</option>
            </Sel>
            <Inp label="Required By Date" type="date" value={cf.required_by_date} onChange={cset("required_by_date")}/>
            <div style={{gridColumn:"span 2"}}><Textarea label="Notes" value={cf.notes} onChange={cset("notes")}/></div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" disabled={createA.loading} onClick={doCreate}>{createA.loading?"Creating...":"Create Shipment →"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Inventory ─────────────────────────────────────────────────
function InventoryPage({ toast, highlight, onHighlightClear }) {
  const { data, loading, error, refetch } = useFetch(api.inventory.getAll);
  const { data: alerts, refetch: refetchAlerts, loading: loadingAlerts } = useFetch(api.inventory.restockAlerts);
  const { data: mats } = useFetch(api.materials.getAll);
  const { data: whs }  = useFetch(api.warehouses.getAll);
  const [search,       setSearch]       = useState("");
  const [adjustT,      setAdjustT]      = useState(null);
  const [showAddStock, setShowAddStock] = useState(false);
  const { form,  set,  reset  } = useForm({ adjustment_type:"ADD", quantity:"", reason:"" });
  const { form:af, set:aset, reset:areset } = useForm({ material_id:"", warehouse_id:"", quantity:"", reorder_threshold:"", reason:"" });
  const adjustA   = useSubmit(api.inventory.adjust);
  const addStockA = useSubmit(api.inventory.adjust);

  // Handle external highlighting (from alerts)
  useEffect(() => {
    if (highlight && highlight.material_id) {
      setSearch(highlight.material_name || "");
      aset({ 
        material_id: highlight.material_id, 
        warehouse_id: highlight.warehouse_id, 
        quantity: "", 
        reorder_threshold: "", 
        reason: "Restocking via live alert" 
      });
      setShowAddStock(true);
      if (onHighlightClear) onHighlightClear();
    }
  }, [highlight, aset, onHighlightClear]);

  // Auto-refresh restock alerts every 60 seconds
  useEffect(() => {
    const t = setInterval(() => { refetchAlerts(); refetch(); }, 60000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = (data||[]).filter(i => {
    const q = search.toLowerCase();
    return !q || i.material_name?.toLowerCase().includes(q) || i.warehouse_name?.toLowerCase().includes(q);
  });

  const SEV_COL = { CRITICAL: C.red, HIGH: C.amber, MEDIUM: C.purple };

  async function doAdjust() {
    try {
      await adjustA.run({ material_id:adjustT.material_id, warehouse_id:adjustT.warehouse_id, adjustment_type:form.adjustment_type, quantity:parseFloat(form.quantity), reason:form.reason });
      toast.success("Stock adjusted successfully");
      reset(); setAdjustT(null); refetch(); refetchAlerts();
    } catch {}
  }

  async function doAddStock() {
    try {
      await addStockA.run({ material_id:parseInt(af.material_id), warehouse_id:parseInt(af.warehouse_id), adjustment_type:"ADD", quantity:parseFloat(af.quantity), reason:af.reason||"Initial stock entry" });
      toast.success("Stock added successfully");
      areset(); setShowAddStock(false); refetch(); refetchAlerts();
    } catch {}
  }

  const isRefreshing = loading || loadingAlerts;

  return (
    <div>
      <SectionHead sub="Warehouse" title="Inventory Management"/>
      <Grid cols={4}>
        <KPI label="Total Lines"  value={(data||[]).length}                                           sub="Material/warehouse pairs" icon="▦"/>
        <KPI label="Low Stock"    value={(data||[]).filter(i=>i.stock_status==="LOW").length}         sub="Below threshold" colour={C.amber} icon="⬇"/>
        <KPI label="Critical"     value={(data||[]).filter(i=>i.stock_status==="CRITICAL").length}    sub="Reorder now"     colour={C.red}   icon="⚠"/>
        <KPI label="Watch"        value={(data||[]).filter(i=>i.stock_status==="WATCH").length}       sub="Monitor closely" colour={C.purple}icon="◉"/>
      </Grid>

      {/* ── Restock Alerts Panel ─────────────────────────────── */}
      {(alerts||[]).length > 0 && (
        <Card style={{ marginBottom:16, borderColor: C.amber+"44", background: C.amber+"08" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.amber, textTransform:"uppercase", letterSpacing:".06em" }}>
                ⚠ Auto-Restock Alerts — {(alerts||[]).length} item{(alerts||[]).length!==1?"s":""} need attention
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:3 }}>
                Checked every 30 min · Alerts auto-generated when stock falls below reorder threshold
              </div>
            </div>
            <Btn variant="ghost" disabled={isRefreshing} style={{ fontSize:11 }} onClick={() => { refetchAlerts(); refetch(); }}>
              {isRefreshing ? "↻ Refreshing..." : "↻ Refresh"}
            </Btn>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:10 }}>
            {(alerts||[]).map((item, i) => (
              <div key={i} style={{
                background: C.bg, border:`1px solid ${SEV_COL[item.severity]||C.amber}33`,
                borderRadius:10, padding:"12px 14px"
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{item.material_name}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{item.sku} · {item.warehouse_name}, {item.city}</div>
                  </div>
                  <Badge label={item.severity} colour={SEV_COL[item.severity]||C.amber}/>
                </div>

                {/* Stock bar */}
                <div style={{ marginBottom:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginBottom:4 }}>
                    <span>{fmtNum(item.quantity_on_hand)} {item.unit_of_measure} on hand</span>
                    <span>{item.stock_pct}% of threshold</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:C.border }}>
                    <div style={{
                      height:"100%", borderRadius:3,
                      background: SEV_COL[item.severity]||C.amber,
                      width: Math.min(item.stock_pct, 100) + "%",
                      transition:"width .3s"
                    }}/>
                  </div>
                </div>

                <div style={{
                  fontSize:12, color: SEV_COL[item.severity]||C.amber,
                  fontWeight:600, background: (SEV_COL[item.severity]||C.amber)+"12",
                  borderRadius:6, padding:"5px 10px"
                }}>
                  📦 Order {fmtNum(item.units_to_order)} {item.unit_of_measure} to restore full stock
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
          <Search value={search} onChange={setSearch} placeholder="Search material or warehouse..."/>
          <div style={{flex:1}}/>
          <Btn variant="primary" onClick={()=>setShowAddStock(true)}>+ Add Stock</Btn>
        </div>
        <ErrBox msg={error}/>
        <Table>
          <thead><tr><Th>Material</Th><Th>SKU</Th><Th>Temp</Th><Th>On Hand</Th><Th>Threshold</Th><Th>Warehouse</Th><Th>Status</Th><Th>Adjust</Th></tr></thead>
          <tbody>
            {loading ? <LoadRows cols={8}/> :
             !rows.length ? <tr><td colSpan={8}><EmptyState icon="▦" title="No inventory yet" desc="Click '+ Add Stock' to add the first stock entry for a material and warehouse."/></td></tr> :
             rows.map((item,i)=>(
              <tr key={i}>
                <Td style={{fontWeight:600}}>{item.material_name}</Td>
                <Td colour={C.muted}>{item.sku}</Td>
                <Td><Badge label={TEMP_LABEL[item.temp_zone]||item.temp_zone} colour={TEMP_COL[item.temp_zone]}/></Td>
                <Td><strong>{fmtNum(item.quantity_on_hand)}</strong> <span style={{color:C.muted,fontSize:12}}>{item.unit_of_measure}</span></Td>
                <Td colour={C.muted}>{fmtNum(item.reorder_threshold)}</Td>
                <Td colour={C.muted}>{item.warehouse_name}, {item.city}</Td>
                <Td><Badge label={item.stock_status} colour={STOCK_COL[item.stock_status]}/></Td>
                <Td><Btn variant="outline" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>{setAdjustT(item);reset();}}>Adjust</Btn></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Adjust existing stock row */}
      {adjustT && (
        <Modal title={`Adjust Stock — ${adjustT.material_name}`} onClose={()=>setAdjustT(null)}>
          <ErrBox msg={adjustA.error}/>
          <Card style={{marginBottom:16,background:C.surface}}>
            <div style={{fontSize:13}}><span style={{color:C.muted}}>Current stock: </span><strong>{fmtNum(adjustT.quantity_on_hand)} {adjustT.unit_of_measure}</strong><span style={{color:C.muted}}> at {adjustT.warehouse_name}</span></div>
          </Card>
          <Sel label="Adjustment Type" value={form.adjustment_type} onChange={set("adjustment_type")}>
            <option value="ADD">ADD — Incoming stock received</option>
            <option value="REMOVE">REMOVE — Allocated / consumed / returned</option>
          </Sel>
          <Inp label={`Quantity (${adjustT.unit_of_measure})`} type="number" value={form.quantity} onChange={set("quantity")} placeholder="Enter amount"/>
          <Textarea label="Reason" value={form.reason} onChange={set("reason")} placeholder="e.g. Received from supplier — Batch REF-2024-XY"/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>setAdjustT(null)}>Cancel</Btn>
            <Btn variant="primary" disabled={adjustA.loading} onClick={doAdjust}>{adjustA.loading?"Saving...":"Confirm Adjustment →"}</Btn>
          </div>
        </Modal>
      )}

      {/* Add brand new material+warehouse stock entry */}
      {showAddStock && (
        <Modal title="Add Stock — New Entry" onClose={()=>{setShowAddStock(false);areset();}}>
          <ErrBox msg={addStockA.error}/>
          <div style={{fontSize:12,color:C.muted,marginBottom:14}}>Select a material and warehouse, then enter the starting quantity. This creates a new stock tracking entry.</div>
          <Sel label="Material" value={af.material_id} onChange={aset("material_id")}>
            <option value="">— Select material —</option>
            {(mats||[]).map(m=><option key={m.material_id} value={m.material_id}>{m.material_name} [{TEMP_LABEL[m.temp_zone]||m.temp_zone}] — {m.sku}</option>)}
          </Sel>
          <Sel label="Warehouse" value={af.warehouse_id} onChange={aset("warehouse_id")}>
            <option value="">— Select warehouse —</option>
            {(whs||[]).map(w=><option key={w.warehouse_id} value={w.warehouse_id}>{w.name} — {w.city}, {w.country}</option>)}
          </Sel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Initial Quantity" type="number" value={af.quantity} onChange={aset("quantity")} placeholder="e.g. 1000"/>
            <Inp label="Reorder Threshold" type="number" value={af.reorder_threshold} onChange={aset("reorder_threshold")} placeholder="e.g. 200" hint="Alert when stock falls below this"/>
          </div>
          <Textarea label="Reason / Notes" value={af.reason} onChange={aset("reason")} placeholder="e.g. Initial stock from supplier ABC, batch 2024-001"/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>{setShowAddStock(false);areset();}}>Cancel</Btn>
            <Btn variant="primary" disabled={addStockA.loading||!af.material_id||!af.warehouse_id||!af.quantity} onClick={doAddStock}>{addStockA.loading?"Adding...":"Add Stock →"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Temperature Monitor ───────────────────────────────────────
function TempMonitorPage({ isOps, shipments, toast }) {
  const [selectedId, setSelectedId] = useState("");
  const [showLog, setShowLog] = useState(false);
  const { form, set, reset } = useForm({ order_id:"", sensor_id:"", temperature_celsius:"", location:"" });
  const logA = useSubmit(api.temperature.logReading);
  const { data:logs, loading, refetch } = useFetch(() => selectedId ? api.temperature.getByShipment(selectedId) : Promise.resolve([]), [selectedId]);

  const allShipmentsSorted = (shipments||[]).slice().sort((a,b) => b.order_id - a.order_id);
  const activeShipments = allShipmentsSorted.filter(s=>["IN_TRANSIT","AT_RISK","DISPATCHED"].includes(s.status));
  const selectedShipment = allShipmentsSorted.find(s => String(s.order_id) === String(selectedId));
  const canLog = isOps && selectedShipment && ["IN_TRANSIT","AT_RISK","DISPATCHED"].includes(selectedShipment?.status);

  async function doLog() {
    try {
      const res = await logA.run({ ...form, order_id:parseInt(form.order_id), temperature_celsius:parseFloat(form.temperature_celsius) });
      toast[res.is_excursion?"error":"success"](res.is_excursion ? "⚠ EXCURSION detected! Alert sent to ops and client." : "Temperature reading logged successfully");
      reset(); setShowLog(false);
      if (form.order_id === selectedId) refetch();
    } catch {}
  }

  return (
    <div>
      <SectionHead sub="Cold Chain" title="Temperature Monitoring"/>
      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:300}}>
          <Sel label="Select shipment to view temperature history" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
            <option value="">— Select any shipment —</option>
            {["AT_RISK","IN_TRANSIT","DISPATCHED","DELIVERED","PENDING","CANCELLED"].map(status => {
              const group = allShipmentsSorted.filter(s => s.status === status);
              if (!group.length) return null;
              return <optgroup key={status} label={`── ${status.replace("_"," ")} ──`}>
                {group.map(s=><option key={s.order_id} value={s.order_id}>SHP-{s.order_id} — {s.company_name} · {TEMP_LABEL[s.temp_zone]||s.temp_zone}</option>)}
              </optgroup>;
            })}
          </Sel>
        </div>
        {canLog && <Btn variant="primary" onClick={()=>setShowLog(true)} style={{marginTop:22}}>+ Log Reading</Btn>}
      </div>

      {!selectedId ? (
        <Card><EmptyState icon="❄" title="Select a shipment" desc="Choose an active shipment above to view its temperature readings from MySQL."/></Card>
      ) : loading ? (
        <Card><div style={{color:C.muted,textAlign:"center",padding:32}}>Loading readings...</div></Card>
      ) : !(logs||[]).length ? (
        <Card><EmptyState icon="🌡" title="No readings yet" desc="No temperature readings have been logged for this shipment."/></Card>
      ) : (
        (logs||[]).map(log => {
          const ship  = activeShipments.find(s=>String(s.order_id)===String(log.order_id));
          const range = ship ? TEMP_RANGE[ship.temp_zone] : null;
          const col   = log.is_excursion ? C.red : C.green;
          return (
            <Card key={log.log_id} style={{marginBottom:12, borderColor:log.is_excursion?C.red+"55":C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div>
                  <span style={{color:C.blue,fontWeight:700}}>SHP-{log.order_id}</span>
                  <span style={{color:C.muted,fontSize:12,marginLeft:12}}>{log.sensor_id} · {log.location} · {fmtDate(log.recorded_at)}</span>
                </div>
                <Badge label={log.is_excursion?"EXCURSION":"NORMAL"} colour={col}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:24}}>
                <div style={{fontSize:36,fontWeight:800,color:col}}>{parseFloat(log.temperature_celsius).toFixed(1)}°C</div>
                {range && (
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:6}}>
                      <span>Min {range.min}°C</span><span>Allowed Range</span><span>Max {range.max}°C</span>
                    </div>
                    <div style={{height:10,borderRadius:5,background:C.border}}>
                      <div style={{height:"100%",borderRadius:5,background:col,width:Math.min(Math.max(((log.temperature_celsius-range.min+4)/(range.max-range.min+8))*100,4),94)+"%"}}/>
                    </div>
                  </div>
                )}
              </div>
              {log.is_excursion && (
                <div style={{marginTop:12,background:C.red+"10",border:`1px solid ${C.red}30`,borderRadius:8,padding:"10px 14px",fontSize:12,color:C.red}}>
                  ⚠ Excursion recorded — ops and client notified via socket.io · Email sent automatically
                </div>
              )}
            </Card>
          );
        })
      )}

      {showLog && (
        <Modal title="Log Temperature Reading" onClose={()=>setShowLog(false)}>
          <ErrBox msg={logA.error}/>
          <Sel label="Shipment" value={form.order_id} onChange={set("order_id")}>
            <option value="">— Select active shipment —</option>
            {activeShipments.map(s=><option key={s.order_id} value={s.order_id}>SHP-{s.order_id} — {s.company_name} ({TEMP_LABEL[s.temp_zone]||s.temp_zone})</option>)}
          </Sel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Sensor ID (optional)" value={form.sensor_id} onChange={set("sensor_id")} placeholder="e.g. SNS-A1"/>
            <Inp label="Temperature (°C)" type="number" step=".1" value={form.temperature_celsius} onChange={set("temperature_celsius")} placeholder="e.g. −19.4"/>
          </div>
          <Inp label="Location" value={form.location} onChange={set("location")} placeholder="e.g. Dubai Cargo Terminal"/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>setShowLog(false)}>Cancel</Btn>
            <Btn variant="primary" disabled={logA.loading} onClick={doLog}>{logA.loading?"Logging...":"Log Reading →"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Compliance ────────────────────────────────────────────────
function CompliancePage({ isOps, shipments, toast }) {
  const [selectedId, setSelectedId] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const fileRef = useRef();
  const { form, set, reset } = useForm({ order_id:"", doc_type:"", issuing_body:"", issued_date:"", expiry_date:"" });
  const uploadA = useSubmit(api.compliance.upload);
  const { data:docs, loading, refetch } = useFetch(() => selectedId ? api.compliance.getByShipment(selectedId) : Promise.resolve([]), [selectedId]);

  async function doUpload() {
    if (!file) return;
    const fd = new FormData();
    fd.append("document", file);
    ["order_id","doc_type","issuing_body","issued_date","expiry_date"].forEach(k => fd.append(k, form[k] || selectedId));
    try {
      await uploadA.run(fd);
      toast.success("Document uploaded successfully");
      reset(); setFile(null); setShowUpload(false); refetch();
    } catch {}
  }

  return (
    <div>
      <SectionHead sub="Regulatory" title="Compliance Documents"/>
      <Card style={{marginBottom:14, background:C.surface}}>
        <span style={{color:C.purple,fontWeight:600}}>⏰ Automated Daily Check (node-cron): </span>
        <span style={{color:C.muted,fontSize:13}}>Runs at 8:00 AM every day — flags documents expiring within 14 days, creates alerts, and emails the ops team automatically.</span>
      </Card>
      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:16,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:300}}>
          <Sel label="Select shipment to view documents" value={selectedId} onChange={e=>setSelectedId(e.target.value)}>
            <option value="">— Select a shipment —</option>
            {(shipments||[]).map(s=><option key={s.order_id} value={s.order_id}>SHP-{s.order_id} — {s.company_name} ({s.dest_city})</option>)}
          </Sel>
        </div>
        {isOps && <Btn variant="primary" onClick={()=>setShowUpload(true)} style={{marginTop:22}}>+ Upload Document</Btn>}
      </div>

      {selectedId && (
        <Card>
          {loading && <div style={{color:C.muted,textAlign:"center",padding:24}}>Loading documents...</div>}
          {!loading && !(docs||[]).length && <EmptyState icon="📄" title="No documents yet" desc="Upload compliance documents for this shipment."/>}
          {!loading && (docs||[]).length>0 && (
            <Table>
              <thead><tr><Th>Type</Th><Th>Issuing Authority</Th><Th>Issued</Th><Th>Expires</Th><Th>Status</Th><Th>Download</Th></tr></thead>
              <tbody>
                {docs.map(d=>{
                  const col={VALID:C.green,EXPIRING:C.amber,EXPIRED:C.red,PENDING:C.muted}[d.status]||C.muted;
                  return (
                    <tr key={d.doc_id}>
                      <Td style={{fontWeight:600}}>{d.doc_type}</Td>
                      <Td colour={C.muted}>{d.issuing_body}</Td>
                      <Td colour={C.muted}>{fmtDate(d.issued_date)}</Td>
                      <Td colour={d.status==="EXPIRING"?C.amber:C.muted}>{fmtDate(d.expiry_date)}</Td>
                      <Td><Badge label={d.status} colour={col}/></Td>
                      <Td>{d.file_path ? <a href={(process.env.REACT_APP_API_URL||"http://localhost:5000")+d.file_path} target="_blank" rel="noreferrer"><Btn style={{fontSize:11,padding:"4px 10px"}}>⬇ Download</Btn></a> : <span style={{color:C.dim,fontSize:12}}>No file</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {showUpload && (
        <Modal title="Upload Compliance Document" onClose={()=>{setShowUpload(false);setFile(null);}}>
          <ErrBox msg={uploadA.error}/>
          <div onClick={()=>fileRef.current.click()} style={{border:`2px dashed ${file?C.green:C.border}`,borderRadius:10,padding:"32px 20px",textAlign:"center",cursor:"pointer",marginBottom:14,background:file?C.green+"08":"transparent",transition:"all .2s"}}>
            <div style={{fontSize:32,marginBottom:8}}>{file?"✓":"📄"}</div>
            <div style={{fontSize:13,color:file?C.green:C.muted,fontWeight:file?600:400}}>{file?file.name:"Drag & drop or click to select file"}</div>
            <div style={{fontSize:11,color:C.dim,marginTop:4}}>PDF, JPG, PNG — max 10 MB</div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>setFile(e.target.files[0])}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Sel label="Shipment" value={form.order_id||selectedId} onChange={set("order_id")}>
              <option value="">— Select shipment —</option>
              {(shipments||[]).map(s=><option key={s.order_id} value={s.order_id}>SHP-{s.order_id} — {s.company_name}</option>)}
            </Sel>
            <Sel label="Document Type" value={form.doc_type} onChange={set("doc_type")}>
              <option value="">— Select type —</option>
              {["GDP Certificate","IATA DG Declaration","Cold Chain COC","Import Permit","Export License","WHO Prequalification","EMA Approval","FDA Registration","GMP Certificate"].map(t=><option key={t} value={t}>{t}</option>)}
            </Sel>
            <Inp label="Issuing Authority" value={form.issuing_body} onChange={set("issuing_body")} placeholder="e.g. WHO, EMA, FDA"/>
            <div/>
            <Inp label="Date Issued" type="date" value={form.issued_date} onChange={set("issued_date")}/>
            <Inp label="Expiry Date" type="date" value={form.expiry_date} onChange={set("expiry_date")}/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>{setShowUpload(false);setFile(null);}}>Cancel</Btn>
            <Btn variant="primary" disabled={!file||uploadA.loading} onClick={doUpload}>{uploadA.loading?"Uploading...":"⬆ Upload Document"}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Route Planner ─────────────────────────────────────────────
function RoutePlannerPage() {
  const { form, set } = useForm({ temp_zone:"2_8C", urgency:"STANDARD", origin_city:"", dest_city:"" });
  const evalA = useSubmit(api.routes.evaluate);
  const [results, setResults] = useState(null);

  const cities = ["Basel", "Mumbai", "Chicago", "Seoul"];

  async function doEval() {
    try { const d = await evalA.run(form); setResults(d.routes||[]); }
    catch {}
  }

  return (
    <div>
      <SectionHead sub="Logistics" title="Multimodal Route Planner"/>
      <div style={{display:"grid",gridTemplateColumns:"320px 1fr",gap:14,marginBottom:14}}>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".06em"}}>Route Parameters</div>
          <Sel label="Origin Warehouse City" value={form.origin_city} onChange={set("origin_city")}>
            <option value="">— Optional —</option>
            {cities.map(c=><option key={c} value={c}>{c}</option>)}
          </Sel>
          <Sel label="Destination City" value={form.dest_city} onChange={set("dest_city")}>
            <option value="">— Optional —</option>
            {cities.map(c=><option key={c} value={c}>{c}</option>)}
          </Sel>
          <div style={{height:10}}/>
          <Sel label="Temperature Zone" value={form.temp_zone} onChange={set("temp_zone")}>
            <option value="2_8C">2–8°C — Refrigerated</option>
            <option value="minus20C">−20°C — Frozen</option>
            <option value="minus70C">−70°C — Deep Frozen (air only)</option>
          </Sel>
          <Sel label="Urgency" value={form.urgency} onChange={set("urgency")}>
            <option value="CRITICAL">Critical — 24 hours</option>
            <option value="STANDARD">Standard — 3–5 days</option>
            <option value="ECONOMY">Economy — 10+ days</option>
          </Sel>
          <ErrBox msg={evalA.error}/>
          <Btn variant="primary" style={{width:"100%",justifyContent:"center"}} disabled={evalA.loading} onClick={doEval}>{evalA.loading?"Evaluating...":"Evaluate Routes →"}</Btn>
        </Card>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".06em"}}>Routing Rules (enforced server-side)</div>
          {[["−70°C materials require air transport only","Prevents ground/sea routes for ultra-cold cargo"],["Critical urgency cannot use sea routes","Sea is too slow for 24h delivery requirements"],["Carrier capacity > 85% adds risk penalty","Full carriers increase shipment risk score"],["GDP compliance required on all routes","Non-compliant carriers are automatically excluded"],["Lowest risk score = recommended route","Algorithm ranks by adjusted risk, not just cost"]].map(([r,d],i)=>(
            <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}20`}}>
              <span style={{color:C.green,marginTop:2}}>✓</span>
              <div><div style={{fontSize:13,fontWeight:500,color:C.text}}>{r}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{d}</div></div>
            </div>
          ))}
        </Card>
      </div>

      {results && (
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:16,textTransform:"uppercase",letterSpacing:".06em"}}>Recommended Routes — Ranked by Risk Score (lowest = best)</div>
          {!results.length ? <EmptyState icon="🗺" title="No valid routes" desc="No routes match these parameters. Add routes in Setup."/> :
          results.map((r,i)=>(
            <div key={i} style={{padding:"16px",borderRadius:10,marginBottom:10,border:`1px solid ${i===0?C.blue:C.border}`,background:i===0?C.blue+"06":"transparent",position:"relative"}}>
              {i===0&&<span style={{position:"absolute",top:12,right:12}}><Badge label="★ Recommended" colour={C.blue}/></span>}
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
                <span style={{fontSize:15,fontWeight:700,color:i===0?C.blue:C.text}}>{r.transport_mode}</span>
                <span style={{fontSize:13,color:C.muted}}>{r.carrier_name}</span>
                <span style={{marginLeft:"auto",marginRight:i===0?140:20,fontSize:13}}>
                  ⏱ <strong>{r.estimated_hours}h</strong>
                  <span style={{color:C.green,marginLeft:20}}>💰 ${fmtNum(r.base_cost_usd)}</span>
                </span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <Badge label={`Risk: ${r.adjusted_score}`} colour={C.purple}/>
                {r.capacity_pct&&<Badge label={`Capacity: ${r.capacity_pct}%`} colour={r.capacity_pct>85?C.red:C.green}/>}
                <Badge label={r.origin_city_name||r.origin_city} colour={C.dim}/>
                <Badge label={`→ ${r.dest_city}`} colour={C.dim}/>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── Live Map ──────────────────────────────────────────────────
function LiveMapPage({ shipments }) {
  const blobRef = useRef(null);
  const [url, setUrl] = useState("");

  useEffect(() => {
    const all = (shipments||[]);
    const mapData = all.map(s => ({
      id:         s.order_id,
      client:     s.company_name || "Unknown",
      status:     s.status || "PENDING",
      temp:       TEMP_LABEL[s.temp_zone] || s.temp_zone || "—",
      progress:   s.progress_pct || 0,
      colour:     STATUS_COL[s.status] || "#52525b",
      lat:        s.current_lat  || s.origin_lat || null,
      lng:        s.current_lng  || s.origin_lng || null,
      location:   s.current_location || (s.origin_city ? `At ${s.origin_city}` : "Origin"),
      origin_lat: s.origin_lat  || null,
      origin_lng: s.origin_lng  || null,
      origin:     s.origin_city || s.origin_warehouse || "Origin",
      dest:       s.dest_city   || "Destination",
      carrier:    s.carrier_name || "—",
      mode:       s.transport_mode || "—",
      eta:        s.eta ? new Date(s.eta).toLocaleDateString("en-GB",{day:"numeric",month:"short"}) : "—",
    }));

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body{margin:0;background:#09090b}
  #map{height:100vh}
  .panel{position:absolute;top:16px;left:16px;z-index:1000;background:rgba(12,12,18,.97);border:1px solid #2e2e38;border-radius:12px;padding:16px;min-width:250px;max-width:280px;color:#f4f4f5;font-family:system-ui,sans-serif;font-size:12px;max-height:calc(100vh - 40px);overflow-y:auto}
  .panel-title{color:#3b82f6;font-weight:700;letter-spacing:.06em;margin-bottom:12px;font-size:13px}
  .ship-row{padding:9px 0;border-bottom:1px solid #2e2e3820;cursor:pointer}
  .ship-row:hover{opacity:.8}
  .legend{position:absolute;bottom:24px;left:16px;z-index:1000;background:rgba(12,12,18,.97);border:1px solid #2e2e38;border-radius:10px;padding:12px;color:#f4f4f5;font-family:system-ui,sans-serif;font-size:11px}
  .leg-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .leg-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  @keyframes pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1.1); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  .at-risk-point { animation: pulse 1.5s infinite; }
</style>
</head><body>
<div id="map"></div>
<div class="panel">
  <div class="panel-title">◈ ALL SHIPMENTS (${all.length})</div>
  <div id="list"></div>
</div>
<div class="legend">
  <div class="leg-row"><div class="leg-dot" style="background:${C.blue}"></div>In Transit</div>
  <div class="leg-row"><div class="leg-dot" style="background:${C.red}"></div>At Risk</div>
  <div class="leg-row"><div class="leg-dot" style="background:${C.green}"></div>Delivered</div>
  <div class="leg-row"><div class="leg-dot" style="background:${C.amber}"></div>Dispatched</div>
  <div class="leg-row"><div class="leg-dot" style="background:${C.dim}"></div>Pending</div>
</div>
<script>
var map = L.map('map').setView([20, 10], 2);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap' }).addTo(map);

var ships = ${JSON.stringify(mapData)};
var list = document.getElementById('list');
var markers = {};

ships.forEach(function(s) {
  try {
    var row = document.createElement('div');
    row.className = 'ship-row';
    row.innerHTML = '<span style="color:' + s.colour + ';font-weight:700">SHP-' + s.id + '</span> <span style="color:#71717a">' + s.status + '</span><br/>' +
                    '<span style="color:#a1a1aa">' + s.client + '</span><br/>' +
                    '<span style="color:#52525b">📍 ' + s.location + ' · ' + s.progress + '%</span>';
    row.onclick = function() {
      if (markers[s.id]) { map.flyTo(markers[s.id].getLatLng(), 6, {duration: 1.5}); markers[s.id].openPopup(); }
      else if (s.origin_lat) { map.flyTo([s.origin_lat, s.origin_lng], 5, {duration: 1.5}); }
    };
    list.appendChild(row);

    if (s.origin_lat && s.lat) {
      L.polyline([[s.origin_lat, s.origin_lng], [s.lat, s.lng]], { color: s.colour, weight: 2, opacity: 0.6, dashArray: '5 5' }).addTo(map);
    }

    var lat = s.lat || s.origin_lat;
    var lng = s.lng || s.origin_lng;

    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      var latOff = (Math.random()-0.5) * 0.25;
      var lngOff = (Math.random()-0.5) * 0.25;
      var finalLat = parseFloat(lat) + latOff;
      var finalLng = parseFloat(lng) + lngOff;
      
      var pulseClass = s.status === 'AT_RISK' ? 'at-risk-point' : '';
      var iconHtml = '<div class="' + pulseClass + '" style="width:14px;height:14px;border-radius:50%;background:' + s.colour + 'cc;border:2.5px solid rgba(255,255,255,0.8);box-shadow:0 0 10px ' + s.colour + '"></div>';
      var customIcon = L.divIcon({ html: iconHtml, className: 'custom-map-marker', iconSize: [14, 14] });
      // 4. Priority layering: Dispatched & Risk stay on top of standard Transit
      var zPriority = (s.status === 'AT_RISK' || s.status === 'DISPATCHED' || s.status === 'APPROVED') ? 2000 : 0;
      var m = L.marker([finalLat, finalLng], { icon: customIcon, zIndexOffset: zPriority }).addTo(map);
      
      m.bindPopup('<div style="font-family:sans-serif;padding:2px"><b style="color:' + s.colour + '">SHP-' + s.id + '</b><br/>' + s.client + '<br/>Status: ' + s.status + '<br/>📍 ' + s.location + '</div>');
      markers[s.id] = m;
    }

  } catch (e) { console.error("Marker draw failed for SHP-" + s.id, e); }
});

if (ships.length) {
  var bounds = ships.filter(s => s.lat || s.origin_lat).map(s => [s.lat || s.origin_lat, s.lng || s.origin_lng]);
  if (bounds.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 });
}
</script></body></html>`;

    const blob = new Blob([html], { type:"text/html" });
    const u = URL.createObjectURL(blob);
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = u;
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [shipments]);

  return (
    <div style={{margin:"-24px", height:"calc(100vh - 56px)"}}>
      {!url ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.muted}}>Loading map...</div>
      ) : (
        <iframe src={url} style={{width:"100%",height:"100%",border:"none"}} title="Live Shipment Map"/>
      )}
    </div>
  );
}

// ── Material Catalog (Client) ─────────────────────────────────
function MaterialCatalogPage({ toast }) {
  const { data, loading } = useFetch(api.materials.getAll);
  const [search, setSearch] = useState("");
  const [requestT, setRequestT] = useState(null);
  const { form, set, reset } = useForm({ quantity_requested:"", urgency:"STANDARD", required_by_date:"", delivery_address:"", notes:"" });
  const submitA = useSubmit(api.procurement.submit);

  const rows = (data||[]).filter(m => !search || m.material_name?.toLowerCase().includes(search.toLowerCase()));

  async function doRequest() {
    try {
      await submitA.run({ material_id:requestT.material_id, quantity_requested:parseFloat(form.quantity_requested), temp_zone:requestT.temp_zone, urgency:form.urgency, required_by_date:form.required_by_date, delivery_address:form.delivery_address, notes:form.notes });
      toast.success("Request submitted! The ops team will review shortly.");
      reset(); setRequestT(null);
    } catch {}
  }

  return (
    <div>
      <SectionHead sub="Catalog" title="Certified Materials"/>
      <div style={{marginBottom:16}}><Search value={search} onChange={setSearch} placeholder="Search materials..."/></div>
      {loading && <div style={{color:C.muted,textAlign:"center",padding:40}}>Loading catalog...</div>}
      {!loading&&!rows.length&&<Card><EmptyState icon="🧪" title="No materials available" desc="The ops team hasn't added any materials yet."/></Card>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {rows.map(m=>{
          const stock=parseFloat(m.total_stock||0);
          const status=stock===0?"CRITICAL":stock<100?"LOW":"OK";
          const certs=(m.certifications||"").split(",").filter(Boolean);
          return (
            <Card key={m.material_id} style={{position:"relative"}}>
              <div style={{position:"absolute",top:14,right:14}}><Badge label={status} colour={STOCK_COL[status]}/></div>
              <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4,paddingRight:80}}>{m.material_name}</div>
              <div style={{fontSize:12,color:C.muted,marginBottom:10}}>{m.sku}</div>
              <Badge label={TEMP_LABEL[m.temp_zone]||m.temp_zone} colour={TEMP_COL[m.temp_zone]}/>
              {certs.length>0&&(
                <>
                  <div style={{fontSize:11,color:C.muted,marginTop:12,marginBottom:6,letterSpacing:".06em",textTransform:"uppercase"}}>Certifications</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {certs.map(c=><Badge key={c} label={c.trim()} colour={C.purple}/>)}
                  </div>
                </>
              )}
              <div style={{margin:"14px 0 4px",fontSize:12,color:C.muted,textTransform:"uppercase",letterSpacing:".06em"}}>Available Stock</div>
              <div style={{fontSize:20,fontWeight:700,marginBottom:14}}>{fmtNum(stock)}<span style={{fontSize:13,color:C.muted,fontWeight:400}}> {m.unit_of_measure}</span></div>
              <Btn variant={status==="CRITICAL"?"ghost":"primary"} style={{width:"100%",justifyContent:"center",opacity:status==="CRITICAL"?.5:1}}
                onClick={()=>status!=="CRITICAL"&&setRequestT(m)}>
                {status==="CRITICAL"?"Out of Stock":"Request Material →"}
              </Btn>
            </Card>
          );
        })}
      </div>

      {requestT&&(
        <Modal title={`Request — ${requestT.material_name}`} onClose={()=>{setRequestT(null);reset();}}>
          <ErrBox msg={submitA.error}/>
          {submitA.success ? (
            <div style={{textAlign:"center",padding:"32px 0"}}>
              <div style={{fontSize:40,marginBottom:12}}>✓</div>
              <div style={{fontSize:16,fontWeight:700,color:C.green,marginBottom:6}}>Request Submitted!</div>
              <div style={{fontSize:13,color:C.muted}}>The ops team has been notified and will review your request shortly.</div>
            </div>
          ):(
            <>
              <div style={{marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
                <Badge label={TEMP_LABEL[requestT.temp_zone]||requestT.temp_zone} colour={TEMP_COL[requestT.temp_zone]}/>
                <span style={{fontSize:13,color:C.muted}}>{fmtNum(requestT.total_stock)} {requestT.unit_of_measure} available</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label={`Quantity (${requestT.unit_of_measure})`} type="number" value={form.quantity_requested} onChange={set("quantity_requested")} placeholder="Enter amount"/>
                <Sel label="Urgency" value={form.urgency} onChange={set("urgency")}>
                  <option value="CRITICAL">Critical — 24–48 hours</option>
                  <option value="STANDARD">Standard — 3–5 days</option>
                  <option value="ECONOMY">Economy — 7–14 days</option>
                </Sel>
              </div>
              <Inp label="Required By Date" type="date" value={form.required_by_date} onChange={set("required_by_date")}/>
              <Inp label="Delivery Address" value={form.delivery_address} onChange={set("delivery_address")} placeholder="Full delivery address"/>
              <Textarea label="Special Notes" value={form.notes} onChange={set("notes")}/>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <Btn onClick={()=>{setRequestT(null);reset();}}>Cancel</Btn>
                <Btn variant="primary" disabled={submitA.loading} onClick={doRequest}>{submitA.loading?"Submitting...":"Submit Request →"}</Btn>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Client Dashboard ──────────────────────────────────────────
function ClientDashboard({ user }) {
  const { data, loading } = useFetch(api.dashboard.getClient);
  const { data:ships }    = useFetch(api.orders.getAll);

  return (
    <div>
      <SectionHead sub="Client Portal" title={`Welcome, ${user?.name}`}/>
      <Card style={{marginBottom:16,background:C.surface,borderColor:C.blue+"33"}}>
        <span style={{color:C.blue,fontWeight:600}}>🔒 Your data only — </span>
        <span style={{color:C.muted,fontSize:13}}>Your JWT token contains your company ID. The server automatically filters every database query to show only your company's data.</span>
      </Card>
      <Grid cols={4}>
        <KPI label="My Shipments" value={data?.total_shipments} sub="Total orders"    colour={C.blue}  icon="📦"/>
        <KPI label="In Transit"   value={data?.in_transit}      sub="Moving now"      colour={C.cyan}  icon="✈"/>
        <KPI label="At Risk"      value={data?.at_risk}          sub="Needs attention" colour={data?.at_risk>0?C.red:C.green} icon="⚠"/>
        <KPI label="Delivered"    value={data?.delivered}        sub="Completed"       colour={C.green} icon="✓"/>
      </Grid>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14}}>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".06em"}}>My Shipments</div>
          {loading?<Table><tbody><LoadRows cols={5}/></tbody></Table>:
          !(ships||[]).length?<EmptyState icon="📦" title="No shipments yet" desc="Your shipments will appear here once created."/>:
          <Table>
            <thead><tr><Th>ID</Th><Th>Route</Th><Th>Status</Th><Th>Temp</Th><Th>ETA</Th><Th>PDF</Th></tr></thead>
            <tbody>
              {(ships||[]).slice(0,8).map(s=>(
                <tr key={s.order_id}>
                  <Td colour={C.blue}>SHP-{s.order_id}</Td>
                  <Td colour={C.muted}>{s.origin_city||"—"} → {s.dest_city}</Td>
                  <Td><Badge label={s.status?.replace("_"," ")} colour={STATUS_COL[s.status]}/></Td>
                  <Td><Badge label={TEMP_LABEL[s.temp_zone]||s.temp_zone} colour={TEMP_COL[s.temp_zone]}/></Td>
                  <Td colour={C.muted}>{fmtDate(s.eta)}</Td>
                  <Td><Btn style={{fontSize:11,padding:"4px 10px"}} onClick={()=>api.orders.downloadPdf(s.order_id)}>⬇ PDF</Btn></Td>
                </tr>
              ))}
            </tbody>
          </Table>}
        </Card>
        <Card>
          <div style={{fontSize:13,fontWeight:600,color:C.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".06em"}}>My Alerts</div>
          {!(data?.alerts||[]).length?<EmptyState icon="✓" title="No active alerts" desc="All clear!"/>:
          (data.alerts||[]).map(a=>(
            <div key={a.alert_id} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}18`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,fontWeight:600,color:a.severity==="CRITICAL"?C.red:C.amber}}>{a.alert_type?.replace("_"," ")}</span>
                <Badge label={a.severity} colour={a.severity==="CRITICAL"?C.red:C.amber}/>
              </div>
              <div style={{fontSize:12,color:C.muted}}>{a.message}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Admin Setup Page (ops only) ───────────────────────────────
// This is the key page that removes ALL hardcoding.
// Ops adds everything here through the UI after first login.
// ── User Setup Tab — tenant dropdown from DB ─────────────────
function UserSetupTab({ items, refetch, toast, tenants }) {
  const [showForm, setShowForm] = useState(false);
  const { form, set, reset } = useForm({ full_name:"", email:"", password:"", role:"client_admin", tenant_id:"" });
  const createA = useSubmit(api.users.create);

  async function doCreate() {
    try {
      const payload = { full_name:form.full_name, email:form.email, password:form.password, role:form.role };
      if (form.tenant_id) payload.tenant_id = parseInt(form.tenant_id);
      const res = await createA.run(payload);
      toast.success(res.message || "User created successfully");
      reset(); setShowForm(false); refetch();
    } catch {}
  }

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text}}>👤 Users <span style={{fontSize:13,color:C.muted}}>({items?.length||0} total)</span></div>
        <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Add User</Btn>
      </div>
      <Card>
        {!(items||[]).length ? <EmptyState icon="👤" title="No users yet" desc="Add the first user. Ops users don't need a company. Client users must be linked to a company."/> : (
          <Table>
            <thead><tr><Th>Name</Th><Th>Email</Th><Th>Role</Th><Th>Company</Th><Th>Last Login</Th></tr></thead>
            <tbody>
              {items.map(u=>(
                <tr key={u.user_id}>
                  <Td style={{fontWeight:600}}>{u.full_name}</Td>
                  <Td colour={C.muted}>{u.email}</Td>
                  <Td><Badge label={u.role?.replace("_"," ")} colour={u.role?.startsWith("ops")?C.blue:C.purple}/></Td>
                  <Td colour={C.muted}>{u.company_name||<span style={{color:C.dim}}>Ops Team</span>}</Td>
                  <Td colour={C.muted} style={{fontSize:12}}>{u.last_login?fmtDate(u.last_login):"Never logged in"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {showForm && (
        <Modal title="Add User" onClose={()=>{setShowForm(false);reset();}}>
          <ErrBox msg={createA.error}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Full Name" value={form.full_name} onChange={set("full_name")} placeholder="e.g. Sarah Ahmed"/>
            <Inp label="Email" type="email" value={form.email} onChange={set("email")} placeholder="sarah@company.com"/>
            <Inp label="Password" type="password" value={form.password} onChange={set("password")} placeholder="Min 6 characters"/>
            <Sel label="Role" value={form.role} onChange={set("role")}>
              <option value="ops_admin">ops_admin — Full access to everything</option>
              <option value="ops_staff">ops_staff — Operations team member</option>
              <option value="client_admin">client_admin — Client company admin</option>
              <option value="client_user">client_user — Client company user</option>
            </Sel>
          </div>
          <Sel label="Client Company (leave blank for ops team users)" value={form.tenant_id} onChange={set("tenant_id")}>
            <option value="">— No company (ops team) —</option>
            {tenants.map(t=><option key={t.tenant_id} value={t.tenant_id}>{t.company_name} — {t.country||"—"}</option>)}
          </Sel>
          <div style={{fontSize:12,color:C.dim,marginBottom:12}}>Client users must be linked to a company so they only see their own data.</div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>{setShowForm(false);reset();}}>Cancel</Btn>
            <Btn variant="primary" disabled={createA.loading} onClick={doCreate}>{createA.loading?"Creating...":"Add User →"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Route Setup Tab — carrier + warehouse dropdowns from DB ───
function RouteSetupTab({ items, refetch, toast, carriers, warehouses }) {
  const [showForm, setShowForm] = useState(false);
  const { form, set, reset } = useForm({ origin_warehouse_id:"", origin_city:"", dest_city:"", carrier_id:"", transport_mode:"AIR", estimated_hours:"", base_cost_usd:"", risk_score:"0.10" });
  const createA = useSubmit(api.routes.create);

  async function doCreate() {
    try {
      const payload = {
        origin_city:      form.origin_city,
        dest_city:        form.dest_city,
        transport_mode:   form.transport_mode,
        estimated_hours:  parseInt(form.estimated_hours),
        base_cost_usd:    parseFloat(form.base_cost_usd),
        risk_score:       parseFloat(form.risk_score)||0.10,
      };
      if (form.carrier_id)          payload.carrier_id          = parseInt(form.carrier_id);
      if (form.origin_warehouse_id) payload.origin_warehouse_id = parseInt(form.origin_warehouse_id);
      const res = await createA.run(payload);
      toast.success(res.message || "Route added");
      reset(); setShowForm(false); refetch();
    } catch {}
  }

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text}}>🗺 Routes <span style={{fontSize:13,color:C.muted}}>({items?.length||0} total)</span></div>
        <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Add Route</Btn>
      </div>
      <Card>
        {!(items||[]).length ? <EmptyState icon="🗺" title="No routes yet" desc="Add shipping routes between cities. Routes appear in the Route Planner page."/> : (
          <Table>
            <thead><tr><Th>Origin</Th><Th>Destination</Th><Th>Mode</Th><Th>Hours</Th><Th>Cost USD</Th><Th>Carrier</Th><Th>Risk</Th></tr></thead>
            <tbody>
              {items.map(r=>(
                <tr key={r.route_id}>
                  <Td>{r.origin_city_name||r.origin_city}</Td>
                  <Td>{r.dest_city}</Td>
                  <Td><Badge label={r.transport_mode} colour={C.blue}/></Td>
                  <Td colour={C.muted}>{r.estimated_hours}h</Td>
                  <Td colour={C.muted}>${fmtNum(r.base_cost_usd)}</Td>
                  <Td colour={C.muted}>{r.carrier_name||<span style={{color:C.dim}}>—</span>}</Td>
                  <Td colour={C.muted}>{r.risk_score}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {showForm && (
        <Modal title="Add Route" onClose={()=>{setShowForm(false);reset();}} wide>
          <ErrBox msg={createA.error}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Origin City" value={form.origin_city} onChange={set("origin_city")} placeholder="e.g. Mumbai" hint="Type the city name"/>
            <Inp label="Destination City" value={form.dest_city} onChange={set("dest_city")} placeholder="e.g. London"/>
            <Sel label="Origin Warehouse (optional)" value={form.origin_warehouse_id} onChange={set("origin_warehouse_id")}>
              <option value="">— Select warehouse —</option>
              {warehouses.map(w=><option key={w.warehouse_id} value={w.warehouse_id}>{w.name} — {w.city}, {w.country}</option>)}
            </Sel>
            <Sel label="Carrier (optional)" value={form.carrier_id} onChange={set("carrier_id")}>
              <option value="">— Select carrier —</option>
              {carriers.map(c=><option key={c.carrier_id} value={c.carrier_id}>{c.carrier_name} ({c.transport_mode})</option>)}
            </Sel>
            <Sel label="Transport Mode" value={form.transport_mode} onChange={set("transport_mode")}>
              <option value="AIR">AIR — Fastest, required for −70°C</option>
              <option value="SEA">SEA — Cheapest, slowest</option>
              <option value="ROAD">ROAD — Flexible, medium cost</option>
              <option value="RAIL">RAIL — Reliable, medium speed</option>
            </Sel>
            <Inp label="Estimated Hours" type="number" value={form.estimated_hours} onChange={set("estimated_hours")} placeholder="e.g. 12"/>
            <Inp label="Base Cost (USD)" type="number" value={form.base_cost_usd} onChange={set("base_cost_usd")} placeholder="e.g. 2400"/>
            <Inp label="Risk Score (0.00 – 1.00)" type="number" step="0.01" value={form.risk_score} onChange={set("risk_score")} placeholder="e.g. 0.12" hint="Lower = safer route. Used by Route Planner ranking."/>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>{setShowForm(false);reset();}}>Cancel</Btn>
            <Btn variant="primary" disabled={createA.loading} onClick={doCreate}>{createA.loading?"Adding...":"Add Route →"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Admin Setup Page ──────────────────────────────────────────
function AdminSetupPage({ toast }) {
  const [tab, setTab] = useState("tenants");

  const { data:tenants,    refetch:rTenants }    = useFetch(api.tenants.getAll);
  const { data:users,      refetch:rUsers }       = useFetch(api.users.getAll);
  const { data:materials,  refetch:rMaterials }   = useFetch(api.materials.getAll);
  const { data:warehouses, refetch:rWarehouses }  = useFetch(api.warehouses.getAll);
  const { data:carriers,   refetch:rCarriers }    = useFetch(api.carriers.getAll);
  const { data:routes,     refetch:rRoutes }      = useFetch(api.routes.getAll);

  const TABS = [
    { id:"tenants",    label:"Client Companies", count:tenants?.length },
    { id:"users",      label:"Users",            count:users?.length },
    { id:"materials",  label:"Materials",        count:materials?.length },
    { id:"warehouses", label:"Warehouses",       count:warehouses?.length },
    { id:"carriers",   label:"Carriers",         count:carriers?.length },
    { id:"routes",     label:"Routes",           count:routes?.length },
  ];

  return (
    <div>
      <SectionHead sub="Administration" title="System Setup"/>
      <Card style={{marginBottom:14,background:C.surface,borderColor:C.amber+"33"}}>
        <span style={{color:C.amber,fontWeight:600}}>ℹ Everything starts here — </span>
        <span style={{color:C.muted,fontSize:13}}>This page lets you add all the data that runs the platform. Nothing is hardcoded. Add client companies, materials, warehouses, carriers, and routes — then everything else in the app works automatically.</span>
      </Card>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:1}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{padding:"10px 16px",background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?C.blue:"transparent"}`,color:tab===t.id?C.blue:C.muted,cursor:"pointer",fontSize:13,fontWeight:tab===t.id?600:400,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,transition:"color .2s"}}>
            {t.label}
            {t.count!=null&&<span style={{background:C.border,borderRadius:10,padding:"1px 7px",fontSize:11}}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab==="tenants" && <SetupTab items={tenants} refetch={rTenants} toast={toast} title="Client Company" icon="🏢" createFn={api.tenants.create}
        fields={[{key:"company_name",label:"Company Name",placeholder:"e.g. BioTech Pharma Ltd",required:true},{key:"country",label:"Country",placeholder:"e.g. India"},{key:"plan_type",label:"Plan Type",type:"select",options:["Standard","Enterprise"]}]}
        columns={[["company_name","Company"],["country","Country"],["plan_type","Plan"],["shipment_count","Shipments"],["user_count","Users"]]}/>}

      {/* Users — tenant_id is a dropdown from the tenants list, not a text box */}
      {tab==="users" && <UserSetupTab items={users} refetch={rUsers} toast={toast} tenants={tenants||[]}/>}

      {tab==="materials" && <SetupTab items={materials} refetch={rMaterials} toast={toast} title="Material" icon="🧪" createFn={api.materials.create}
        fields={[{key:"material_name",label:"Material Name",placeholder:"e.g. Monoclonal Antibody Solution",required:true},{key:"sku",label:"SKU",placeholder:"e.g. MAB-2024-001",required:true},{key:"temp_zone",label:"Temperature Zone",type:"select",options:[{v:"2_8C",l:"2–8°C"},{v:"minus20C",l:"−20°C"},{v:"minus70C",l:"−70°C"}]},{key:"unit_of_measure",label:"Unit of Measure",placeholder:"e.g. vials, kg, L",required:true},{key:"description",label:"Description",placeholder:"Brief description..."}]}
        columns={[["material_name","Material"],["sku","SKU"],["temp_zone","Temp Zone"],["unit_of_measure","Unit"],["total_stock","Stock"]]}/>}

      {tab==="warehouses" && <SetupTab items={warehouses} refetch={rWarehouses} toast={toast} title="Warehouse" icon="🏭" createFn={api.warehouses.create}
        fields={[{key:"name",label:"Warehouse Name",placeholder:"e.g. Dubai Cold Hub",required:true},{key:"city",label:"City",placeholder:"e.g. Dubai",required:true},{key:"country",label:"Country",placeholder:"e.g. UAE",required:true},{key:"iata_code",label:"IATA Code (optional)",placeholder:"e.g. DXB"},{key:"latitude",label:"Latitude",type:"number",placeholder:"e.g. 25.204",hint:"Used for live map route line"},{key:"longitude",label:"Longitude",type:"number",placeholder:"e.g. 55.270",hint:"Used for live map route line"}]}
        columns={[["name","Name"],["city","City"],["country","Country"],["iata_code","IATA"],["hub_status","Status"]]}/>}

      {tab==="carriers" && <SetupTab items={carriers} refetch={rCarriers} toast={toast} title="Carrier" icon="✈" createFn={api.carriers.create}
        fields={[{key:"carrier_name",label:"Carrier Name",placeholder:"e.g. FedEx Cold Chain",required:true},{key:"transport_mode",label:"Transport Mode",type:"select",options:["AIR","SEA","ROAD","RAIL"]},{key:"certifications",label:"Certifications",placeholder:"e.g. GDP, IATA, WHO"},{key:"contact_email",label:"Contact Email",type:"email",placeholder:"ops@carrier.com"}]}
        columns={[["carrier_name","Carrier"],["transport_mode","Mode"],["certifications","Certifications"],["capacity_pct","Capacity %"],["contact_email","Email"]]}/>}

      {/* Routes — carrier and origin warehouse are dropdowns from DB */}
      {tab==="routes" && <RouteSetupTab items={routes} refetch={rRoutes} toast={toast} carriers={carriers||[]} warehouses={warehouses||[]}/>}
    </div>
  );
}

// Generic setup tab — reused for all 6 sections
function SetupTab({ items, refetch, toast, title, icon, createFn, fields, columns }) {
  const [showForm, setShowForm] = useState(false);
  const initial = Object.fromEntries(fields.map(f=>[f.key,""]));
  const { form, set, reset } = useForm(initial);
  const createA = useSubmit(createFn);

  async function doCreate() {
    try {
      const payload = {...form};
      fields.forEach(f => {
        if (f.type==="number" && payload[f.key]) payload[f.key]=parseFloat(payload[f.key]);
        if (!payload[f.key]&&payload[f.key]!==0) delete payload[f.key];
      });
      const res = await createA.run(payload);
      toast.success(res.message || `${title} added successfully`);
      reset(); setShowForm(false); refetch();
    } catch {}
  }

  const fmtVal = (item, col) => {
    const v = item[col];
    if (v == null || v === "") return <span style={{color:C.dim}}>—</span>;
    if (col==="temp_zone") return <Badge label={TEMP_LABEL[v]||v} colour={TEMP_COL[v]}/>;
    if (col==="transport_mode") return <Badge label={v} colour={C.blue}/>;
    if (col==="hub_status") return <Badge label={v} colour={v==="OPTIMAL"?C.green:v==="STRESSED"?C.amber:C.red}/>;
    if (col==="last_login") return <span style={{color:C.muted,fontSize:12}}>{v?fmtDate(v):"Never"}</span>;
    return String(v);
  };

  return (
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text}}>{icon} {title}s <span style={{fontSize:13,color:C.muted}}>({items?.length||0} total)</span></div>
        <Btn variant="primary" onClick={()=>setShowForm(true)}>+ Add {title}</Btn>
      </div>
      <Card>
        {!(items||[]).length ? <EmptyState icon={icon} title={`No ${title.toLowerCase()}s yet`} desc={`Click "Add ${title}" to add the first one.`}/> : (
          <Table>
            <thead><tr>{columns.map(([,label])=><Th key={label}>{label}</Th>)}</tr></thead>
            <tbody>
              {(items||[]).map((item,i)=>(
                <tr key={i}>
                  {columns.map(([col])=><Td key={col}>{fmtVal(item,col)}</Td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {showForm && (
        <Modal title={`Add ${title}`} onClose={()=>{setShowForm(false);reset();}}>
          <ErrBox msg={createA.error}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {fields.map(f=>(
              <div key={f.key} style={{gridColumn:f.full?"span 2":undefined}}>
                {f.type==="select" ? (
                  <Sel label={f.label} value={form[f.key]} onChange={set(f.key)}>
                    {(f.options||[]).map(o=>typeof o==="object"?<option key={o.v} value={o.v}>{o.l}</option>:<option key={o} value={o}>{o}</option>)}
                  </Sel>
                ) : (
                  <Inp label={f.label} type={f.type||"text"} step={f.step} value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder||""}/>
                )}
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <Btn onClick={()=>{setShowForm(false);reset();}}>Cancel</Btn>
            <Btn variant="primary" disabled={createA.loading} onClick={doCreate}>{createA.loading?"Adding...":"Add "+title+" →"}</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Navigation Config ─────────────────────────────────────────
const OPS_NAV = [
  { section:"Overview",     items:[{ id:"tower",      label:"Control Tower",    icon:"⬡" }] },
  { section:"Operations",   items:[{ id:"procurement",label:"Procurement",      icon:"📋" }, { id:"shipments", label:"Shipments", icon:"📦" }, { id:"inventory",label:"Inventory",icon:"▦" }] },
  { section:"Monitoring",   items:[{ id:"temperature",label:"Temp Monitor",     icon:"❄" }, { id:"compliance",label:"Compliance",icon:"◫" }, { id:"map",       label:"Live Map",  icon:"🗺" }] },
  { section:"Planning",     items:[{ id:"routes",     label:"Route Planner",    icon:"◎" }] },
  { section:"Admin",        items:[{ id:"setup",      label:"System Setup",     icon:"⚙" }] },
];

const CLIENT_NAV = [
  { section:"My Account",   items:[{ id:"dashboard",  label:"My Dashboard",    icon:"◑" }] },
  { section:"Sourcing",     items:[{ id:"catalog",    label:"Request Materials",icon:"🧪" }, { id:"procurement",label:"My Requests",icon:"📋" }] },
  { section:"Shipments",    items:[{ id:"shipments",  label:"My Shipments",    icon:"📦" }] },
  { section:"Cold Chain",   items:[{ id:"temperature",label:"Temp Logs",       icon:"❄" }, { id:"compliance",label:"My Documents",icon:"◫" }] },
  { section:"Tools",        items:[{ id:"routes",     label:"Route Planner",   icon:"◎" }] },
];

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const { user, login, logout, isOps } = useAuth();
  const [page, setPage] = useState("tower");
  const [view, setView] = useState("LOGIN");
  const [stockHighlight, setStockHighlight] = useState(null);
  const toast = useToast();
  const { liveAlerts, connected, dismissAlert } = useSocket(user);

  const { data:allShipments, refetch:refetchAll } = useFetch(() => user ? api.orders.getAll() : Promise.resolve([]), [!!user]);

  // Background sync for all fleet data (Map, Temp Monitor, etc.) every 10s
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      refetchAll();
    }, 10000);
    return () => clearInterval(t);
  }, [user, refetchAll]);
  const { data:allMaterials } = useFetch(() => user ? api.materials.getAll() : Promise.resolve([]), [!!user]);

  async function handleLogin(email, password) {
    const res = await login(email, password);
    setPage(res.role?.startsWith("ops") ? "tower" : "dashboard");
  }

  function handleLogout() { logout(); setPage("tower"); }

  if (!user) {
    return view === "SIGNUP" ? (
      <SignupPage onBackToLogin={() => setView("LOGIN")} />
    ) : (
      <LoginPage onLogin={handleLogin} onGoSignup={() => setView("SIGNUP")} />
    );
  }

  const nav    = isOps ? OPS_NAV : CLIENT_NAV;
  const bannerH = liveAlerts.length ? 42 : 0;

  const pages = {
    tower:       <ControlTower user={user} setPage={setPage} connected={connected} onStockAction={(a)=>{ setStockHighlight(a); setPage("inventory"); }}/>,
    procurement: <ProcurementPage isOps={isOps} toast={toast} onUpdate={refetchAll}/>,
    shipments:   <ShipmentsPage   isOps={isOps} toast={toast} onUpdate={refetchAll}/>,
    inventory:   <InventoryPage   toast={toast} highlight={stockHighlight} onHighlightClear={() => setStockHighlight(null)}/>,
    map:         <LiveMapPage     shipments={allShipments}/>,
    routes:      <RoutePlannerPage/>,
    temperature: <TempMonitorPage isOps={isOps} shipments={allShipments} toast={toast}/>,
    compliance:  <CompliancePage  isOps={isOps} shipments={allShipments} toast={toast}/>,
    setup:       <AdminSetupPage  toast={toast}/>,
    dashboard:   <ClientDashboard user={user}/>,
    catalog:     <MaterialCatalogPage toast={toast}/>,
  };

  return (
    <div style={{fontFamily:"Inter,system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text}}>
      <style>{`*{box-sizing:border-box}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Live Alert Banner */}
      <AlertBanner 
        alerts={liveAlerts} 
        onDismiss={dismissAlert} 
        onAction={(a) => {
          setStockHighlight(a);
          setPage("inventory");
          dismissAlert();
        }}
      />

      {/* Top Bar */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,height:56,display:"flex",alignItems:"center",padding:"0 20px",gap:16,position:"sticky",top:0,zIndex:800}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${C.blue},${C.cyan})`,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>❄</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,letterSpacing:".04em"}}>CryoChain</div>
            <div style={{fontSize:10,color:C.muted,marginTop:-1}}>Cold Chain Logistics</div>
          </div>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,fontSize:13}}>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:connected?C.green:C.dim,display:"block"}}/>
            <span style={{color:C.muted}}>{connected?"Live":"Offline"}</span>
          </div>
          <div style={{width:1,height:20,background:C.border}}/>
          <span style={{color:C.text,fontWeight:500}}>{user.name}</span>
          <Badge label={user.role?.replace("_"," ")} colour={isOps?C.blue:C.purple}/>
          <Btn style={{fontSize:12,padding:"5px 12px"}} onClick={handleLogout}>Sign out</Btn>
        </div>
      </div>

      <div style={{display:"flex",marginTop:bannerH}}>
        {/* Sidebar */}
        <div style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,padding:"12px 0",position:"sticky",top:56+bannerH,height:`calc(100vh - ${56+bannerH}px)`,overflowY:"auto",flexShrink:0}}>
          {nav.map(section=>(
            <div key={section.section} style={{marginBottom:8}}>
              <div style={{padding:"4px 16px 6px",fontSize:10,color:C.dim,letterSpacing:".12em",textTransform:"uppercase",fontWeight:600}}>{section.section}</div>
              {section.items.map(item=>{
                const active = page===item.id;
                return (
                  <div key={item.id} onClick={()=>setPage(item.id)}
                    style={{padding:"9px 16px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13,fontWeight:active?600:400,color:active?C.blue:C.muted,background:active?C.blue+"0e":"transparent",borderLeft:`2px solid ${active?C.blue:"transparent"}`,transition:"all .15s"}}
                    onMouseEnter={e=>{if(!active){e.currentTarget.style.background=C.border+"44";e.currentTarget.style.color=C.text;}}}
                    onMouseLeave={e=>{if(!active){e.currentTarget.style.background="transparent";e.currentTarget.style.color=C.muted;}}}>
                    <span style={{fontSize:15}}>{item.icon}</span>
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Sidebar footer */}
          <div style={{marginTop:"auto",borderTop:`1px solid ${C.border}`,padding:"12px 16px",fontSize:11,color:C.dim,lineHeight:1.9}}>
            <div style={{fontWeight:600,color:C.muted,marginBottom:4}}>Active Features</div>
            {["socket.io · real-time alerts","node-cron · daily checks","multer · file uploads","joi · validation","pdfkit · PDF reports","redis · caching"].map(f=><div key={f}>{f}</div>)}
          </div>
        </div>

        {/* Main Content */}
        <div style={{flex:1,padding:page==="map"?0:24,overflowY:"auto",minWidth:0}}>
          {pages[page] || <div style={{color:C.muted,padding:40,textAlign:"center"}}>Page not found</div>}
        </div>
      </div>

      {/* Toast Notifications */}
      <Toasts toasts={toast.toasts}/>
    </div>
  );
}
