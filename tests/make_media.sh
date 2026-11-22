set -e
mkdir -p tests/media && cd tests/media
# HEVC like an iPhone: try the Mac's hardware encoder, fall back to software.
if ffmpeg -loglevel error -f lavfi -i testsrc2=s=320x240 -t 1 -c:v hevc_videotoolbox -b:v 1M -f null - 2>/dev/null; then HEVC=hevc_videotoolbox; else HEVC="libx265 -preset ultrafast"; fi
echo "HEVC encoder: $HEVC"
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=s=1920x1080:r=30,noise=alls=6:allf=t" -f lavfi -i "sine=f=440" -t 8 -c:v $HEVC -b:v 8M -tag:v hvc1 -pix_fmt yuv420p -c:a aac -shortest iphone_hevc_1080_small.mov
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=s=3840x2160:r=60,noise=alls=8:allf=t" -f lavfi -i "sine=f=440" -t 12 -c:v $HEVC -b:v 50M -tag:v hvc1 -pix_fmt yuv420p -c:a aac -shortest iphone_hevc_4k60_big.mov
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=s=1920x1080:r=60,noise=alls=8:allf=t" -f lavfi -i "sine=f=440" -t 20 -c:v libx264 -preset veryfast -b:v 25M -maxrate 26M -bufsize 26M -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart iphone_h264_1080p60_big.mp4
ffmpeg -y -loglevel error -f lavfi -i "testsrc2=s=4032x3024" -frames:v 1 -q:v 2 photo_4032.jpg
sips -s format heic photo_4032.jpg --out photo.heic >/dev/null || cp photo_4032.jpg photo.heic
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%%%EOF\n' > card.pdf
for f in *; do echo "$f $(stat -f%z $f) bytes"; ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate:format=duration -of compact "$f" 2>/dev/null | head -3; done
