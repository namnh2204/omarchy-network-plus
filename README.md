# Network Plus

An Omarchy shell plugin that reports **every** connected network interface, not just the default route.

The built-in `omarchy.network` widget collapses connectivity to a single link. On a machine with two interfaces up (two Wi-Fi radios, or Wi-Fi plus Ethernet), only one is visible and the others are silently dropped. This plugin keeps the stock design and adds an interface picker.

## What changes

The bar stays a **single icon**, as stock. Multi-link state shows up in three places:

- **Bar tooltip** names every active link: `HomeNet (72%) · wlp3s0 · 192.0.2.24`, one line per interface.
- **`ACTIVE CONNECTIONS: n`** section in the panel, with one pill per link. Filled pill = the card carrying the default route; bold pill = the card whose stats are on screen.
- **Stats retarget** to the selected card. Ping, packet loss, throughput, IP and gateway all describe the interface you picked instead of always describing the default route.
- **The Wi-Fi list retargets too.** Known/other networks describe the selected radio, so the connected entry matches the SSID in the header rather than showing the other card's network.

Everything else (band selector, DNS provider, QR sharing, speed test, keyboard navigation) behaves as stock. The picker joins the `j`/`k` focus chain and `h`/`l` moves between pills.

## Why helper scripts

The built-in widget derives its state from a single link, in two independent ways:

1. `omarchy-network-status` resolves its interface with `ip route get 1.1.1.1`, which returns only the default-route device.
2. `Panel.qml`'s `findDevice()` returns the first connected match per type, and `kind` collapses to one value.

There is also a subtler trap. The shell's Wi-Fi network objects (`NetworkDevice.networks`) only carry SSID and signal for the **one** device the scanner is armed on. Enumerating links from that data leaves every other radio with an empty SSID, so it gets dropped and the picker never appears. The kernel knows each card's association without any scan, so this plugin asks it instead, through two bundled helpers:

- **`bin/omarchy-network-links`** lists every interface with its own SSID, signal, address and state, plus a `default_iface` line. This drives the picker and the tooltip, independent of which radio is scanning.
- **`bin/omarchy-network-link-status`** takes an interface and emits the same tab-separated key/value stream the stock command does, so the stats can retarget. Ping probes are bound with `ping -I`, so latency belongs to the card being shown.

The Wi-Fi scan list follows the picker too: `wifiDevice` resolves by interface name rather than taking the first connected radio, so "Known Networks" describes the selected card instead of a different one.

Interface names reach a shell argv, so they are validated against `^[A-Za-z0-9._-]+$` on both the QML side (`Model.isSafeIfaceName`) and in the scripts themselves. Helper paths resolve from `Qt.resolvedUrl(".")` with traversal and non-`file:` schemes rejected; an untrustworthy path disables the helper and falls back to the stock command rather than resolving some other binary.

## Install

```bash
omarchy plugin add https://github.com/namnh2204/omarchy-network-plus
```

Then add it to the bar in `~/.config/omarchy/shell.json` (or via the plugin menu). Because the manifest declares `clonedFrom: omarchy.network`, enabling this plugin replaces the built-in network widget.

## Test

```bash
node tests/model.test.js
```

`Model.js` is pure ES5 with no QML imports, so the link-collection, sorting, labelling, selection-fallback and path-validation logic is testable under Node. QML enums are passed in as arguments rather than referenced directly.

## License

MIT
