set -x
mkdir -p out tests/www
# The app's real code, pointed at the test stand-in instead of the real database.
sed 's#https://yglqvmdrocoknogamagr.supabase.co/#http://127.0.0.1:8080/#g' tests/src/media.js > tests/www/media.js
python3 tests/src/build.py tests/www/app.html
sed -i '' 's#https://yglqvmdrocoknogamagr.supabase.co/#http://127.0.0.1:8080/#g' tests/www/app.html
cp -r tests/fonts tests/icon-180.png tests/manifest.webmanifest tests/www/
python3 tests/server.py > out/server.log 2>&1 &
sleep 2; curl -s -o /dev/null -w "server %{http_code}\n" http://127.0.0.1:8080/harness.html

wait_done() { # $1 device label, $2 seconds
  for i in $(seq 1 $(( $2 / 5 ))); do grep -q "\"dev\": \"$1\", \"case\": \"done\"" out/results.jsonl 2>/dev/null && return 0; sleep 5; done
  echo "TIMEOUT waiting for $1"; return 1; }

# 1) Mac Safari (same video engine family as iPad Safari)
open -a Safari "http://127.0.0.1:8080/harness.html?dev=mac-safari"
wait_done mac-safari 900; screencapture -x out/mac_safari.png || true
osascript -e 'quit app "Safari"' || true

# 2) iPad and iPhone simulators running real Mobile Safari
xcrun simctl list devices available -j > out/devices.json
python3 - <<'P' > out/picks.txt
import json; d=json.load(open('out/devices.json'))['devices']
rt=sorted([k for k in d if 'iOS' in k], key=lambda k:[int(x) for x in k.split('iOS-')[1].split('-')])
best=lambda pref: next((x for r in reversed(rt) for name in pref for x in d[r] if x['name'].startswith(name)), None)
for label,pref in [('ipad-sim',['iPad (A16)','iPad (10th','iPad Air','iPad']),('iphone-sim',['iPhone 16','iPhone 15','iPhone'])]:
    x=best(pref); print(label, x['udid'], x['name'].replace(' ','_'))
P
cat out/picks.txt
while read label udid name; do
  xcrun simctl boot "$udid"; xcrun simctl bootstatus "$udid" -b >/dev/null
  echo "$label = $name" >> out/sim_names.txt
  sleep 5
  xcrun simctl openurl "$udid" "http://127.0.0.1:8080/harness.html?dev=$label"
  sleep 25; xcrun simctl io "$udid" screenshot "out/${label}_during.png" || true
  wait_done "$label" 1200
  xcrun simctl io "$udid" screenshot "out/${label}_harness_done.png" || true
  for r in today film; do
    xcrun simctl openurl "$udid" "http://127.0.0.1:8080/www/app.html?k=TESTCODE1234#$r"; sleep 10
    xcrun simctl io "$udid" screenshot "out/${label}_app_$r.png" || true
  done
  xcrun simctl shutdown "$udid" || true
done < out/picks.txt

# 3) Check what actually arrived: length, frames, size of every uploaded file
for f in out/files/*; do
  echo "== $(basename $f) $(stat -f%z $f) bytes"
  ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames:format=duration,format_name -of compact "$f" 2>&1 | head -4
  case "$f" in *.mp4|*.mov) echo "decoded frames: $(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")";; esac
done > out/files_report.txt 2>&1
python3 - > out/smoothness.txt 2>&1 <<'P'
import subprocess, glob, json
print('files:', len(glob.glob('out/files/*')), flush=True)
for f in sorted(glob.glob('out/files/*.mp4')+glob.glob('out/files/*.mov')):
    ts=[float(x) for x in subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries','frame=pts_time','-of','csv=p=0',f],capture_output=True,text=True).stdout.replace(',',' ').split() if x.strip() and x.strip()!='N/A']
    ts.sort(); g=[b-a for a,b in zip(ts,ts[1:])] or [0]
    print(f.split('/')[-1], end=' ', flush=True); print('%s frames=%d length=%.2fs fps=%.1f longest_gap=%.3fs gaps_over_0.1s=%d' % (f.split('/')[-1], len(ts), (ts[-1]-ts[0]) if ts else 0, len(ts)/max(0.01,(ts[-1]-ts[0])) if len(ts)>1 else 0, max(g), sum(x>0.1 for x in g)))
P
cat out/results.jsonl; cat out/files_report.txt; cat out/smoothness.txt
