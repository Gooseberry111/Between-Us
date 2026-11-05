import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";

import { T, themedStyles, useTheme } from "../lib/theme";

/*
 * ==========================================
 * THE MAP
 * ==========================================
 *
 * OpenStreetMap, drawn by Leaflet inside a web view -- free,
 * no key, and it follows light and dark. Each place is a pin
 * with its emoji; tapping one tells the screen which, and
 * the screen can move the map or highlight a pin back.
 *
 * Builds made before the map existed have no web view; the
 * screen shows its list without the map then.
 */

let WebView = null;

try {
  WebView = require("react-native-webview").WebView;
} catch {
  WebView = null;
}

export const mapAvailable = Boolean(WebView);

function page(dark) {
  const tiles = dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: ${dark ? "#1C1A21" : "#ECEBF2"}; }
  .pin { width: 34px; height: 34px; border-radius: 17px; display: flex; align-items: center; justify-content: center;
         font-size: 17px; background: ${dark ? "#2A2731" : "#FFFFFF"}; box-shadow: 0 2px 6px rgba(0,0,0,.3);
         border: 2px solid ${dark ? "#A47CC0" : "#4A2D5C"}; transition: transform .15s; }
  .pin.on { transform: scale(1.3); background: ${dark ? "#A47CC0" : "#4A2D5C"}; }
  .me { width: 16px; height: 16px; border-radius: 8px; background: #2F80ED; border: 3px solid #fff;
        box-shadow: 0 0 0 6px rgba(47,128,237,.25); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head><body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView([0, 0], 2);
  L.tileLayer('${tiles}', { maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
  var pins = {}, me = null, chosen = null;
  function send(m) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  window.show = function (data) {
    Object.keys(pins).forEach(function (k) { map.removeLayer(pins[k]); });
    pins = {};
    (data.places || []).forEach(function (p) {
      var icon = L.divIcon({ className: '', html: '<div class="pin" id="pin-' + p.i + '">' + p.e + '</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
      var m = L.marker([p.lat, p.lon], { icon: icon }).addTo(map);
      m.on('click', function () { send({ type: 'pick', id: p.id }); });
      pins[p.id] = m;
    });
    if (data.me) {
      if (me) map.removeLayer(me);
      me = L.marker([data.me.lat, data.me.lon], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
    }
    if (data.centre) map.setView([data.centre.lat, data.centre.lon], data.zoom || 14);
  };
  window.highlight = function (id, lat, lon) {
    document.querySelectorAll('.pin.on').forEach(function (n) { n.classList.remove('on'); });
    var m = pins[id];
    if (m && m._icon) { var n = m._icon.querySelector('.pin'); if (n) n.classList.add('on'); }
    if (lat !== undefined) map.flyTo([lat, lon], Math.max(map.getZoom(), 15), { duration: 0.6 });
  };
  map.on('moveend', function () { var c = map.getCenter(); send({ type: 'moved', lat: c.lat, lon: c.lng }); });
  send({ type: 'ready' });
</script></body></html>`;
}

export default function PlaceMap({
  places,
  me,
  centre,
  selected,
  onPick,
  onMoved,
  style,
}) {
  useTheme();

  const view = useRef(null);
  const ready = useRef(false);
  const html = useMemo(() => page(T.dark), [T.scheme]); // eslint-disable-line react-hooks/exhaustive-deps

  const pins = useMemo(
    () =>
      (places || []).map((p, i) => ({
        id: p.id,
        i,
        lat: p.lat,
        lon: p.lon,
        e: p.emoji,
      })),
    [places],
  );

  const push = () => {
    if (!ready.current || !view.current) return;

    const data = JSON.stringify({ places: pins, me, centre, zoom: 14 });
    view.current.injectJavaScript(`window.show(${data}); true;`);
  };

  /* Places or the point of view changed. */
  useEffect(push, [pins, centre?.lat, centre?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready.current || !view.current || !selected) return;

    view.current.injectJavaScript(
      `window.highlight(${JSON.stringify(selected.id)}, ${selected.lat}, ${selected.lon}); true;`,
    );
  }, [selected]);

  if (!WebView) return null;

  return (
    <View style={[styles.frame, style]}>
      <WebView
        ref={view}
        source={{ html, baseUrl: "https://between-us.app/" }}
        originWhitelist={["*"]}
        style={styles.web}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        onMessage={(event) => {
          let message = null;

          try {
            message = JSON.parse(event.nativeEvent.data);
          } catch {
            return;
          }

          if (message.type === "ready") {
            ready.current = true;
            push();
          } else if (message.type === "pick") {
            onPick?.(message.id);
          } else if (message.type === "moved") {
            onMoved?.({ lat: message.lat, lon: message.lon });
          }
        }}
      />
    </View>
  );
}

const styles = themedStyles(() => ({
  frame: {
    height: 260,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: T.surface,
  },

  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
}));
