/**
 * SF Symbol → universal `@expo/ui` `Icon` asset map.
 *
 * Each entry is `Icon.select({ ios: <SF Symbol>, android: <Material Symbol XML> })`.
 * The `@expo/ui/babel-plugin` (auto-loaded by `babel-preset-expo`) rewrites every
 * `Icon.select` call into a `Platform.OS` ternary so Metro DCE folds it per-platform:
 * the XML asset ships only in the Android bundle, the SF Symbol string only on iOS.
 *
 * Android assets come from `@expo/material-symbols` (outlined style). The package's
 * `exports` map (`./*.xml`) validates each import path literal at compile time — a
 * typo or removed icon fails the build, not silently renders blank.
 *
 * Keys are the *resolved* SF Symbol names (after `ICON_MAPPING` alias resolution),
 * matching what `symbol.tsx` looks up.
 *
 * Icons intentionally absent from this map fall through to the Ionicons/web fallback
 * path in `symbol.tsx` — e.g. brand marks (`apple.logo`, `g.circle.fill`) which have
 * no Material equivalent, and bespoke `AppIcon` assets handled earlier in `symbol.tsx`.
 */
import { Icon } from '@expo/ui';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * Escape hatch for SF Symbol names that are valid at runtime but absent from the
 * `SFSymbols7_0` TS union (e.g. `compass`, `sparkles.fill`, `ellipse`). The
 * legacy `SymbolView` path cast the name blindly; here we keep compile-time
 * validation for the ~150 names that ARE in the union, and only relax these few.
 */
const sf = (name: string): SFSymbol => name as SFSymbol;

