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
    console.log("1. Fortifying Database Schema...");
    // Check if unique index already exists
    const [indexes] = await db.query("SHOW INDEX FROM inventory WHERE Key_name = 'uidx_mat_wh'");
    if (indexes.length === 0) {
      await db.query("ALTER TABLE inventory ADD UNIQUE INDEX uidx_mat_wh (material_id, warehouse_id)");
      console.log("✅ Unique constraint added.");
    }

    console.log("2. Universalizing Global Stock Room...");
    const [mats] = await db.query("SELECT material_id FROM raw_materials");
    const [whs]  = await db.query("SELECT warehouse_id FROM warehouses");

    for (const m of mats) {
      for (const w of whs) {
        await db.query(`
          INSERT INTO inventory (material_id, warehouse_id, quantity_on_hand, reorder_threshold)
          VALUES (?, ?, 1500, 200)
          ON DUPLICATE KEY UPDATE quantity_on_hand = GREATEST(quantity_on_hand, 1000)
        `, [m.material_id, w.warehouse_id]);
      }
    }
    console.log(`✅ Success! Seeded stock across ${whs.length} hubs for ${mats.length} materials.`);
  } catch (e) {
    console.warn("⚠️ Migration warning:", e.message);
  }

  process.exit(0);
}
run();
