# 3D games source

- `games3d.js` bundles all four 3D games into `../derby3d.js`:
  `npx esbuild games3d.js --bundle --format=esm --minify --target=safari15 --legal-comments=eof --outfile=../derby3d.js` (three.js 0.187).
- `park3d.js`: shared ballpark, players, ball, camera loop. `hud3d.js`: on-screen panels.
- `build_player.py`: Blender (bpy 5.3) script that makes `../player.glb`.
  - Body, skeleton, skin weights, kid shape: MakeHuman hm08 assets (CC0).
  - Motion: CMU Graphics Lab Motion Capture Database, subjects 124 (swing, pitch) and 127 (run), free for all uses.
