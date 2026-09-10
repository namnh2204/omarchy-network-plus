const assert = require("node:assert/strict")
const model = require("../Model.js")

// Device type enums as the QML side passes them (Quickshell DeviceType).
const WIFI = 1
const WIRED = 2

function wifi(iface, ssid, signal, address, primary) {
  return {
    kind: "wifi",
    iface: iface,
    ssid: ssid,
    signal: signal,
    address: address,
    connected: true,
    primary: !!primary
  }
}

// ---------------------------------------------------------------------------
// linkKindFor
// ---------------------------------------------------------------------------
assert.equal(model.linkKindFor(WIFI, WIFI, WIRED), "wifi")
assert.equal(model.linkKindFor(WIRED, WIFI, WIRED), "ethernet")
assert.equal(model.linkKindFor(0, WIFI, WIRED), "other")

// ---------------------------------------------------------------------------
// isPresentableLink: only links that can carry traffic belong on screen.
// ---------------------------------------------------------------------------
assert.equal(model.isPresentableLink(wifi("wlo1", "Net", 70, "10.0.0.2")), true)
assert.equal(model.isPresentableLink({ kind: "wifi", iface: "wlo1", connected: false, ssid: "Net" }), false)
// Associating radio with no network yet must not paint a glyph.
assert.equal(model.isPresentableLink({ kind: "wifi", iface: "wlo1", connected: true, ssid: "" }), false)
// Ethernet has no SSID, so it only needs to be up.
assert.equal(model.isPresentableLink({ kind: "ethernet", iface: "enp2s0", connected: true }), true)
assert.equal(model.isPresentableLink({ kind: "ethernet", iface: "enp2s0", connected: false }), false)
assert.equal(model.isPresentableLink(null), false)

// ---------------------------------------------------------------------------
// collectLinks: the core regression. Two connected Wi-Fi radios must both
// survive, which the stock single-device panel could not represent.
// ---------------------------------------------------------------------------
const twoWifi = model.collectLinks([
  wifi("wlo1", "HomeNet 5G", 88, "192.0.2.4", false),
  wifi("wlp3s0", "HomeNet", 72, "192.0.2.24", true)
])
assert.equal(twoWifi.length, 2)
// Default route leads, regardless of signal strength.
assert.deepEqual(twoWifi.map(l => l.iface), ["wlp3s0", "wlo1"])

// Disconnected links are dropped rather than rendered as dead entries.
assert.equal(model.collectLinks([
  wifi("wlo1", "Net", 60, "10.0.0.2"),
  { kind: "wifi", iface: "wlan9", connected: false, ssid: "Old" }
]).length, 1)

// Wired outranks Wi-Fi when neither holds the default route.
assert.deepEqual(
  model.collectLinks([
    wifi("wlo1", "Net", 99, "10.0.0.2", false),
    { kind: "ethernet", iface: "enp2s0", connected: true, address: "10.0.0.3", primary: false }
  ]).map(l => l.iface),
  ["enp2s0", "wlo1"]
)

// Equal-signal radios keep a stable order so the panel does not jitter between
// polls.
const tieA = model.collectLinks([wifi("wlb", "B", 50, "10.0.0.5"), wifi("wla", "A", 50, "10.0.0.4")])
const tieB = model.collectLinks([wifi("wla", "A", 50, "10.0.0.4"), wifi("wlb", "B", 50, "10.0.0.5")])
assert.deepEqual(tieA.map(l => l.iface), tieB.map(l => l.iface))

assert.deepEqual(model.collectLinks([]), [])
assert.deepEqual(model.collectLinks(null), [])

// ---------------------------------------------------------------------------
// Labels and details
// ---------------------------------------------------------------------------
assert.equal(model.linkLabel(wifi("wlo1", "HomeNet", 70, "10.0.0.2")), "HomeNet")
assert.equal(model.linkLabel({ kind: "wifi", iface: "wlo1", ssid: "" }), "Wi-Fi")
assert.equal(model.linkLabel({ kind: "ethernet", iface: "enp2s0" }), "Ethernet")

assert.equal(model.linkDetail(wifi("wlo1", "Net", 72, "10.0.0.2")), "72%")
assert.equal(model.linkDetail({ kind: "wifi", iface: "wlo1", signal: -1 }), "")
assert.equal(model.linkDetail({ kind: "ethernet", iface: "enp2s0", speed: "2500" }), "2.5gbit")

// Wi-Fi strength picks a glyph; a disconnected link falls back to the off icon.
assert.equal(model.linkIcon(wifi("wlo1", "Net", 100, "10.0.0.2")), model.wifiIconFor(100))
assert.equal(model.linkIcon({ kind: "ethernet", iface: "enp2s0" }), model.connectionIcon("ethernet", -1))

