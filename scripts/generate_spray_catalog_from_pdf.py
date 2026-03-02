import json
import math
import re
from collections import defaultdict
from pathlib import Path

import pdfplumber

ROOT = Path('/Users/ashishhuddar/Desktop/vinesight-rn')
PDF_PATH = Path('/Users/ashishhuddar/Downloads/Spray calculator.pdf')
OUT_DIR = ROOT / 'assets' / 'data' / 'master'


def clean(value):
    if value is None:
        return ''
    value = str(value)
    value = value.replace('\n', ' ')
    value = value.replace('\u00ad', '')
    value = re.sub(r'\s+', ' ', value).strip()
    return value


def slugify(value):
    value = value.lower().strip()
    value = value.replace('&', ' and ')
    value = re.sub(r'[^a-z0-9]+', '_', value)
    value = re.sub(r'_+', '_', value)
    return value.strip('_')


def split_plus(text):
    text = clean(text)
    if not text:
        return []
    return [p.strip() for p in re.split(r'\s+\+\s+', text) if p.strip()]


def parse_dose_component(dose_text):
    s = clean(dose_text).lower()
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)', s)
    if not m:
        return None
    value = float(m.group(1))
    unit = 'ml' if 'ml' in s else 'gm'
    return value, unit


def parse_phi_component(phi_text):
    s = clean(phi_text).lower()
    nums = [int(x) for x in re.findall(r'\d+', s)]
    if not nums:
        return 0
    return max(nums)


def parse_percent(active_text):
    s = clean(active_text)
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*%?', s)
    if not m:
        return None
    val = float(m.group(1))
    if val > 100:
        return None
    return val


def parse_packaging_value(packaging_text):
    s = clean(packaging_text).lower().replace(' ', '')
    m = re.search(r'([0-9]+(?:\.[0-9]+)?)(kg|gm|g|ml|li|l)', s)
    if not m:
        return None
    qty = float(m.group(1))
    unit = m.group(2)
    if unit in ('kg',):
        return qty * 1000.0, 'gm'
    if unit in ('g', 'gm'):
        return qty, 'gm'
    if unit in ('l', 'li'):
        return qty * 1000.0, 'ml'
    return qty, 'ml'


def parse_price(cost_text):
    s = clean(cost_text)
    nums = re.findall(r'\d+(?:\.\d+)?', s)
    if not nums:
        return None
    return float(nums[-1])


with pdfplumber.open(PDF_PATH) as pdf:
    raw_rows = []
    for page_index, page in enumerate(pdf.pages, start=1):
        for table in page.extract_tables() or []:
            for row in table:
                if not row or len(row) < 6:
                    continue
                row = [clean(c) for c in row]
                if row[0].lower().startswith('trade name and manufacturer'):
                    continue
                if not any(row):
                    continue
                raw_rows.append((page_index, row))

mixes = []
product_by_name = {}
phi_observations = defaultdict(list)


def ensure_product(name, active=''):
    key_name = clean(name)
    if not key_name:
        return None
    norm = key_name.lower()
    if norm not in product_by_name:
        product_by_name[norm] = {
            'name': key_name,
            'active': clean(active),
            'price': None,
            'packaging': None,
            'aliases': set(),
        }
    p = product_by_name[norm]
    if clean(active) and (not p['active'] or p['active'].lower() in ('biological', '#ref!')):
        p['active'] = clean(active)
    p['aliases'].add(key_name)
    return p


for page, row in raw_rows:
    trade = row[0] if len(row) > 0 else ''
    active = row[1] if len(row) > 1 else ''
    target = row[2] if len(row) > 2 else ''
    mode = row[3] if len(row) > 3 else ''
    dose = row[4] if len(row) > 4 else ''
    phi = row[5] if len(row) > 5 else ''
    pack_a = row[6] if len(row) > 6 else ''
    pack_b = row[7] if len(row) > 7 else ''
    cost = row[8] if len(row) > 8 else ''

    trade = clean(trade)
    active = clean(active)
    if not trade:
        continue
    if trade.lower() in {'#ref!', '0', '-'}:
        continue

    trade_parts = split_plus(trade)
    active_parts = split_plus(active)
    dose_parts = split_plus(dose)
    phi_parts = split_plus(phi)

    max_len = max(len(trade_parts), len(active_parts), len(dose_parts), 1)
    components = []

    for i in range(max_len):
        tname = trade_parts[i] if i < len(trade_parts) else (trade_parts[-1] if trade_parts else '')
        aname = active_parts[i] if i < len(active_parts) else (active_parts[-1] if active_parts else '')
        dtext = dose_parts[i] if i < len(dose_parts) else (dose_parts[-1] if dose_parts else '')
        ptext = phi_parts[i] if i < len(phi_parts) else (phi_parts[-1] if phi_parts else '')

        tname = clean(tname)
        aname = clean(aname)
        if not tname:
            continue

        prod = ensure_product(tname, aname)
        if not prod:
            continue

        dose_parsed = parse_dose_component(dtext) or (1.0, 'gm')
        phi_days = parse_phi_component(ptext)
        phi_observations[tname.lower()].append(phi_days)

        components.append({
            'productName': tname,
            'doseValue': float(dose_parsed[0]),
            'doseUnit': dose_parsed[1],
            'doseBasis': 'per_liter',
        })

    if not components:
        continue

    main_prod = ensure_product(components[0]['productName'])
    if main_prod:
        price = parse_price(cost)
        if price is not None:
            main_prod['price'] = price
        packaging = clean(pack_b) or clean(pack_a)
        if packaging:
            main_prod['packaging'] = packaging

    mode_norm = clean(mode).lower()
    app_mode = 'unspecified'
    if 'preventive' in mode_norm and 'cura' in mode_norm:
        app_mode = 'both'
    elif 'curative' in mode_norm or mode_norm == 'cura tive':
        app_mode = 'curative'
    elif 'preventive' in mode_norm:
        app_mode = 'preventive'

    mixes.append({
        'name': trade,
        'targetProblem': clean(target) or None,
        'applicationMode': app_mode,
        'sourcePage': page,
        'sourceDocument': 'Spray calculator.pdf',
        'crop': 'grape',
        'isActive': True,
        'components': components,
    })

