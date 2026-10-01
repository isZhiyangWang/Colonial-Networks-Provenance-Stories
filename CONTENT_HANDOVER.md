# Provenance Stories: Content Handover

This guide covers routine content changes only: adding, removing, or editing Gallery artworks and Key Figures. Hosting, deployment, code structure, and troubleshooting will be covered in a separate technical handover.

Routine content updates should not require changes to HTML or JavaScript.

## Main Content Files

- `data/gallery.json`: the artworks and their order on the Gallery page.
- `data/<artwork-id>.json`: the complete dashboard for one artwork.
- `data/key-figures.json`: all entries on the Key Figures page.
- `assets/`: main artwork and Story episode images.
- `assets/figures/`: Key Figure images.

Use a short, unique ID in lowercase with hyphens, such as `wouwermans` or `vigee-le-brun`. IDs and file names are case-sensitive on the hosted site.

## Gallery Artworks

### Add an Artwork

1. **Choose an artwork ID and add the images.**

   For an ID such as `wouwermans`, use:

   - `assets/wouwermans.jpg` for the main image;
   - `assets/wouwermans-0.jpg` for Story episode 1;
   - `assets/wouwermans-1.jpg` for Story episode 2;
   - continue the same pattern for later episodes.

   Episode images must be JPG files and their numbering begins at `0`.

2. **Add the artwork to `data/gallery.json`.**

```json
{
  "id": "wouwermans",
  "artist": "Philips Wouwermans",
  "title": "The Horse Fair",
  "date": "late 1660s",
  "museum": "Wallace Collection",
  "image_url": "assets/wouwermans.jpg",
  "excerpt": "Short approved description."
}
```

The array order is the Gallery order. `excerpt` is retained in the data for consistency but is not currently displayed on the card.

3. **Create `data/<artwork-id>.json`.**

   Copy a recent file, such as `data/wouwermans.json`, rename it, and replace the content in each section:

   - `artworkData`: artwork information and introductory text;
   - `placeData`: places and map coordinates;
   - `provenanceEvents`: Story episodes;
   - `socialNetwork`: the complete network diagram;
   - `provenanceTimeline`: provenance paragraph, source, and timeline.

   The Gallery `id` and detail file name must match. For example, `"id": "wouwermans"` loads `data/wouwermans.json` automatically.

4. **Keep these details consistent.**

   - Episode IDs begin at `0` and remain sequential.
   - Episode text uses `<p>...</p>` for each paragraph and `<em>...</em>` for italics.
   - Links use `<a href="URL" target="_blank" rel="noopener noreferrer">linked text</a>`.
   - Names in an episode diagram must match between `participants` and `networkPairs`.
   - Use participant type `greenperson` for a Key Figure, `museum` for a museum, and the other existing types for grey nodes.
   - In provenance entries, `storyId` connects the bold text to an episode, `greenNames` makes Key Figures green, and `yellowNames` makes museums yellow.

### Edit an Artwork

- Edit the Gallery card in `data/gallery.json`.
- Edit the dashboard in `data/<artwork-id>.json`.
- If the artist, title, date, or museum changes, check both files.
- Replace an image while keeping its file name, or update the corresponding path.
- When adding or removing an episode, also update its image number and any matching `storyId` references in the timeline and provenance.

### Hide or Remove an Artwork

To hide an artwork but keep its research and direct URL, remove only its object from `data/gallery.json`.

To remove it completely:

1. remove its entry from `data/gallery.json`;
2. delete `data/<artwork-id>.json`;
3. delete its main image and episode images.

Removing an artwork does not automatically remove related Key Figures.

## Key Figures

### Add a Key Figure

1. Add the image to `assets/figures/`, for example `assets/figures/example-person.jpg`.
2. Add an object to `data/key-figures.json`:

```json
{
  "id": "example-person",
  "name": "Example Person",
  "dates": "1700-1770",
  "text": "Approved biographical text.",
  "image": {
    "src": "./assets/figures/example-person.jpg",
    "shape": "rect",
    "work": "Artist, Title, date.",
    "sourcePrefix": " Image source: ",
    "sourceName": "Museum or collection",
    "sourceSuffix": ".",
    "sourceUrl": "https://example.org/source"
  }
}
```

- Use `"shape": "rect"` or `"shape": "oval"`.
- The array order is the display order.
- Use `textHtml` instead of `text` only when the biography needs links or formatting.
- Keep captions, credits, and source links exactly as approved.

Adding a Key Figure does not automatically make the name green in artwork dashboards. Add the exact name to `greenNames` and use participant type `greenperson` in each relevant artwork file.

### Edit a Key Figure

- Edit the relevant object in `data/key-figures.json`.
- Replace its image while keeping the same file name, or update `image.src`.
- If the person's name changes, search the artwork JSON files for the old name and update any provenance or network references.

### Remove a Key Figure

1. remove the complete object from `data/key-figures.json`;
2. delete its image only if no other content uses it;
3. check artwork JSON files for references to that person.

## Final Check

JSON does not allow comments or a comma after the final item. Validate edited files with:

```bash
python3 -m json.tool data/gallery.json >/dev/null
python3 -m json.tool data/key-figures.json >/dev/null
python3 -m json.tool data/<artwork-id>.json >/dev/null
```

Preview the Gallery, the edited artwork, and the Key Figures page. Check the approved wording and formatting, image credits, links, episode navigation, diagrams, and desktop/mobile display before publishing.
