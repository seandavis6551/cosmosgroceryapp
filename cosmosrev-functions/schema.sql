-- cosmosrev database schema
-- Run against: orbit-sql-centralus / cosmosrev
-- Replaces Dataverse entities: sol_productses, sol_cosmosinventories, sol_categorieses, sol_sales

CREATE TABLE Categories (
  id            UNIQUEIDENTIFIER  DEFAULT NEWID()    PRIMARY KEY,
  name          NVARCHAR(255)     NOT NULL,
  is_deleted    BIT               DEFAULT 0          NOT NULL,
  created_at    DATETIME2         DEFAULT GETUTCDATE()
);

CREATE TABLE Products (
  id                    UNIQUEIDENTIFIER  DEFAULT NEWID()    PRIMARY KEY,
  product_code          NVARCHAR(20),                        -- business key e.g. PRD-001
  name                  NVARCHAR(255)     NOT NULL,
  sku                   NVARCHAR(100),
  barcode               NVARCHAR(100),
  unit_price            DECIMAL(18,4)     DEFAULT 0,
  cost_price            DECIMAL(18,4),
  description           NVARCHAR(MAX),
  unit                  NVARCHAR(50),
  is_active             BIT               DEFAULT 1          NOT NULL,
  is_deleted            BIT               DEFAULT 0          NOT NULL,
  loyverse_item_id      NVARCHAR(100),
  loyverse_variant_id   NVARCHAR(100),
  loyverse_sync_status  INT,
  image_url             NVARCHAR(MAX),
  category_id           UNIQUEIDENTIFIER  REFERENCES Categories(id),
  created_at            DATETIME2         DEFAULT GETUTCDATE(),
  updated_at            DATETIME2         DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Products_loyverse_item_id    ON Products (loyverse_item_id)    WHERE loyverse_item_id IS NOT NULL;
CREATE INDEX IX_Products_loyverse_variant_id ON Products (loyverse_variant_id) WHERE loyverse_variant_id IS NOT NULL;
CREATE INDEX IX_Products_active              ON Products (is_deleted, is_active);

CREATE TABLE Inventory (
  id                UNIQUEIDENTIFIER  DEFAULT NEWID()    PRIMARY KEY,
  inventory_code    NVARCHAR(20),                        -- business key e.g. INV-001
  product_id        UNIQUEIDENTIFIER  NOT NULL           REFERENCES Products(id),
  quantity_on_hand  DECIMAL(18,4)     DEFAULT 0,
  reorder_level     DECIMAL(18,4)     DEFAULT 10,
  is_deleted        BIT               DEFAULT 0          NOT NULL,
  created_at        DATETIME2         DEFAULT GETUTCDATE(),
  updated_at        DATETIME2         DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Inventory_product_id ON Inventory (product_id) WHERE is_deleted = 0;

CREATE TABLE Sales (
  id                    UNIQUEIDENTIFIER  DEFAULT NEWID()    PRIMARY KEY,
  name                  NVARCHAR(255),                       -- receipt_number + line_number
  receipt_number        NVARCHAR(100),
  line_number           INT,
  receipt_date          DATETIME2,
  receipt_type          NVARCHAR(20),
  store_id              NVARCHAR(100),
  item_name             NVARCHAR(255),
  loyverse_variant_id   NVARCHAR(100),
  quantity              DECIMAL(18,4),
  unit_price            DECIMAL(18,4),
  line_total            DECIMAL(18,4),
  cost                  DECIMAL(18,4),
  gross_margin          DECIMAL(18,4),
  product_id            UNIQUEIDENTIFIER  REFERENCES Products(id),
  created_at            DATETIME2         DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Sales_receipt_number ON Sales (receipt_number);
CREATE INDEX IX_Sales_receipt_date   ON Sales (receipt_date);