name_to_key = {}
used_keys = set()

for norm_name, prod in product_by_name.items():
    base = slugify(prod['name'])
    if not base:
        base = 'product'
    key = base
    k = 2
    while key in used_keys:
        key = f'{base}_{k}'
        k += 1
    used_keys.add(key)
    name_to_key[norm_name] = key

products = []
compositions = []
phi_rules = []

for norm_name, prod in sorted(product_by_name.items(), key=lambda x: x[1]['name'].lower()):
    key = name_to_key[norm_name]
    active = prod['active'] or None
    price = prod['price']
    packaging = prod['packaging']

    aliases = [{'alias': prod['name'], 'locale': 'en', 'aliasKind': 'trade'}]
    if active and active.lower() != prod['name'].lower():
        aliases.append({'alias': active, 'locale': 'en', 'aliasKind': 'common'})

    products.append({
        'key': key,
        'name': prod['name'],
        'manufacturer': 'ChemiNova Agro Tech',
        'activeIngredient': active,
        'inputType': 'spray',
        'verificationTier': 'verified',
        'formulation': None,
        'stateCode': 'MH',
        'sourceReference': 'Spray calculator.pdf',
        'isActive': True,
        'packagingSize': packaging,
        'pricePerPackage': price,
        'priceCurrency': 'INR',
        'aliases': aliases,
    })

    pct = parse_percent(active or '')
    if pct is not None:
        compositions.append({
            'productKey': key,
            'componentCode': slugify((active or prod['name']).split()[0]).upper()[:32] or 'ACTIVE',
            'componentType': 'active_ingredient',
            'percent': pct,
            'basis': 'declared',
            'verified': True,
            'sourceNote': 'Spray calculator.pdf',
        })

    phi_vals = [v for v in phi_observations.get(norm_name, []) if isinstance(v, int)]
    phi_days = int(max(phi_vals)) if phi_vals else 0
    phi_rules.append({
        'productKey': key,
        'crop': 'grape',
        'phiDays': phi_days,
        'evidenceLevel': 'field',
        'sourceNote': 'Spray calculator.pdf',
        'sourceUrl': None,
        'verified': True,
        'effectiveFrom': None,
        'effectiveTo': None,
    })

final_mixes = []
seen_mix = set()
for mix in mixes:
    comp_rows = []
    for c in mix['components']:
        key = name_to_key.get(c['productName'].lower())
        if not key:
            continue
        comp_rows.append({
            'productKey': key,
            'doseValue': c['doseValue'],
            'doseUnit': c['doseUnit'],
            'doseBasis': c['doseBasis'],
            'baseTankLiters': None,
            'notes': None,
        })
    if not comp_rows:
        continue
    mix_key = (mix['name'].strip().lower(), mix['sourcePage'])
    if mix_key in seen_mix:
        continue
    seen_mix.add(mix_key)
    # Estimated cost per 200L from component dosage and product packaging/price if available
    est_cost = 0.0
    has_cost = False
    for c in comp_rows:
        prod = next((p for p in products if p['key'] == c['productKey']), None)
        if not prod:
            continue
        if prod['pricePerPackage'] is None or not prod['packagingSize']:
            continue
        parsed_pack = parse_packaging_value(prod['packagingSize'])
        if not parsed_pack:
            continue
        pack_qty, pack_unit = parsed_pack
        if (c['doseUnit'] == 'gm' and pack_unit != 'gm') or (c['doseUnit'] == 'ml' and pack_unit != 'ml'):
            continue
        qty_200l = c['doseValue'] * 200.0
        comp_cost = (qty_200l / pack_qty) * float(prod['pricePerPackage'])
        est_cost += comp_cost
        has_cost = True

    final_mixes.append({
        'name': mix['name'],
        'targetProblem': mix['targetProblem'],
        'applicationMode': mix['applicationMode'],
        'sourcePage': mix['sourcePage'],
        'sourceDocument': mix['sourceDocument'],
        'crop': 'grape',
        'isActive': True,
        'estimatedCostPer200L': round(est_cost, 2) if has_cost else None,
        'components': comp_rows,
    })

products_file = {
    'version': 'v2',
    'stateCode': 'MH',
    'sourceReference': 'Spray calculator.pdf',
    'products': products,
}
compositions_file = {
    'version': 'v2',
    'stateCode': 'MH',
    'rows': compositions,
}
phi_file = {
    'version': 'v2',
    'stateCode': 'MH',
    'rows': phi_rules,
}
mixes_file = {
    'version': 'v2',
    'crop': 'grape',
    'sourceDocument': 'Spray calculator.pdf',
    'mixes': final_mixes,
}

(OUT_DIR / 'maharashtra_products_v1.json').write_text(json.dumps(products_file, indent=2))
(OUT_DIR / 'maharashtra_compositions_v1.json').write_text(json.dumps(compositions_file, indent=2))
(OUT_DIR / 'maharashtra_phi_rules_v1.json').write_text(json.dumps(phi_file, indent=2))
(OUT_DIR / 'maharashtra_mixes_v1.json').write_text(json.dumps(mixes_file, indent=2))

print('products', len(products))
print('compositions', len(compositions))
print('phi rules', len(phi_rules))
print('mixes', len(final_mixes))
