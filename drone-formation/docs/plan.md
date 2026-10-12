# Implementation plan

1. Add meaningful Node tests for surface sampling: 1000 finite positions, world transform and area weighting; reject empty/degenerate geometry; check motion endpoints. Run before implementation.
2. Implement formation.mjs for triangle extraction, normalized sampling, presets and deterministic interpolation.
3. Implement app.js with Three.js renderer and local GLTFLoader; transactional loading, disposal, playback and responsive controls. Build index.html and style.css from concept.
4. Add a minimal static server restricted to this directory and README instructions. Add sample GLB generation for reproducible upload verification.
5. Run Node tests and real browser checks for visible rendering, playback, file loading, errors and responsive overflow. Record results and open local preview.
