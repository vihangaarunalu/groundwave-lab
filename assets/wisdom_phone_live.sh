#!/data/data/com.termux/files/usr/bin/bash
# WISDOM phone sensor - streams the phone's 4G signal and GPS position to the
# Groundwave Lab live link (Digital shadow tab), every few seconds.
#
# Android only. Install from F-Droid: Termux and Termux:API. Then in Termux:
#   pkg install termux-api jq curl
# Allow Location and Phone permissions for Termux:API (Android settings, Apps).
#
# Run (use the same channel name as the Live link card on the page):
#   CHANNEL=wisdom-lab1 bash wisdom_phone_live.sh
# Optional settings:
#   BW_MHZ=10      4G cell bandwidth: 5, 10, 15 or 20 (sets the RSRP -> power conversion)
#   FREQ_MHZ=auto  downlink frequency; auto = from the EARFCN when the phone reports it
#   GAIN_DBI=0     phone antenna gain
#   PERIOD=3       seconds between readings
# Stop with Ctrl+C (Volume Down + C on the Termux keyboard).

CHANNEL="${CHANNEL:-wisdom-lab1}"
URL="${URL:-https://groundwave-lab.pages.dev/api/measure}"
BW_MHZ="${BW_MHZ:-10}"
FREQ_MHZ="${FREQ_MHZ:-auto}"
GAIN_DBI="${GAIN_DBI:-0}"
PERIOD="${PERIOD:-3}"

for c in termux-location termux-telephony-cellinfo jq curl; do
  command -v "$c" >/dev/null 2>&1 || { echo "Missing $c. Run: pkg install termux-api jq curl (and install the Termux:API app)"; exit 1; }
done

# EARFCN -> downlink frequency (MHz) for common 4G bands (3GPP TS 36.101)
freq_from_earfcn() {
  awk -v n="$1" 'BEGIN{
    split("1 2110 0 0 599|3 1805 1200 1200 1949|5 869 2400 2400 2649|7 2620 2750 2750 3449|8 925 3450 3450 3799|20 791 6150 6150 6449|28 758 9210 9210 9659|38 2570 37750 37750 38249|40 2300 38650 38650 39649|41 2496 39650 39650 41589", B, "|");
    for (i in B) { split(B[i], b, " "); if (n >= b[4] && n <= b[5]) { printf "%.1f", b[2] + 0.1*(n - b[3]); exit } }
  }'
}

echo "WISDOM phone sensor -> channel $CHANNEL. Press Connect in the Live link card on the page."
n=0
while true; do
  loc=$(termux-location -p gps -r once 2>/dev/null)
  lat=$(printf '%s' "$loc" | jq -r '.latitude // empty' 2>/dev/null)
  lon=$(printf '%s' "$loc" | jq -r '.longitude // empty' 2>/dev/null)
  acc=$(printf '%s' "$loc" | jq -r '.accuracy // empty' 2>/dev/null)
  cell=$(termux-telephony-cellinfo 2>/dev/null | jq -c '[.[] | select(.registered == true)][0] // empty' 2>/dev/null)
  if [ -z "$lat" ] || [ -z "$lon" ] || [ -z "$cell" ]; then
    echo "  waiting for GPS and the serving cell..."; sleep "$PERIOD"; continue
  fi
  type=$(printf '%s' "$cell" | jq -r '.type // "lte"')
  rsrp=$(printf '%s' "$cell" | jq -r '.rsrp // .dbm // empty')
  pci=$(printf '%s' "$cell" | jq -r '.pci // .psc // "?"')
  earfcn=$(printf '%s' "$cell" | jq -r '.earfcn // empty')
  if [ -z "$rsrp" ] || [ "$rsrp" = "2147483647" ]; then echo "  no signal value from the phone yet"; sleep "$PERIOD"; continue; fi

  f="$FREQ_MHZ"
  if [ "$f" = "auto" ]; then f=""; [ -n "$earfcn" ] && f=$(freq_from_earfcn "$earfcn"); [ -z "$f" ] && f=1800; fi
  # RSRP (one 15 kHz resource element) -> total power: + 10 log10(12 N_RB); then field strength E = P + 20 log10(f) + 77.2 - G
  level=$(awk -v r="$rsrp" -v bw="$BW_MHZ" -v f="$f" -v g="$GAIN_DBI" -v t="$type" 'BEGIN{
    nrb = (bw==5?25:(bw==15?75:(bw==20?100:50)));
    add = (t=="lte"||t=="nr") ? 10*log(12*nrb)/log(10) : 0;
    printf "%.2f", r + add + 20*log(f)/log(10) + 77.2 - g }')

  n=$((n+1))
  body=$(jq -nc --arg s "Phone $n (PCI $pci)" --argjson lat "$lat" --argjson lon "$lon" --argjson lv "$level" --argjson f "$f" \
        '{readings:[{sensor:$s, lat:$lat, lon:$lon, level:$lv, f_mhz:$f, h:1.5, src:"phone"}]}')
  res=$(curl -s -m 15 -X POST -H "Content-Type: application/json" --data "$body" "$URL?ch=$CHANNEL")
  printf '  #%d  %s dBm (PCI %s, %s MHz)  ->  %s dBuV/m   GPS +/-%s m   %s\n' "$n" "$rsrp" "$pci" "$f" "$level" "${acc:-?}" "$(printf '%s' "$res" | jq -r 'if .ok then "sent" else (.error // "not sent") end' 2>/dev/null)"
  sleep "$PERIOD"
done
