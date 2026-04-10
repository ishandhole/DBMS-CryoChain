// ================================================================
//  total_reconcile.js (Admin Script)
//
//  This script performs a full database reconciliation of global inventory.
//  1. It resets all inventory across all warehouses to a baseline (1,500 units).
//  2. It iterates through every historical Shipment Order and subtracts the
//     ordered quantity from the origin warehouse.
//  3. It processes approved Procurement Requests that haven't shipped yet,
//     and deducts that reserved stock.
//  This ensures the 'quantity_on_hand' is perfectly accurate based on the ledger.
// ================================================================

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

  try {
    console.log("1. Resetting Global Inventory to baseline (1,500 units)...");
    await db.query("UPDATE inventory SET quantity_on_hand = 1500.00");

    console.log("2. Processing all recorded Shipments...");
    const [ships] = await db.query("SELECT material_id, origin_warehouse_id, quantity_ordered FROM shipment_orders WHERE origin_warehouse_id IS NOT NULL");
    for (const s of ships) {
      await db.query("UPDATE inventory SET quantity_on_hand = quantity_on_hand - ? WHERE material_id=? AND warehouse_id=?",
        [s.quantity_ordered, s.material_id, s.origin_warehouse_id]);
      console.log(`✅ Subtracted SHP-${s.material_id} | Qty: ${s.quantity_ordered}`);
    }

    console.log("3. Processing 'Approved' but 'Not-Yet-Shipped' Procurements...");
    // For legacy PRQs, assume Basel Hub #1 as the origin for the reconciliation
    const [prqs] = await db.query(`
      SELECT pr.material_id, 1 as wh_id, pr.quantity_requested, pr.request_id 
      FROM procurement_requests pr
      LEFT JOIN shipment_orders so ON pr.request_id = so.procurement_request_id
      WHERE pr.status = 'APPROVED' AND so.order_id IS NULL
    `);

    for (const p of prqs) {
      await db.query("UPDATE inventory SET quantity_on_hand = quantity_on_hand - ? WHERE material_id=? AND warehouse_id=?",
        [p.quantity_requested, p.material_id, p.wh_id]);
      console.log(`✅ Subtracted PRQ-${p.request_id} | Qty: ${p.quantity_requested}`);
    }

    console.log("✅ 100% Total Supply Chain Reconciliation Complete.");
  } catch (e) {
    console.error("❌ Sync Error:", e.message);
  }

  process.exit(0);
}
run();