export const ICON_ASSETS = {
  // --- chevrons / arrows ---
  'chevron.left': Icon.select({
    ios: 'chevron.left',
    android: import('@expo/material-symbols/chevron_left.xml'),
  }),
  'chevron.right': Icon.select({
    ios: 'chevron.right',
    android: import('@expo/material-symbols/chevron_right.xml'),
  }),
  'chevron.up': Icon.select({
    ios: 'chevron.up',
    android: import('@expo/material-symbols/keyboard_arrow_up.xml'),
  }),
  'chevron.down': Icon.select({
    ios: 'chevron.down',
    android: import('@expo/material-symbols/keyboard_arrow_down.xml'),
  }),
  'chevron.up.chevron.down': Icon.select({
    ios: 'chevron.up.chevron.down',
    android: import('@expo/material-symbols/unfold_more.xml'),
  }),
  'arrow.left': Icon.select({
    ios: 'arrow.left',
    android: import('@expo/material-symbols/arrow_back.xml'),
  }),
  'arrow.right': Icon.select({
    ios: 'arrow.right',
    android: import('@expo/material-symbols/arrow_forward.xml'),
  }),
  'arrow.up': Icon.select({
    ios: 'arrow.up',
    android: import('@expo/material-symbols/arrow_upward.xml'),
  }),
  'arrow.down': Icon.select({
    ios: 'arrow.down',
    android: import('@expo/material-symbols/arrow_downward.xml'),
  }),
  'arrow.up.circle.fill': Icon.select({
    ios: 'arrow.up.circle.fill',
    android: import('@expo/material-symbols/arrow_circle_up.xml'),
  }),
  'arrow.down.circle.fill': Icon.select({
    ios: 'arrow.down.circle.fill',
    android: import('@expo/material-symbols/arrow_circle_down.xml'),
  }),
  'arrow.up.right': Icon.select({
    ios: 'arrow.up.right',
    android: import('@expo/material-symbols/arrow_outward.xml'),
  }),
  'arrow.up.left.and.arrow.down.right': Icon.select({
    ios: 'arrow.up.left.and.arrow.down.right',
    android: import('@expo/material-symbols/open_in_full.xml'),
  }),
  'arrow.uturn.backward': Icon.select({
    ios: 'arrow.uturn.backward',
    android: import('@expo/material-symbols/undo.xml'),
  }),
  'arrow.clockwise': Icon.select({
    ios: 'arrow.clockwise',
    android: import('@expo/material-symbols/refresh.xml'),
  }),
  'arrow.triangle.branch': Icon.select({
    ios: 'arrow.triangle.branch',
    android: import('@expo/material-symbols/account_tree.xml'),
  }),

  // --- x / check ---
  xmark: Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') }),
  'xmark.circle.fill': Icon.select({
    ios: 'xmark.circle.fill',
    android: import('@expo/material-symbols/cancel.xml'),
  }),
  'xmark.seal.fill': Icon.select({
    ios: 'xmark.seal.fill',
    android: import('@expo/material-symbols/do_not_disturb_on.xml'),
  }),
  checkmark: Icon.select({ ios: 'checkmark', android: import('@expo/material-symbols/check.xml') }),
  'checkmark.circle.fill': Icon.select({
    ios: 'checkmark.circle.fill',
    android: import('@expo/material-symbols/check_circle.xml'),
  }),
  'checkmark.square.fill': Icon.select({
    ios: 'checkmark.square.fill',
    android: import('@expo/material-symbols/check_box.xml'),
  }),
  'checkmark.seal': Icon.select({
    ios: 'checkmark.seal',
    android: import('@expo/material-symbols/verified.xml'),
  }),
  'checkmark.seal.fill': Icon.select({
    ios: 'checkmark.seal.fill',
    android: import('@expo/material-symbols/verified.xml'),
  }),
  'checkmark.shield.fill': Icon.select({
    ios: 'checkmark.shield.fill',
    android: import('@expo/material-symbols/verified_user.xml'),
  }),

  // --- plus / minus ---
  plus: Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') }),
  'plus.circle.fill': Icon.select({
    ios: 'plus.circle.fill',
    android: import('@expo/material-symbols/add_circle.xml'),
  }),
  'minus.circle.fill': Icon.select({
    ios: 'minus.circle.fill',
    android: import('@expo/material-symbols/remove.xml'),
  }),

  // --- edit / file ---
  pencil: Icon.select({ ios: 'pencil', android: import('@expo/material-symbols/edit.xml') }),
  trash: Icon.select({ ios: 'trash', android: import('@expo/material-symbols/delete.xml') }),
  'square.and.pencil': Icon.select({
    ios: 'square.and.pencil',
    android: import('@expo/material-symbols/edit_square.xml'),
  }),
  'doc.fill': Icon.select({
    ios: 'doc.fill',
    android: import('@expo/material-symbols/description.xml'),
  }),
  'doc.text': Icon.select({
    ios: 'doc.text',
    android: import('@expo/material-symbols/description.xml'),
  }),
  'doc.text.fill': Icon.select({
    ios: 'doc.text.fill',
    android: import('@expo/material-symbols/description.xml'),
  }),
  document: Icon.select({ ios: 'document', android: import('@expo/material-symbols/draft.xml') }),
  'rectangle.portrait.and.arrow.right': Icon.select({
    ios: 'rectangle.portrait.and.arrow.right',
    android: import('@expo/material-symbols/logout.xml'),
  }),
  'square.and.arrow.down.fill': Icon.select({
    ios: 'square.and.arrow.down.fill',
    android: import('@expo/material-symbols/download.xml'),
  }),
  'square.and.arrow.up': Icon.select({
    ios: 'square.and.arrow.up',
    android: import('@expo/material-symbols/share.xml'),
  }),

  // --- search ---
  magnifyingglass: Icon.select({
    ios: 'magnifyingglass',
    android: import('@expo/material-symbols/search.xml'),
  }),

  // --- lists / grids ---
  'square.grid.2x2': Icon.select({
    ios: 'square.grid.2x2',
    android: import('@expo/material-symbols/grid_view.xml'),
  }),
  'square.grid.2x2.fill': Icon.select({
    ios: 'square.grid.2x2.fill',
    android: import('@expo/material-symbols/grid_view.xml'),
  }),
  'list.bullet': Icon.select({
    ios: 'list.bullet',
    android: import('@expo/material-symbols/list.xml'),
  }),
  'list.bullet.rectangle.portrait': Icon.select({
    ios: 'list.bullet.rectangle.portrait',
    android: import('@expo/material-symbols/list_alt.xml'),
  }),
  'list.bullet.rectangle.portrait.fill': Icon.select({
    ios: 'list.bullet.rectangle.portrait.fill',
    android: import('@expo/material-symbols/list_alt.xml'),
  }),
  'rectangle.stack': Icon.select({
    ios: 'rectangle.stack',
    android: import('@expo/material-symbols/dashboard_customize.xml'),
  }),
  'sidebar.left': Icon.select({
    ios: 'sidebar.left',
    android: import('@expo/material-symbols/dock_to_right.xml'),
  }),
  'tablecells.fill': Icon.select({
    ios: 'tablecells.fill',
    android: import('@expo/material-symbols/table_chart.xml'),
  }),

  // --- ellipsis / menu / filter ---
  ellipsis: Icon.select({
    ios: 'ellipsis',
    android: import('@expo/material-symbols/more_horiz.xml'),
  }),
  'ellipsis.circle': Icon.select({
    ios: 'ellipsis.circle',
    android: import('@expo/material-symbols/more_horiz.xml'),
  }),
  'ellipsis.circle.fill': Icon.select({
    ios: 'ellipsis.circle.fill',
    android: import('@expo/material-symbols/more_horiz.xml'),
  }),
  'line.3.horizontal': Icon.select({
    ios: 'line.3.horizontal',
    android: import('@expo/material-symbols/menu.xml'),
  }),
  'line.3.horizontal.decrease': Icon.select({
    ios: 'line.3.horizontal.decrease',
    android: import('@expo/material-symbols/filter_list.xml'),
  }),
  'line.3.horizontal.decrease.circle': Icon.select({
    ios: 'line.3.horizontal.decrease.circle',
    android: import('@expo/material-symbols/filter_list_off.xml'),
  }),

  // --- shapes ---
  square: Icon.select({
    ios: 'square',
    android: import('@expo/material-symbols/check_box_outline_blank.xml'),
  }),
  circle: Icon.select({ ios: 'circle', android: import('@expo/material-symbols/circle.xml') }),
  ellipse: Icon.select({
    ios: sf('ellipse'),
    android: import('@expo/material-symbols/circle.xml'),
  }),
  'circle.inset.filled': Icon.select({
    ios: 'circle.inset.filled',
    android: import('@expo/material-symbols/radio_button_checked.xml'),
  }),

  // --- agriculture / nature ---
  leaf: Icon.select({ ios: 'leaf', android: import('@expo/material-symbols/eco.xml') }),
  'leaf.fill': Icon.select({ ios: 'leaf.fill', android: import('@expo/material-symbols/eco.xml') }),
  drop: Icon.select({ ios: 'drop', android: import('@expo/material-symbols/water_drop.xml') }),
  'drop.fill': Icon.select({
    ios: 'drop.fill',
    android: import('@expo/material-symbols/water_drop.xml'),
  }),
  'drop.circle': Icon.select({
    ios: 'drop.circle',
    android: import('@expo/material-symbols/water_drop.xml'),
  }),
  'drop.circle.fill': Icon.select({
    ios: 'drop.circle.fill',
    android: import('@expo/material-symbols/water_drop.xml'),
  }),
  'sun.max.fill': Icon.select({
    ios: 'sun.max.fill',
    android: import('@expo/material-symbols/sunny.xml'),
  }),
  'cloud.sun.fill': Icon.select({
    ios: 'cloud.sun.fill',
    android: import('@expo/material-symbols/partly_cloudy_day.xml'),
  }),
  'cloud.rain.fill': Icon.select({
    ios: 'cloud.rain.fill',
    android: import('@expo/material-symbols/rainy.xml'),
  }),
  'cloud.slash.fill': Icon.select({
    ios: sf('cloud.slash.fill'),
    android: import('@expo/material-symbols/cloud_off.xml'),
  }),
  'cloud.fill': Icon.select({
    ios: 'cloud.fill',
    android: import('@expo/material-symbols/cloud.xml'),
  }),
  'cloud.drizzle.fill': Icon.select({
    ios: 'cloud.drizzle.fill',
    android: import('@expo/material-symbols/rainy_light.xml'),
  }),
  'bolt.fill': Icon.select({
    ios: 'bolt.fill',
    android: import('@expo/material-symbols/bolt.xml'),
  }),
  flask: Icon.select({ ios: 'flask', android: import('@expo/material-symbols/science.xml') }),
  'flask.fill': Icon.select({
    ios: 'flask.fill',
    android: import('@expo/material-symbols/science.xml'),
  }),
  cube: Icon.select({ ios: 'cube', android: import('@expo/material-symbols/inventory_2.xml') }),
  'cube.fill': Icon.select({
    ios: 'cube.fill',
    android: import('@expo/material-symbols/inventory_2.xml'),
  }),
  'cube.box.fill': Icon.select({
    ios: 'cube.box.fill',
    android: import('@expo/material-symbols/inventory_2.xml'),
  }),
  'square.stack.3d.up': Icon.select({
    ios: 'square.stack.3d.up',
    android: import('@expo/material-symbols/layers.xml'),
  }),
  'square.stack.3d.up.fill': Icon.select({
    ios: 'square.stack.3d.up.fill',
    android: import('@expo/material-symbols/layers.xml'),
  }),

  // --- business / money ---
  calendar: Icon.select({
    ios: 'calendar',
    android: import('@expo/material-symbols/calendar_month.xml'),
  }),
  'calendar.badge.clock': Icon.select({
    ios: 'calendar.badge.clock',
    android: import('@expo/material-symbols/event_upcoming.xml'),
  }),
  'calendar.badge.exclamationmark': Icon.select({
    ios: 'calendar.badge.exclamationmark',
    android: import('@expo/material-symbols/event_busy.xml'),
  }),
  clock: Icon.select({ ios: 'clock', android: import('@expo/material-symbols/schedule.xml') }),
  'clock.fill': Icon.select({
    ios: 'clock.fill',
    android: import('@expo/material-symbols/schedule.xml'),
  }),
  location: Icon.select({
    ios: 'location',
    android: import('@expo/material-symbols/location_on.xml'),
  }),
  'location.fill': Icon.select({
    ios: 'location.fill',
    android: import('@expo/material-symbols/location_on.xml'),
  }),
  'dollarsign.circle': Icon.select({
    ios: 'dollarsign.circle',
    android: import('@expo/material-symbols/paid.xml'),
  }),
  'dollarsign.circle.fill': Icon.select({
    ios: 'dollarsign.circle.fill',
    android: import('@expo/material-symbols/paid.xml'),
  }),
  'indianrupeesign.circle': Icon.select({
    ios: 'indianrupeesign.circle',
    android: import('@expo/material-symbols/currency_rupee.xml'),
  }),
  'indianrupeesign.circle.fill': Icon.select({
    ios: 'indianrupeesign.circle.fill',
    android: import('@expo/material-symbols/currency_rupee.xml'),
  }),
  receipt: Icon.select({
    ios: 'receipt',
    android: import('@expo/material-symbols/receipt_long.xml'),
  }),
  'receipt.fill': Icon.select({
    ios: 'receipt.fill',
    android: import('@expo/material-symbols/receipt_long.xml'),
  }),
  'wallet.pass': Icon.select({
    ios: 'wallet.pass',
    android: import('@expo/material-symbols/account_balance_wallet.xml'),
  }),
  cart: Icon.select({ ios: 'cart', android: import('@expo/material-symbols/shopping_cart.xml') }),
  'cart.fill': Icon.select({
    ios: 'cart.fill',
    android: import('@expo/material-symbols/shopping_cart.xml'),
  }),
  banknote: Icon.select({
    ios: 'banknote',
    android: import('@expo/material-symbols/payments.xml'),
  }),
  'creditcard.fill': Icon.select({
    ios: 'creditcard.fill',
    android: import('@expo/material-symbols/credit_card.xml'),
  }),

  // --- people ---
  person: Icon.select({ ios: 'person', android: import('@expo/material-symbols/person.xml') }),
  'person.fill': Icon.select({
    ios: 'person.fill',
    android: import('@expo/material-symbols/person.xml'),
  }),
  'person.2': Icon.select({ ios: 'person.2', android: import('@expo/material-symbols/group.xml') }),
  'person.2.fill': Icon.select({
    ios: 'person.2.fill',
    android: import('@expo/material-symbols/group.xml'),
  }),
  'person.crop.circle.fill.badge.plus': Icon.select({
    ios: 'person.crop.circle.fill.badge.plus',
    android: import('@expo/material-symbols/person_add.xml'),
  }),
  'person.badge.plus': Icon.select({
    ios: 'person.badge.plus',
    android: import('@expo/material-symbols/person_add.xml'),
  }),
  'person.badge.plus.fill': Icon.select({
    ios: 'person.badge.plus.fill',
    android: import('@expo/material-symbols/person_add.xml'),
  }),
  'person.badge.clock': Icon.select({
    ios: 'person.badge.clock',
    android: import('@expo/material-symbols/person_alert.xml'),
  }),
  'person.badge.clock.fill': Icon.select({
    ios: 'person.badge.clock.fill',
    android: import('@expo/material-symbols/person_alert.xml'),
  }),

  // --- communication ---
  phone: Icon.select({ ios: 'phone', android: import('@expo/material-symbols/call.xml') }),
  'phone.fill': Icon.select({
    ios: 'phone.fill',
    android: import('@expo/material-symbols/call.xml'),
  }),
  mail: Icon.select({ ios: 'mail', android: import('@expo/material-symbols/mail.xml') }),
  'mail.fill': Icon.select({
    ios: 'mail.fill',
    android: import('@expo/material-symbols/mail.xml'),
  }),
  'envelope.fill': Icon.select({
    ios: 'envelope.fill',
    android: import('@expo/material-symbols/mail.xml'),
  }),
  globe: Icon.select({ ios: 'globe', android: import('@expo/material-symbols/public.xml') }),
  'paperplane.fill': Icon.select({
    ios: 'paperplane.fill',
    android: import('@expo/material-symbols/send.xml'),
  }),
  paperclip: Icon.select({
    ios: 'paperclip',
    android: import('@expo/material-symbols/attach_file.xml'),
  }),
  mic: Icon.select({ ios: 'mic', android: import('@expo/material-symbols/mic.xml') }),
  'mic.fill': Icon.select({ ios: 'mic.fill', android: import('@expo/material-symbols/mic.xml') }),
  'mic.slash.fill': Icon.select({
    ios: 'mic.slash.fill',
    android: import('@expo/material-symbols/mic_off.xml'),
  }),

  // --- analytics / info / alerts ---
  'chart.bar': Icon.select({
    ios: 'chart.bar',
    android: import('@expo/material-symbols/bar_chart.xml'),
  }),
  'chart.bar.fill': Icon.select({
    ios: 'chart.bar.fill',
    android: import('@expo/material-symbols/bar_chart.xml'),
  }),
  'chart.line.uptrend.xyaxis': Icon.select({
    ios: 'chart.line.uptrend.xyaxis',
    android: import('@expo/material-symbols/trending_up.xml'),
  }),
  'chart.line.downtrend.xyaxis': Icon.select({
    ios: 'chart.line.downtrend.xyaxis',
    android: import('@expo/material-symbols/trending_down.xml'),
  }),
  gauge: Icon.select({ ios: 'gauge', android: import('@expo/material-symbols/speed.xml') }),
  waveform: Icon.select({
    ios: 'waveform',
    android: import('@expo/material-symbols/graphic_eq.xml'),
  }),
  'waveform.and.mic': Icon.select({
    ios: 'waveform.and.mic',
    android: import('@expo/material-symbols/mic.xml'),
  }),
  'info.circle': Icon.select({
    ios: 'info.circle',
    android: import('@expo/material-symbols/info.xml'),
  }),
  'info.circle.fill': Icon.select({
    ios: 'info.circle.fill',
    android: import('@expo/material-symbols/info.xml'),
  }),
  'exclamationmark.circle': Icon.select({
    ios: 'exclamationmark.circle',
    android: import('@expo/material-symbols/error.xml'),
  }),
  'exclamationmark.circle.fill': Icon.select({
    ios: 'exclamationmark.circle.fill',
    android: import('@expo/material-symbols/error.xml'),
  }),
  'exclamationmark.triangle': Icon.select({
    ios: 'exclamationmark.triangle',
    android: import('@expo/material-symbols/warning.xml'),
  }),
  'exclamationmark.triangle.fill': Icon.select({
    ios: 'exclamationmark.triangle.fill',
    android: import('@expo/material-symbols/warning.xml'),
  }),
  'questionmark.circle': Icon.select({
    ios: 'questionmark.circle',
    android: import('@expo/material-symbols/help.xml'),
  }),

  // --- science / tools ---
  brain: Icon.select({ ios: 'brain', android: import('@expo/material-symbols/psychology.xml') }),
  'brain.fill': Icon.select({
    ios: 'brain.fill',
    android: import('@expo/material-symbols/psychology.xml'),
  }),
  'wrench.and.screwdriver': Icon.select({
    ios: 'wrench.and.screwdriver',
    android: import('@expo/material-symbols/build.xml'),
  }),
  'wrench.and.screwdriver.fill': Icon.select({
    ios: 'wrench.and.screwdriver.fill',
    android: import('@expo/material-symbols/build.xml'),
  }),
  hammer: Icon.select({ ios: 'hammer', android: import('@expo/material-symbols/handyman.xml') }),
  'hammer.fill': Icon.select({
    ios: 'hammer.fill',
    android: import('@expo/material-symbols/handyman.xml'),
  }),
  car: Icon.select({ ios: 'car', android: import('@expo/material-symbols/directions_car.xml') }),
  'car.fill': Icon.select({
    ios: 'car.fill',
    android: import('@expo/material-symbols/directions_car.xml'),
  }),
  bus: Icon.select({ ios: 'bus', android: import('@expo/material-symbols/directions_bus.xml') }),
  'bus.fill': Icon.select({
    ios: 'bus.fill',
    android: import('@expo/material-symbols/directions_bus.xml'),
  }),
  function: Icon.select({
    ios: 'function',
    android: import('@expo/material-symbols/calculate.xml'),
  }),
  scissors: Icon.select({
    ios: 'scissors',
    android: import('@expo/material-symbols/content_cut.xml'),
  }),
  'hand.tap.fill': Icon.select({
    ios: 'hand.tap.fill',
    android: import('@expo/material-symbols/touch_app.xml'),
  }),

  // --- settings / misc ---
  gearshape: Icon.select({
    ios: 'gearshape',
    android: import('@expo/material-symbols/settings.xml'),
  }),
  'gearshape.fill': Icon.select({
    ios: 'gearshape.fill',
    android: import('@expo/material-symbols/settings.xml'),
  }),
  'bell.fill': Icon.select({
    ios: 'bell.fill',
    android: import('@expo/material-symbols/notifications.xml'),
  }),
  'bell.badge.fill': Icon.select({
    ios: 'bell.badge.fill',
    android: import('@expo/material-symbols/notifications_active.xml'),
  }),
  'lock.fill': Icon.select({
    ios: 'lock.fill',
    android: import('@expo/material-symbols/lock.xml'),
  }),
  star: Icon.select({ ios: 'star', android: import('@expo/material-symbols/star.xml') }),
  'basket.fill': Icon.select({
    ios: 'basket.fill',
    android: import('@expo/material-symbols/shopping_basket.xml'),
  }),
  compass: Icon.select({
    ios: sf('compass'),
    android: import('@expo/material-symbols/explore.xml'),
  }),
  'compass.fill': Icon.select({
    ios: sf('compass.fill'),
    android: import('@expo/material-symbols/explore.xml'),
  }),
  'lightbulb.fill': Icon.select({
    ios: 'lightbulb.fill',
    android: import('@expo/material-symbols/lightbulb.xml'),
  }),
  'ant.fill': Icon.select({
    ios: 'ant.fill',
    android: import('@expo/material-symbols/bug_report.xml'),
  }),
  'stop.fill': Icon.select({
    ios: 'stop.fill',
    android: import('@expo/material-symbols/stop_circle.xml'),
  }),
  sparkles: Icon.select({
    ios: 'sparkles',
    android: import('@expo/material-symbols/wand_stars.xml'),
  }),
  'sparkles.fill': Icon.select({
    ios: sf('sparkles.fill'),
    android: import('@expo/material-symbols/wand_stars.xml'),
  }),
  photo: Icon.select({ ios: 'photo', android: import('@expo/material-symbols/image.xml') }),
  'photo.fill': Icon.select({
    ios: 'photo.fill',
    android: import('@expo/material-symbols/image.xml'),
  }),
  'building.2.fill': Icon.select({
    ios: 'building.2.fill',
    android: import('@expo/material-symbols/apartment.xml'),
  }),
  house: Icon.select({ ios: 'house', android: import('@expo/material-symbols/home.xml') }),
  'house.fill': Icon.select({
    ios: 'house.fill',
    android: import('@expo/material-symbols/home.xml'),
  }),
  'alarm.fill': Icon.select({
    ios: 'alarm.fill',
    android: import('@expo/material-symbols/alarm.xml'),
  }),
  'slider.horizontal.3': Icon.select({
    ios: 'slider.horizontal.3',
    android: import('@expo/material-symbols/tune.xml'),
  }),
  checklist: Icon.select({
    ios: 'checklist',
    android: import('@expo/material-symbols/fact_check.xml'),
  }),
  'checklist.fill': Icon.select({
    ios: sf('checklist.fill'),
    android: import('@expo/material-symbols/fact_check.xml'),
  }),

  // --- eye / password visibility toggle ---
  eye: Icon.select({ ios: 'eye', android: import('@expo/material-symbols/visibility.xml') }),
  'eye.slash': Icon.select({
    ios: 'eye.slash',
    android: import('@expo/material-symbols/visibility_off.xml'),
  }),

  // --- cloud variants (cloud.slash is the ICON_MAPPING target of cloud-offline) ---
  'cloud.slash': Icon.select({
    ios: sf('cloud.slash'),
    android: import('@expo/material-symbols/cloud_off.xml'),
  }),

  // --- brand marks: NO Material equivalent; fall through to Ionicons/web fallback ---
  // (apple.logo, g.circle.fill intentionally omitted)
} as const;

export type IconAssetName = keyof typeof ICON_ASSETS;