// ---------------------------------------------------------------------------
// Tooltip: names every link, so both radios are visible from the single bar
// icon.
// ---------------------------------------------------------------------------
const tooltip = model.barTooltip(twoWifi)
assert.equal(tooltip.split("\n").length, 2)
assert.ok(tooltip.includes("HomeNet (72%)"))
assert.ok(tooltip.includes("HomeNet 5G (88%)"))
assert.ok(tooltip.includes("wlp3s0"))
assert.ok(tooltip.includes("192.0.2.4"))
assert.equal(model.barTooltip([]), "Disconnected")

// The pill tooltip additionally calls out the default route.
assert.ok(model.linkPillTooltip(twoWifi[0]).endsWith("default route"))
assert.ok(!model.linkPillTooltip(twoWifi[1]).includes("default route"))

// ---------------------------------------------------------------------------
// Pill labels: two radios on the same SSID must stay distinguishable, so the
// interface name carries the label.
// ---------------------------------------------------------------------------
assert.equal(model.linkPillLabel(wifi("wlo1", "HomeNet", 70, "10.0.0.2")), "wlo1")
assert.equal(model.linkPillLabel({ kind: "ethernet", iface: "enp2s0" }), "enp2s0")
assert.equal(model.linkPillLabel({ kind: "ethernet", iface: "" }), "Ethernet")

// Section header only counts when there is something to choose between.
assert.equal(model.activeLinksTitle(twoWifi), "ACTIVE CONNECTIONS: 2")
assert.equal(model.activeLinksTitle([twoWifi[0]]), "")
assert.equal(model.activeLinksTitle([]), "")

// ---------------------------------------------------------------------------
// Selection: the picker's fallback behavior.
// ---------------------------------------------------------------------------
assert.equal(model.defaultLinkIface(twoWifi), "wlp3s0")
// With no default route, the first (sorted) link wins rather than nothing.
assert.equal(model.defaultLinkIface([wifi("wlo1", "Net", 50, "10.0.0.2", false)]), "wlo1")
assert.equal(model.defaultLinkIface([]), "")

assert.equal(model.hasLinkIface(twoWifi, "wlo1"), true)
assert.equal(model.hasLinkIface(twoWifi, "gone0"), false)
assert.equal(model.hasLinkIface(twoWifi, ""), false)

assert.equal(model.linkForIface(twoWifi, "wlo1").ssid, "HomeNet 5G")
assert.equal(model.linkForIface(twoWifi, "gone0"), null)
assert.equal(model.linkIndexForIface(twoWifi, "wlo1"), 1)
assert.equal(model.linkIndexForIface(twoWifi, "gone0"), -1)

// ---------------------------------------------------------------------------
// Interface names reach a shell argv through the bundled helper.
// ---------------------------------------------------------------------------
assert.equal(model.isSafeIfaceName("wlp3s0"), true)
assert.equal(model.isSafeIfaceName("enp2s0.100"), true)
assert.equal(model.isSafeIfaceName("eth0; rm -rf /"), false)
assert.equal(model.isSafeIfaceName("$(id)"), false)
assert.equal(model.isSafeIfaceName("a b"), false)
assert.equal(model.isSafeIfaceName(""), false)
assert.equal(model.isSafeIfaceName(null), false)

// ---------------------------------------------------------------------------
// Helper resolution: must refuse anything that could point at another binary.
// ---------------------------------------------------------------------------
assert.equal(model.pluginDirFromUrl("file:///home/u/.config/omarchy/plugins/namnh.network/"), "/home/u/.config/omarchy/plugins/namnh.network")
assert.equal(model.pluginDirFromUrl("file:///a/../b"), "")
assert.equal(model.pluginDirFromUrl("file:///a/%2e%2e/b"), "")
assert.equal(model.pluginDirFromUrl("https://example.com/x"), "")
assert.equal(model.pluginDirFromUrl("relative/path"), "")
assert.equal(model.pluginDirFromUrl(""), "")

assert.equal(model.helperPath("/plugins/net", "omarchy-network-link-status"), "/plugins/net/bin/omarchy-network-link-status")
// An untrustworthy plugin dir disables the helper instead of resolving it.
assert.equal(model.helperPath("", "omarchy-network-link-status"), "")
assert.equal(model.helperPath("/plugins/net", "../../evil"), "")

// ---------------------------------------------------------------------------
// Stock helpers must keep working: the clone still drives the rest of the panel.
// ---------------------------------------------------------------------------
const parsed = model.parseKeyValue("default_iface\twlo1\niface\twlo1\nip\t10.0.0.2\ntype\twifi\n")
assert.equal(parsed.default_iface, "wlo1")
assert.equal(parsed.iface, "wlo1")
assert.equal(parsed.type, "wifi")
assert.equal(model.formatHeaderSpeed("2500"), "2.5gbit")
assert.equal(model.formatPingLatency(-1, false), "--")

console.log("model.test.js: all assertions passed")
