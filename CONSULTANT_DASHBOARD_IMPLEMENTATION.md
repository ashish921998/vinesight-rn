# Vinesight React Native - Consultant Dashboard Feature Implementation

## Overview
This document describes the changes needed in the React Native app to support the consultant dashboard features from the web app.

## Database Schema Changes

### 1. New Tables (Add to `supabase/migrations/`)

```sql
-- Petiole triage results table
CREATE TABLE petiole_triage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  petiole_test_id BIGINT NOT NULL REFERENCES petiole_test_records(id) ON DELETE CASCADE,
  farm_id BIGINT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  classification VARCHAR(20) NOT NULL CHECK (classification IN ('green', 'yellow', 'red')),
  classification_reason TEXT,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_draft_plan_id UUID REFERENCES fertilizer_plans(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Alter Existing Tables

```sql
-- Add assigned_to for agronomist scoping
ALTER TABLE organization_clients ADD COLUMN IF NOT EXISTS assigned_to UUID 
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update role constraint (no more 'member' role)
UPDATE organization_members SET role = 'agronomist' WHERE role = 'member';

ALTER TABLE organization_members 
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members 
  ADD CONSTRAINT organization_members_role_check 
  CHECK (role IN ('owner', 'admin', 'agronomist'));
```

### 3. RLS Policies

```sql
-- Petiole triage policies
ALTER TABLE petiole_triage ENABLE ROW LEVEL SECURITY;

-- Farmers can view their own farm's triage
CREATE POLICY "Farmers can view own triage" ON petiole_triage FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM farms WHERE farms.id = petiole_triage.farm_id AND farms.user_id = auth.uid()
  )
);

-- Farmers can view their own triage results
CREATE POLICY "Farmers can view own triage" ON petiole_triage FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM farms WHERE farms.id = petiole_triage.farm_id AND farms.user_id = auth.uid()
  )
);
```

## TypeScript Types to Add

### `src/types/petiole-triage.ts`

```typescript
export type Classification = 'green' | 'yellow' | 'red';
export type AcknowledgmentType = 'understood' | 'questions' | 'thanks';

export interface PetioleTriage {
  id: string;
  petiole_test_id: number;
  farm_id: number;
  organization_id: string;
  classification: Classification;
  classification_reason: string | null;
  confidence_score: number | null;
  ai_draft_plan_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields (optional)
  consultant_name?: string | null;
  plan_items?: FertilizerPlanItem[];
}
```

### Update `src/types/fertilizer-plan.ts`

```typescript
export interface FertilizerPlanItem {
  id?: string;
  plan_id?: string;
  fertilizer_name: string;
  quantity?: number | null;
  unit?: string | null;
  application_method?: string | null;
  application_frequency?: number | null;
  notes?: string | null;
  sort_order?: number;
}

export interface FertilizerPlan {
  id?: string;
  farm_id: number;
  organization_id?: string;
  consultant_name?: string | null;
  title?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items: FertilizerPlanItem[];
  classification?: 'green' | 'yellow' | 'red' | null;
}
```

## Services to Implement

### `src/services/petiole-triage.ts`

```typescript
import { supabase } from '@/lib/supabase';
import type { PetioleTriage, AcknowledgmentType } from '@/types/petiole-triage';

export async function getTriageForFarm(farmId: number): Promise<PetioleTriage | null> {
  const { data, error } = await supabase
    .from('petiole_triage')
    .select(`
      *,
      fertilizer_plans:ai_draft_plan_id (
        id,
        title,
        notes,
        fertilizer_plan_items (*)
      )
    `)
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) throw error;
  return data as PetioleTriage | null;
}

export async function getClassificationBadge(classification: string): Promise<{
  emoji: string;
  label: string;
  color: string;
}> {
  switch (classification) {
    case 'red':
      return { emoji: '🔴', label: 'Urgent', color: '#FF4444' };
    case 'yellow':
      return { emoji: '🟡', label: 'Watch', color: '#FFAA00' };
    case 'green':
      return { emoji: '🟢', label: 'Normal', color: '#00AA00' };
    default:
      return { emoji: '⚪', label: 'Unknown', color: '#888888' };
  }
}
```

### Update `src/services/fertilizer-plan.ts`

Replace the mock implementation with real Supabase queries:

```typescript
import { supabase } from '@/lib/supabase';
import type { FertilizerPlan } from '@/types/fertilizer-plan';

