# Sales ledger table — `sol_sale` (collection `sol_sales`)

Append-only log of Loyverse receipt line items. Powers sales & accounting reporting.
Written by the `loyverseSalesWebhook` function (one row per receipt line item).

## Create in Power Apps (make.powerapps.com → Tables → New table)

- **Display name:** `Sale`  →  Dataverse makes the plural collection **`sol_sales`** (the function targets exactly this).
- **Primary column:** `Name` (text) — the function fills it with `<receipt#>-<line#>`.

> ⚠️ Confirm the table's plural/collection name resolves to `sol_sales`. If your
> publisher prefix or pluralization differs, the function's `sol_sales` path must match.

## Columns to add

| Display name | Schema name | Type | Notes |
|---|---|---|---|
| Receipt Number | `sol_receiptnumber` | Text (100) | Loyverse receipt_number. Used to dedupe (delete-then-insert). |
| Line Number | `sol_linenumber` | Whole Number | Position of the line within the receipt. |
| Receipt Date | `sol_receiptdate` | Date and Time | When the sale happened. |
| Receipt Type | `sol_receipttype` | Text (20) | `SALE` or `REFUND`. |
| Store ID | `sol_storeid` | Text (100) | Loyverse store id. |
| Item Name | `sol_itemname` | Text (200) | Snapshot of the item name at sale time. |
| Loyverse Variant ID | `sol_loyversevariantid` | Text (100) | Join key back to `sol_productses.sol_loyverse_variant_id`. |
| Quantity | `sol_quantity` | Decimal | Negative for REFUND. |
| Unit Price | `sol_unitprice` | Currency (or Decimal) | Price per unit. |
| Line Total | `sol_linetotal` | Currency (or Decimal) | Final line revenue (after discount). Negative for REFUND. |
| Cost | `sol_cost` | Currency (or Decimal) | COGS for the line (from Loyverse cost_total). Negative for REFUND. |
| Gross Margin | `sol_grossmargin` | Currency (or Decimal) | `Line Total − Cost`, computed at write time. |

### Optional (recommended) — link to the catalog product
| Display name | Schema name | Type | Notes |
|---|---|---|---|
| Product | `sol_ProductID` | Lookup → `sol_productses` | Links the sale to the product (cost, category, etc.). |

The function only writes this lookup when the env var **`SALES_PRODUCT_LOOKUP_BIND`**
is set to the exact OData bind key — e.g. `sol_ProductID@odata.bind`. Lookup nav-property
names vary in this org, so leave it unset at first; the ledger still works and reports can
join on `sol_loyversevariantid`. Once you confirm the bind key in Power Apps, set the env
var to turn linking on.

## After the table exists

1. Deploy: `func azure functionapp publish cosmosrev-functions --javascript`
2. Register the webhook (note the 3rd arg = type):
   ```
   node register-webhook.js add https://cosmosrev-functions-brahbdbrhvb0c5fy.eastus-01.azurewebsites.net/api/loyverseSalesWebhook receipts.update
   ```
3. Make a test sale (or refund) in Loyverse and confirm a row appears in `sol_sales`.
4. (Optional) Set `SALES_PRODUCT_LOOKUP_BIND` in the Function App settings to enable product links.

## Reporting ideas once data accumulates
- Revenue = `SUM(sol_linetotal)`; Gross margin = `SUM(sol_grossmargin)`.
- Best/worst sellers = group by `sol_itemname` / product.
- Shrinkage = received − `SUM(sol_quantity)` − adjustments vs. actual on-hand.
