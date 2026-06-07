# CosmosRev Functions — Dataverse ↔ Loyverse sync

Azure Functions that keep the **Dataverse** product/inventory tables and the
**Loyverse** POS in sync.

**Deployed app:** `cosmosrev-functions` (resource group `Cosmos-rg`)
**Host:** `https://cosmosrev-functions-brahbdbrhvb0c5fy.eastus-01.azurewebsites.net`

## Source of truth

- **Products + stock corrections → the app (Dataverse) is master.** You create and
  edit products and adjust stock in the inventory app, then push up to Loyverse via
  the **Sync All** button. (New products originate in the app — there is intentionally
  **no** Loyverse→Dataverse product-creation webhook.)
- **Sales / stock movements → Loyverse is master.** A sale at the till (POS 1 or POS 2
  — both ring against the single "Cosmos Rev" store, `ce2a17ef…`) decrements Loyverse
  stock, which flows back into Dataverse automatically via webhook.

> ⚠️ **Sync All overwrites Loyverse stock with Dataverse's numbers.** Set the correct
> counts in the app *before* pressing it, or it will overwrite sale-adjusted / real
> Loyverse counts (including zeroing items that are 0 in Dataverse).
>
> Rule of thumb: edit stock in **one** place per event. Sales → till (auto).
> Restocks/corrections → app → Sync All.

## Functions

| Function | Direction | Trigger | Auth | What it does |
|---|---|---|---|---|
| `loyverseInventoryWebhook` | Loyverse → Dataverse | Loyverse `inventory_levels.update` webhook | anonymous + `?token=` secret | Mirrors new on-hand qty into `sol_cosmosinventories`. How a sale reaches the app + storefront. |
| `syncInventory` | Dataverse → Loyverse | "Sync All" button | function key | Pushes Dataverse on-hand qty up to Loyverse for every linked product. **Overwrites** Loyverse stock. |
| `syncProduct` | Dataverse → Loyverse | product save (single) | function key | Create-or-update one product in Loyverse (sets `track_stock` + `low_stock`, pushes stock). Body: `{ "productId": "<guid>" }`. |
| `syncProducts` | Dataverse → Loyverse | bulk backfill / Sync All | function key | Creates all unsynced (no Loyverse ID) products. |
| `getProducts` / `getCategories` | Dataverse → storefront | React app | function key | Public catalog reads. |
| `createInventoryRecord` | — | — | function key | Creates an empty inventory row for a product. |

The inventory app's **Sync All** button calls `triggerSync()`, which runs
`syncProducts` **then** `syncInventory`.

### Linking & stock model
- Products are linked by matching Loyverse **`reference_id`** ↔ Dataverse **`sol_sku`**;
  the live Loyverse `item_id` / `variant_id` are stored on the product
  (`sol_loyverse_item_id` / `sol_loyverse_variant_id`).
- **Loyverse rejects stock counts unless the item has `track_stock: true`.** All synced
  items must have tracking on, or quantities won't forward. `createItem`/`updateItem`
  now always set `track_stock: true`.
- **Low stock:** Dataverse `sol_reorderlevel` is written to the Loyverse variant's
  `low_stock` (on `variant.stores[]`) by `createItem`/`updateItem` and the
  `enable-loyverse-tracking.js` script.

## Helper scripts (run locally with Node; read creds from `local.settings.json`)

| Script | Purpose |
|---|---|
| `node check-sync.js` | Read-only drift check: synced/unsynced counts; flags Dataverse links pointing at deleted Loyverse items (404). |
| `node fix-loyverse-links.js [--apply]` | Repair stale links — matches by SKU, writes current live Loyverse IDs back to Dataverse. Dry-run unless `--apply`. |
| `node import-from-loyverse.js [--apply]` | Reverse backfill — create Dataverse products (+ inventory rows) from Loyverse items missing in Dataverse. Skips items with no `reference_id` unless `--include-no-sku`. |
| `node enable-loyverse-tracking.js [--apply]` | Turn on `track_stock` for linked Loyverse items and set `low_stock` from the Dataverse reorder level. Required for stock to forward. |
| `node register-webhook.js list \| add <url> \| del <id>` | Manage the Loyverse `inventory_levels.update` webhook (`add` appends the `?token=` secret). |

> ⚠️ These scripts and `local.settings.json` contain/read secrets — they are
> **git-ignored**. Do not commit.

## Environment / app settings

Mirror these in `local.settings.json` (local) and the Function App application
settings (Azure): `DATAVERSE_URL`, `DATAVERSE_CLIENT_ID`, `DATAVERSE_CLIENT_SECRET`,
`DATAVERSE_TENANT_ID`, `LOYVERSE_API_TOKEN`, `LOYVERSE_STORE_ID`,
`LOYVERSE_WEBHOOK_SECRET`.

The inventory app needs `VITE_FUNCTIONS_URL` (the `/api` base) and
`VITE_FUNCTIONS_KEY` (a Function App host key) in its `.env` for Sync All.

## Deployment

1. Publish: `func azure functionapp publish cosmosrev-functions --javascript`
2. Ensure app settings above are set (incl. a random `LOYVERSE_WEBHOOK_SECRET`).
3. Register the webhook (once):
   `node register-webhook.js add https://cosmosrev-functions-brahbdbrhvb0c5fy.eastus-01.azurewebsites.net/api/loyverseInventoryWebhook`
4. Sync All button → `POST {host}/api/syncInventory?code=<host-key>`.
5. CORS: the Function App must allow the inventory app's origin (deployed static web
   app + `http://localhost:5173` for local dev).

## Cost notes — keep it at $0 extra

- **Loyverse API + webhooks:** free. **Azure Functions:** within the monthly free
  grant for this volume. **Dataverse:** already licensed; sync just uses API calls.
- ⚠️ **Avoid Power Automate's HTTP action** to trigger these functions — it's a
  **premium connector** and adds licensing cost. Call the functions directly from the
  app instead. The Loyverse → Dataverse direction already bypasses Power Automate
  entirely (webhook → Azure).