export async function fetchFertilizerPlanForFarm(farmId: number): Promise<FertilizerPlan | null> {
  // Get the most recent approved plan for this farm
  const { data, error } = await supabase
    .from('fertilizer_plans')
    .select(`
      *,
      fertilizer_plan_items (*),
      profiles:created_by (full_name)
    `)
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching fertilizer plan:', error);
    return null;
  }
  
  if (!data) return null;
  
  return {
    id: data.id,
    farm_id: data.farm_id,
    organization_id: data.organization_id,
    consultant_name: data.profiles?.full_name || 'Consultant',
    title: data.title,
    notes: data.notes,
    created_at: data.created_at,
    updated_at: data.updated_at,
    items: (data.fertilizer_plan_items || []).map((item: any) => ({
      id: item.id,
      fertilizer_name: item.fertilizer_name,
      quantity: item.quantity,
      unit: item.unit,
      application_method: item.application_method,
      application_frequency: item.application_frequency,
      notes: item.notes,
      sort_order: item.sort_order
    }))
  };
}
```

## React Native Components

### 1. Triage Card Component (`src/components/TriageCard.tsx`)

```tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PetioleTriage } from '@/types/petiole-triage';

interface Props {
  triage: PetioleTriage;
}

export function TriageCard({ triage }: Props) {
  const getBadge = (classification: string) => {
    switch (classification) {
      case 'red': return { emoji: '🔴', label: 'Urgent', color: '#FF4444' };
      case 'yellow': return { emoji: '🟡', label: 'Watch', color: '#FFAA00' };
      case 'green': return { emoji: '🟢', label: 'Normal', color: '#00AA00' };
      default: return { emoji: '⚪', label: 'Unknown', color: '#888888' };
    }
  };

  const badge = getBadge(triage.classification);

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
        <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
        <Text style={[styles.badgeText, { color: badge.color }]}>
          {badge.label}
        </Text>
      </View>
      
      {triage.classification_reason && (
        <Text style={styles.reason}>{triage.classification_reason}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0'
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  badgeEmoji: {
    fontSize: 16,
    marginRight: 6
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 14
  },
  reason: {
    marginTop: 12,
    fontSize: 14,
    color: '#444',
    lineHeight: 20
  },
});
```

### 2. Update Fertilizer Plans Screen

Update `app/fertilizer-plans.tsx` to include:

1. Fetch triage data along with the plan
2. Show classification badge if triage exists

```tsx
import { useTriageForFarm } from '@/hooks/use-triage';
import { TriageCard } from '@/components/TriageCard';

// Inside the component:
const { data: triage } = useTriageForFarm(farmId);

// In the JSX, show triage card if exists:
{triage && (
  <TriageCard triage={triage} />
)}
```

### 3. Add Hook (`src/hooks/use-triage.ts`)

```typescript
import { useQuery } from '@tanstack/react-query';
import { getTriageForFarm } from '@/services/petiole-triage';

export function useTriageForFarm(farmId?: number) {
  return useQuery({
    queryKey: ['triage', farmId],
    queryFn: () => getTriageForFarm(farmId!),
    enabled: !!farmId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}
```

## i18n Strings to Add

Add to `src/i18n/locales/en.ts`, `hi.ts`, `mr.ts`:

```typescript
fertilizerPlan: {
  ...existingKeys,
  triageTitle: 'AI Analysis',
  triageUrgent: 'Urgent',
  triageWatch: 'Watch',
  triageNormal: 'Normal'
}
```

## Testing Checklist

1. **Database Migration**
   - [ ] Run migration on staging Supabase project
   - [ ] Verify RLS policies work correctly
   - [ ] Test with actual farmer/consultant accounts

2. **API Integration**
   - [ ] Triage data loads for farm
   - [ ] Fertilizer plan with items loads

3. **UI Components**
   - [ ] Classification badges render correctly (red/yellow/green)
   - [ ] Plan items render with correct quantities/units

4. **Error Handling**
   - [ ] Graceful fallback when no triage exists
   - [ ] Loading states for async operations

## Implementation Steps

1. Run the SQL migrations in the RN app's `supabase/migrations/` folder
2. Update `src/types/fertilizer-plan.ts` and add `src/types/petlio-triage.ts`
3. Implement `src/services/petiole-triage.ts`
4. Update `src/services/fertilizer-plan.ts` with real Supabase queries
5. Add `src/components/TriageCard.tsx`
6. Create `src/hooks/use-triage.ts`
7. Update `app/fertilizer-plans.tsx` to show triage card
8. Add i18n translations
9. Test on staging environment

## Notes

- The `petiole_triage` table is populated by the `classify-petiole` edge function
- Edge function is triggered by webhook on new petiole test records
- Classification (green/yellow/red) is determined by AI analysis of nutrient values
