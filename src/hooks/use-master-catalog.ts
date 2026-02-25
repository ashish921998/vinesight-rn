import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/hooks/query-keys';
import { TABLES } from '@/types/database';
import type {
  CatalogInputType,
  MasterCatalogProduct,
  MasterCatalogProductAlias,
  MasterCatalogProductComposition,
} from '@/types/catalog';

type ProductRow = Omit<MasterCatalogProduct, 'aliases' | 'compositions'>;
type AliasRow = MasterCatalogProductAlias;
type CompositionRow = MasterCatalogProductComposition;

function mapProductsWithDetails(
  products: ProductRow[],
  aliases: AliasRow[],
  compositions: CompositionRow[],
): MasterCatalogProduct[] {
  const aliasesByProduct = new Map<number, MasterCatalogProductAlias[]>();
  const compositionsByProduct = new Map<number, MasterCatalogProductComposition[]>();

  for (const alias of aliases) {
    const existing = aliasesByProduct.get(alias.product_id) ?? [];
    existing.push(alias);
    aliasesByProduct.set(alias.product_id, existing);
  }

  for (const composition of compositions) {
    const existing = compositionsByProduct.get(composition.product_id) ?? [];
    existing.push(composition);
    compositionsByProduct.set(composition.product_id, existing);
  }

  return products.map((product) => ({
    ...product,
    aliases: aliasesByProduct.get(product.id) ?? [],
    compositions: compositionsByProduct.get(product.id) ?? [],
  }));
}

async function fetchMasterProducts(args: {
  inputTypes?: CatalogInputType[];
  stateCode?: string | null;
}): Promise<MasterCatalogProduct[]> {
  const stateCode = args.stateCode?.trim().toUpperCase() || null;

  const selectColumns =
    'id,name,manufacturer,active_ingredient,input_type,verification_tier,formulation,state_code,source_reference,is_active,created_at,updated_at';

  const buildProductQuery = (options?: { stateCode?: string }) => {
    let query = supabase
      .from(TABLES.CHEMICAL_PRODUCTS)
      .select(selectColumns)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (options?.stateCode) {
      query = query.eq('state_code', options.stateCode);
    }

    if (args.inputTypes && args.inputTypes.length > 0) {
      query = query.in('input_type', args.inputTypes);
    }

    return query;
  };

  const productsResult = await buildProductQuery(stateCode ? { stateCode } : undefined);
  if (productsResult.error?.code === '42P01') return [];
  if (productsResult.error) throw productsResult.error;

  const products = (productsResult.data ?? []) as ProductRow[];
  if (products.length === 0) return [];

  const productIds = products.map((product) => product.id);

  const [aliasesResult, compositionsResult] = await Promise.all([
    supabase
      .from(TABLES.CHEMICAL_PRODUCT_ALIASES)
      .select('id,product_id,alias,locale,alias_kind,source,created_at')
      .in('product_id', productIds),
    supabase
      .from(TABLES.CHEMICAL_PRODUCT_COMPOSITIONS)
      .select(
        'id,product_id,component_code,component_type,percent,basis,verified,source_note,created_at,updated_at',
      )
      .in('product_id', productIds),
  ]);

  if (aliasesResult.error?.code !== '42P01' && aliasesResult.error) {
    throw aliasesResult.error;
  }
  if (compositionsResult.error?.code !== '42P01' && compositionsResult.error) {
    throw compositionsResult.error;
  }

  return mapProductsWithDetails(
    products,
    (aliasesResult.data ?? []) as AliasRow[],
    (compositionsResult.data ?? []) as CompositionRow[],
  );
}

export function useMasterProducts(options?: {
  inputTypes?: CatalogInputType[];
  stateCode?: string | null;
}) {
  const inputTypes = options?.inputTypes ?? [];
  const stateCode = options?.stateCode?.trim().toUpperCase() || null;

  return useQuery({
    queryKey: queryKeys.masterCatalog.productsByType(inputTypes, stateCode),
    queryFn: () =>
      fetchMasterProducts({
        inputTypes,
        stateCode,
      }),
    staleTime: 60_000,
  });
}

export function useMasterProductSearch(
  query: string,
  options?: {
    inputTypes?: CatalogInputType[];
    stateCode?: string | null;
  },
) {
  const normalizedQuery = query.trim().toLowerCase();
  const productsQuery = useMasterProducts(options);

  const data = useMemo(() => {
    const products = productsQuery.data ?? [];
    if (!normalizedQuery) return products;
    return products.filter((product) => {
      if (product.name.toLowerCase().includes(normalizedQuery)) return true;
      if ((product.manufacturer ?? '').toLowerCase().includes(normalizedQuery)) return true;
      if ((product.active_ingredient ?? '').toLowerCase().includes(normalizedQuery)) return true;
      if (product.aliases?.some((alias) => alias.alias.toLowerCase().includes(normalizedQuery))) {
        return true;
      }
      return false;
    });
  }, [productsQuery.data, normalizedQuery]);

  return {
    ...productsQuery,
    data,
  };
}

export function useMasterProductById(
  productId: number | null | undefined,
  options?: {
    inputTypes?: CatalogInputType[];
    stateCode?: string | null;
  },
) {
  const productsQuery = useMasterProducts(options);
  const data = useMemo(
    () => (productsQuery.data ?? []).find((product) => product.id === productId) ?? null,
    [productsQuery.data, productId],
  );

  return {
    ...productsQuery,
    data,
  };
}
