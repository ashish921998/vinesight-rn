# VineSight Offline Architecture

## Overview

VineSight uses **PowerSync** to provide offline-first capabilities. PowerSync creates a local SQLite database on the device that automatically syncs with the Supabase backend. This means the app works fully without network connectivity and syncs data when back online.

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                  React Native App                │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐  │
│  │  UI Layer    │    │  TanStack React Query   │  │
│  │  (Screens)   │◄──►│  (Cache + State)        │  │
│  └──────────────┘    └────────────────────────┘  │
│                              │                    │
│                    ┌─────────┴─────────┐          │
│                    ▼                   ▼          │
│  ┌──────────────────────┐  ┌────────────────┐    │
│  │  PowerSync Hooks     │  │ Supabase Hooks │    │
│  │  (Offline-first)     │  │ (Online-only)  │    │
│  │  use-powersync-*.ts  │  │ use-farms.ts   │    │
│  └──────────┬───────────┘  └───────┬────────┘    │
│             │                      │              │
│             ▼                      ▼              │
│  ┌──────────────────┐   ┌──────────────────┐     │
│  │  Local SQLite DB  │   │  Supabase Client │     │
│  │  (PowerSync)      │   │  (Direct API)    │     │
│  └────────┬─────────┘   └──────────────────┘     │
│           │                                       │
└───────────┼───────────────────────────────────────┘
            │
            ▼ (Background Sync)
┌───────────────────────┐
│  PowerSync Cloud      │
│  (Sync Service)       │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────┐
│  Supabase (Postgres)  │
│  (Source of Truth)     │
└───────────────────────┘
```

## How It Works

### 1. Local-First Reads

When a screen needs data (e.g., list of farms), the PowerSync hooks query the **local SQLite database** instead of making a network request. This provides:

- **Instant response** — No network latency
- **Offline access** — Data is available even without connectivity
- **Reduced API calls** — Less load on Supabase

```typescript
// Before (online-only):
const { data: farms } = useFarms();

// After (offline-first):
const { data: farms } = usePowerSyncFarms();
```

### 2. Background Sync

PowerSync runs a background sync process that:

1. **Downloads** changes from Supabase → local SQLite (via PowerSync Cloud)
2. **Uploads** local changes from SQLite → Supabase (via the upload queue)

This happens automatically and transparently to the UI.

### 3. Upload Queue (Writes)

When the user creates or updates data while offline:

1. The change is written to the **local SQLite database** immediately
2. The change is added to PowerSync's **upload queue**
3. When connectivity is restored, queued changes are **uploaded to Supabase** in order
4. The `SupabaseConnector.uploadData()` method processes each queued operation

### 4. Conflict Resolution

For v1, we use a **Last-Write-Wins (LWW)** strategy:

- If two devices modify the same record, the most recent write wins
- PowerSync handles this automatically via its sync protocol
- The `SupabaseConnector` uses `upsert` for PUT operations to handle conflicts

## File Structure

```
src/lib/powersync/
├── index.ts          # Barrel exports
├── schema.ts         # PowerSync schema (mirrors Supabase tables)
├── connector.ts      # Supabase backend connector (auth + upload)
├── system.ts         # Database instance + initialization
└── provider.tsx      # React context provider

src/hooks/
├── use-network-status.ts       # Network connectivity hook
├── use-powersync-farms.ts      # Offline-first farm queries
├── use-powersync-tasks.ts      # Offline-first task queries
└── use-powersync-workers.ts    # Offline-first worker queries
```

## Synced Tables

The following tables are synced for offline access (defined in `src/lib/powersync/schema.ts`):

| Table | Priority | Reason |
|-------|----------|--------|
| `farms` | Critical | Core entity, needed for all operations |
| `farm_seasons` | Critical | Season-scoped queries |
| `task_reminders` | Critical | Field workers need to see tasks offline |
| `workers` | Critical | Attendance tracking in the field |
| `worker_attendance` | Critical | Mark attendance without connectivity |
| `profiles` | High | User context needed offline |
| `irrigation_records` | High | Common field activity |
| `spray_records` | High | Spray logging in the field |
| `fertigation_records` | High | Fertigation logging |
| `harvest_records` | High | Harvest data capture |
| `expense_records` | Medium | Expense tracking |
| `daily_notes` | Medium | Quick notes in the field |
| `warehouse_items` | Medium | Inventory reference |

## Network Status

The `useNetworkStatus()` hook provides real-time connectivity information:

```typescript
const { isOnline, isOffline, connectionType } = useNetworkStatus();

// Show offline banner
if (isOffline) {
  return <OfflineBanner />;
}
```

## Setup Requirements

### Environment Variables

Add to your `.env` file:

```
EXPO_PUBLIC_POWERSYNC_URL=your_powersync_instance_url
```

### PowerSync Cloud Setup

1. Create a PowerSync account at [powersync.com](https://www.powersync.com/)
2. Create a new instance and connect it to your Supabase project
3. Configure sync rules to match the schema in `src/lib/powersync/schema.ts`
4. Copy the instance URL to `EXPO_PUBLIC_POWERSYNC_URL`

### Sync Rules (PowerSync Dashboard)

Configure these sync rules in the PowerSync dashboard to match the schema:

```yaml
bucket_definitions:
  user_data:
    parameters: SELECT token->>'sub' as user_id
    data:
      - SELECT * FROM farms WHERE user_id = bucket.user_id
      - SELECT * FROM farm_seasons WHERE user_id = bucket.user_id
      - SELECT * FROM profiles WHERE id = bucket.user_id
      - SELECT * FROM workers WHERE user_id = bucket.user_id
      - SELECT * FROM warehouse_items WHERE user_id = bucket.user_id
      # Records linked through farms
      - SELECT r.* FROM task_reminders r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM irrigation_records r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM spray_records r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM fertigation_records r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM harvest_records r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM expense_records r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      - SELECT r.* FROM daily_notes r JOIN farms f ON r.farm_id = f.id WHERE f.user_id = bucket.user_id
      # Worker attendance through workers
      - SELECT wa.* FROM worker_attendance wa JOIN workers w ON wa.worker_id = w.id WHERE w.user_id = bucket.user_id
```

## Migration Strategy

The offline-first hooks are **additive and non-breaking**. The existing Supabase-direct hooks continue to work. To migrate a screen to offline-first:

1. Import the PowerSync hook instead of the Supabase hook
2. The API is identical — same return shape, same query key structure
3. Mutations continue to use the existing Supabase hooks (writes are queued by PowerSync)

```typescript
// Step 1: Change the import
- import { useFarms } from '@/hooks';
+ import { usePowerSyncFarms } from '@/hooks';

// Step 2: Use the new hook (same API)
- const { data: farms, isLoading } = useFarms();
+ const { data: farms, isLoading } = usePowerSyncFarms();

// Step 3: Mutations stay the same
const createFarm = useCreateFarm(); // Still uses Supabase directly
```

## Troubleshooting

### PowerSync not syncing

1. Check `EXPO_PUBLIC_POWERSYNC_URL` is set correctly
2. Verify the user is authenticated (PowerSync needs a valid JWT)
3. Check the PowerSync dashboard for sync errors
4. Look for `[PowerSync]` prefixed logs in the console

### Data not appearing offline

1. Ensure the table is included in `src/lib/powersync/schema.ts`
2. Verify sync rules in the PowerSync dashboard include the table
3. Check that the data was synced before going offline (initial sync required)

### Upload queue stuck

1. Check network connectivity
2. Look for `[PowerSync] Upload failed` errors in the console
3. Verify Supabase RLS policies allow the operations
4. Check the PowerSync dashboard for upload errors
