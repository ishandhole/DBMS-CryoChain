const mysql = require("mysql2/promise");
require("dotenv").config();

async function run() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "cryochain",
    port: process.env.DB_PORT || 3306
  });

  const URGENCY_COST = { CRITICAL: 4200, STANDARD: 2400, ECONOMY: 890 };

  async function findBestRoute(origin_city, dest_city, temp_zone, urgency) {
    try {
      let q = `
        SELECT r.*, c.carrier_name, c.capacity_pct
        FROM routes r JOIN carriers c ON r.carrier_id=c.carrier_id
        WHERE c.is_active=1 AND r.is_active=1
      `;
      const params = [];
      if (origin_city) { q += " AND r.origin_city=?"; params.push(origin_city); }
      // Fuzzy match for dest_city since old shipments might have just "London" or "mumbai"
      if (dest_city) { q += " AND LOWER(?) LIKE CONCAT('%', LOWER(r.dest_city), '%')"; params.push(dest_city); }

      const [all] = await db.query(q, params);
      const scored = [];
      for (const r of all) {
        if (temp_zone === "minus70C" && ["SEA","ROAD"].includes(r.transport_mode)) continue;
        if (urgency === "CRITICAL" && r.transport_mode === "SEA") continue;

        let score = parseFloat(r.risk_score);
        if (r.capacity_pct > 85) score += 0.10;
        if (urgency === "CRITICAL" && r.transport_mode === "AIR") score -= 0.05;
        else if (urgency === "ECONOMY") {
          if (["SEA","ROAD"].includes(r.transport_mode)) score -= 0.15;
          if (r.transport_mode === "AIR") score += 0.05;
        }
        scored.push({ ...r, adjusted_score: parseFloat(score.toFixed(2)) });
      }
      scored.sort((a,b) => a.adjusted_score - b.adjusted_score);
      if (scored.length > 0) {
        const best = scored[0];
        const mult = urgency === "CRITICAL" ? 1.5 : urgency === "ECONOMY" ? 0.8 : 1.0;
        return { cost: best.base_cost_usd * mult, risk: best.adjusted_score, rid: best.route_id, cid: best.carrier_id };
      }
    } catch (e) { console.error(e); }
    return { cost: URGENCY_COST[urgency]||2400, risk: 0.15, rid: null, cid: null };
  }

  const [orders] = await db.query("SELECT o.*, w.city as origin_city FROM shipment_orders o LEFT JOIN warehouses w ON o.origin_warehouse_id=w.warehouse_id");
  console.log(`Auditing ${orders.length} shipments...`);

  for (const o of orders) {
    const pricing = await findBestRoute(o.origin_city, o.dest_city, o.temp_zone, o.urgency);
    console.log(`Repricing SHP-${o.order_id} (${o.origin_city} -> ${o.dest_city}): $${o.estimated_cost_usd} -> $${pricing.cost}`);
    
    await db.query("UPDATE shipment_orders SET estimated_cost_usd=?, risk_score=? WHERE order_id=?", 
      [pricing.cost, pricing.risk, o.order_id]);
    
    // Update tracking with real carrier/route if possible
    if (pricing.cid || pricing.rid) {
      await db.query("UPDATE shipment_tracking SET carrier_id=COALESCE(carrier_id,?), route_id=COALESCE(route_id,?) WHERE order_id=?",
        [pricing.cid, pricing.rid, o.order_id]);
    }
  }

  console.log("Done!");
  process.exit(0);
}
run();
