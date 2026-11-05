# Parent and school presentation

Everything for the narrated presentation lives here, in one place, so it stays up to date as features ship.

| File | What it is |
| --- | --- |
| `deck.json` | Slide order and sections (same format as the Slides artifact's `project/deck.json`) |
| `slides/<id>.html` | One slide each (same format as the artifact's `project/slides/<id>.html`) |
| `images/<blob id>.*` | Pictures the slides use; the file name is the artifact's `/_blob/<id>` |
| `narration.json` | The words the Max voice reads, one entry per slide, in deck order, plus the slide's short title |
| `build.mjs` | Renders slide pictures, makes narration for changed text only, builds the video |
| `build-manifest.json` | Made by the build: what was last rendered and narrated (do not edit) |

The build writes `apps/web/public/presentation/` (slide-<id>.jpg, slide-<id>.mp3, scholartasks-presentation.mp4)
and `apps/web/app/admin/presentation/slides.json`, which the team presenter page (`/admin/presentation`)
and the website tour (home page, "N-minute tour") read. Nothing else needs changing when slides are added or removed.

## When a feature ships (every feature PR)

1. Decide which slide shows the feature. Edit that slide's HTML, or add a new `slides/<id>.html` and put its id in
   `deck.json` `order` and in `narration.json` at the same place.
2. Update the matching words in `narration.json` (and the slide's `<aside>` speaker notes).
3. Run the build (cloud session):
   `npm install --prefix presentation && NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node presentation/build.mjs --share /mnt/project-files/scholartasks/presentation`
   Only changed slides are rendered and only changed narration is sent to ElevenLabs. `--dry` shows the cost first.
4. Commit everything the build changed in the same PR. CI runs `node presentation/build.mjs --check`.
5. Publish the changed slide files (and any new picture as an asset) to the Slides artifact
   https://claude.ai/artifact/MmQ3BFuiJizzGUi1uYy1GW so the shareable deck matches.

Rules: never use the words "Pay" (use Fund) or "sponsor"; the sample student is "Emma" (never a real child's name);
no prices until they are final. Screenshots for slides go in `images/` and come from sample data only.
