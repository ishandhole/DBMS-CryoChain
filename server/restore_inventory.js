// ================================================================
//  restore_inventory.js (Data Repair Script)
//
//  This script is a maintenance utility. If the database ever gets
//  corrupted where inventory counts are wrong, this script queries the 
//  master ledger (`shipment_orders`) and recalculates the proper stock
//  deductions for every historical order.
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
    const [orders] = await db.query("SELECT material_id, origin_warehouse_id, quantity_ordered FROM shipment_orders WHERE origin_warehouse_id IS NOT NULL");
    console.log(`Reconciling ${orders.length} past shipments with current inventory...`);

    for (const o of orders) {
      await db.query(
        "UPDATE inventory SET quantity_on_hand = quantity_on_hand - ? WHERE material_id=? AND warehouse_id=?",
        [o.quantity_ordered, o.material_id, o.origin_warehouse_id]
      );
      console.log(`✅ Subtracted ${o.quantity_ordered} units of Mat #${o.material_id} from Hub #${o.origin_warehouse_id}`);
    }

    console.log("✅ Inventory successfully reconciled with shipment history.");
  } catch (e) {
    console.error("❌ Sync Error:", e.message);
  }

  process.exit(0);
}
run();
