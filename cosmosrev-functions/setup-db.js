// One-time DB setup: creates tables and adds the function app MI as a DB user.
// Run as: node setup-db.js
// Requires: az login (your account must be the Azure AD admin on orbit-sql-centralus)

const sql = require('mssql')

const SERVER = 'orbit-sql-centralus.database.windows.net'
const DATABASE = 'cosmosrev'
const MI_NAME = 'cosmosrev-functions'  // function app name = MI display name

const config = {
  server: SERVER,
  database: DATABASE,
  authentication: { type: 'azure-active-directory-default' },
  options: { encrypt: true, trustServerCertificate: false },
}

const SCHEMA = `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Categories')
CREATE TABLE Categories (
  id          UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  name        NVARCHAR(255)    NOT NULL,
  is_deleted  BIT              DEFAULT 0 NOT NULL,
  created_at  DATETIME2        DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Products')
CREATE TABLE Products (
  id                    UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  product_code          NVARCHAR(20),
  name                  NVARCHAR(255)    NOT NULL,
  sku                   NVARCHAR(100),
  barcode               NVARCHAR(100),
  unit_price            DECIMAL(18,4)    DEFAULT 0,
  cost_price            DECIMAL(18,4),
  description           NVARCHAR(MAX),
  unit                  NVARCHAR(50),
  is_active             BIT              DEFAULT 1 NOT NULL,
  is_deleted            BIT              DEFAULT 0 NOT NULL,
  loyverse_item_id      NVARCHAR(100),
  loyverse_variant_id   NVARCHAR(100),
  loyverse_sync_status  INT,
  image_url             NVARCHAR(MAX),
  category_id           UNIQUEIDENTIFIER REFERENCES Categories(id),
  created_at            DATETIME2        DEFAULT GETUTCDATE(),
  updated_at            DATETIME2        DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_loyverse_item_id')
  CREATE INDEX IX_Products_loyverse_item_id ON Products (loyverse_item_id) WHERE loyverse_item_id IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Products_loyverse_variant_id')
  CREATE INDEX IX_Products_loyverse_variant_id ON Products (loyverse_variant_id) WHERE loyverse_variant_id IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Inventory')
CREATE TABLE Inventory (
  id                UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  inventory_code    NVARCHAR(20),
  product_id        UNIQUEIDENTIFIER NOT NULL REFERENCES Products(id),
  quantity_on_hand  DECIMAL(18,4)    DEFAULT 0,
  reorder_level     DECIMAL(18,4)    DEFAULT 10,
  is_deleted        BIT              DEFAULT 0 NOT NULL,
  created_at        DATETIME2        DEFAULT GETUTCDATE(),
  updated_at        DATETIME2        DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Inventory_product_id')
  CREATE INDEX IX_Inventory_product_id ON Inventory (product_id) WHERE is_deleted = 0;

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Sales')
CREATE TABLE Sales (
  id                  UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
  name                NVARCHAR(255),
  receipt_number      NVARCHAR(100),
  line_number         INT,
  receipt_date        DATETIME2,
  receipt_type        NVARCHAR(20),
  store_id            NVARCHAR(100),
  item_name           NVARCHAR(255),
  loyverse_variant_id NVARCHAR(100),
  quantity            DECIMAL(18,4),
  unit_price          DECIMAL(18,4),
  line_total          DECIMAL(18,4),
  cost                DECIMAL(18,4),
  gross_margin        DECIMAL(18,4),
  product_id          UNIQUEIDENTIFIER REFERENCES Products(id),
  created_at          DATETIME2        DEFAULT GETUTCDATE()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sales_receipt_number')
  CREATE INDEX IX_Sales_receipt_number ON Sales (receipt_number);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sales_receipt_date')
  CREATE INDEX IX_Sales_receipt_date ON Sales (receipt_date);
`

async function run() {
  console.log(`Connecting to ${SERVER}/${DATABASE} as current az login user...`)
  const pool = await sql.connect(config)
  console.log('Connected.')

  // Create schema (idempotent — IF NOT EXISTS guards on every object)
  console.log('Creating tables and indexes...')
  for (const statement of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) {
    await pool.request().query(statement)
  }
  console.log('Schema ready.')

  // Add the function app MI as a DB user with read/write access
  console.log(`Adding MI user [${MI_NAME}]...`)
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = '${MI_NAME}')
      BEGIN
        CREATE USER [${MI_NAME}] FROM EXTERNAL PROVIDER;
        ALTER ROLE db_datareader ADD MEMBER [${MI_NAME}];
        ALTER ROLE db_datawriter ADD MEMBER [${MI_NAME}];
        PRINT 'MI user created and roles assigned.';
      END
      ELSE
        PRINT 'MI user already exists.';
    `)
    console.log(`MI user [${MI_NAME}] ready.`)
  } catch (err) {
    console.warn(`MI user setup warning (may need AAD admin): ${err.message}`)
  }

  await pool.close()
  console.log('Done.')
}

run().catch((err) => { console.error(err.message); process.exit(1) })
