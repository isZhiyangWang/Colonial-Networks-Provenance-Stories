# Colonial-Networks-Provenance-Stories
Colonial Networks: Provenance Stories

## Repository Overview and Contribution Guide

Welcome to this art provenance visualization project! This guide will help you (and future collaborators) understand the structure of the repository, the contents of each file/folder, and how to modify the JSON data files that power this site.

---

## Table of Contents
1. [Repository Structure](#repository-structure)
2. [File/Folder Descriptions](#filefolder-descriptions)
   - [Assets Folder](#assets-folder)
   - [Data Folder](#data-folder)
   - [HTML & JS Files](#html--js-files)
   - [CSS File](#css-file)
3. [JSON Files Explained](#json-files-explained)
   - [gallery.json](#galleryjson)
   - [details.json (example)](#detailsjson-example)
4. [Adding/Editing Artwork Data](#addingediting-artwork-data)
5. [Contributing Guidelines](#contributing-guidelines)

---

## Repository Structure

The main repository layout is organized as follows:

```
├─ Assets
│  ├─ artwork-id.jpg (e.g., rembrandt.jpg)
│  ├─ ...
│  ├─ artwork-id-[event-id].jpg (e.g., rembrandt-0.jpg)
│  └─ ...
├─ data
│  ├─ gallery.json (the content of the gallery)
│  ├─ artwork-id.json (e.g., rembrandt.json)
│  └─ ...
├─ .DS_Store
├─ README.md
├─ detail.html
├─ detail.js
├─ index.html
└─ style.css
```

### Quick Breakdown:
- **assets/**: Holds all images for artworks and event illustrations.
- **data/**: Contains the core JSON files describing the artwork list and their detailed provenance information.
- **.DS_Store**: A Mac-specific file (ignore it).
- **README.md**: This very guide you’re reading.
- **detail.html**, **detail.js**: Handle the detailed page for a single artwork (including the provenance events, social network info, etc.).
- **gallery.html** (or **index.html** + **gallery.js**): Display the overall gallery of artworks.
- **style.css**: Styles for the site layout and design.

---

## File/Folder Descriptions

### Assets Folder
- **Location**: `./assets/`
- **Contents**: 
  - Main images for each artwork (`<artwork-id>.jpg` or `.png`, etc.).
  - Additional images corresponding to provenance events (`<artwork-id>-<event-id>.jpg`).

#### Naming Conventions
- **Main Artwork Image**: `artwork-id.jpg`  
  For example, `rembrandt.jpg` or `watteau.png`.
- **Event Images**: `artwork-id-event-id.jpg`  
  For example, `rembrandt-1.jpg` might be the image for Rembrandt’s first provenance event.

These naming conventions make it easier for the code to dynamically load images based on the event data.

---

### Data Folder
- **Location**: `./data/`
- **Contents**:
  - **gallery.json**: Lists the artworks displayed in the main gallery.
  - **<artwork>.json**: Contains detailed provenance information (timeline events, social networks, etc.) for a specific artwork.

When you create a new artwork, you will:
1. Add its summary to `gallery.json`.
2. Create a corresponding `<artwork-id>.json` file (or whatever naming scheme your team prefers) with detailed provenance data.

---

### HTML & JS Files

1. **index.html**  
   - Main landing page of the site. Often includes the overall list of artworks or introduction.

2. **gallery.js**  
   - JavaScript to dynamically load and display the list of artworks from `gallery.json`.

3. **detail.html**  
   - The page layout for a specific artwork’s detailed view.

4. **detail.js**  
   - Fetches the relevant `<artwork-id>.json` file and populates the provenance events, social network, etc.

---

### CSS File

1. **style.css**  
   - Contains the site’s layout, fonts, colors, margins, etc.

---

## JSON Files Explained

### gallery.json
**Purpose**: A master list of artworks that appear in the gallery view.

**Structure** (example):
```json
[
  {
    "id": "rembrandt",
    "title": "Rembrandt, Philosopher in Contemplation",
    "image_url": "assets/rembrandt.jpg",
    "excerpt": "Rembrandt’s Philosopher in Contemplation was painted in 1632..."
  },
  {
    "id": "watteau",
    "title": "Jean-Antoine Watteau, Pleasures of the Ball (c. 1715-17)",
    "image_url": "assets/watteau.png",
    "excerpt": "Painted in 1632, famously relocated to Paris..."
  }
]
```
1. **id**: Unique identifier for the artwork. Used for linking to its detailed page.
2. **title**: Full title of the artwork, including artist name and date.
3. **image_url**: Path to the image (stored in assets/ folder).
4. **excerpt**: Short descriptive text about the artwork. [not in use]

When you add a new artwork, create a new object in this array with the same key-value structure.

### details.json (example)

**Purpose**: Holds detailed provenance data, including:

1. Artwork’s full title and description.
2. Place data (like city names and coordinates).
3. Provenance events (timeline entries showing an artwork’s movement and/or change of ownership).
4. Social network (people or institutions connected to the artwork).

**Structure (simplified)**:
```json
{
  "artworkData": {
    "title": "Rembrandt, Philosopher in Contemplation (1632)",
    "imageUrl": "assets/rembrandt.jpg",
    "description": "<p>Rembrandt’s Philosopher in Contemplation was painted in 1632...</p>"
  },
  "placeData": {
    "Amsterdam": {
      "name": "Amsterdam",
      "coords": [52.3676, 4.9041]
    },
    "Paris": {
      "name": "Paris",
      "coords": [48.8566, 2.3522]
    }
  },
  "provenanceEvents": [
    {
      "id": 0,
      "title": "1. The Parisian taste for Dutch Painting",
      "from": "Amsterdam",
      "to": "Paris",
      "eventType": "moves from",
      "text": "<p>Rembrandt’s Philosopher in Contemplation was painted in 1632...</p>",
      "participants": [
        { "name": "Amsterdam", "type": "place" },
        { "name": "Paris", "type": "place" }
      ],
      "changedLocation": true,
      "imageSource": "<p>Joan Blaeu, ... Image in the public domain.</p>"
    },
    ...
  ],
  "socialNetwork": {
    "nodes": [
      {
        "id": "Marquis d’Argenson",
        "type": "person",
        "bio": "Ambassador, war minister, and art collector..."
      },
      ...
    ],
    "edges": [
      {
        "source": "Marquis d’Argenson",
        "target": "Duc de Choiseul",
        "relationship": "political ally"
      },
      ...
    ]
  }
}
```

**Key Sections**:

1. **artworkData**: Title, image, and a rich-text description of the artwork.
2. **placeData**: Coordinates and names of the places the artwork has traveled through.
3. **provenanceEvents**: Each object in this array represents an event in the artwork’s history (who owned it, how it was transferred, etc.).
    - `id`, `title`, `from`, `to`, `eventType`, `text`, `participants`, etc.
    - `changedLocation`: true or false depending on whether the artwork physically moved.
    - `imageSource` and `imageAlt`: Provide image references or credits for the event, if any.
4. **socialNetwork**:
    - **nodes**: People or institutions involved.
    - **edges**: Relationships among these nodes (e.g., “political ally,” “sold to,” “rumored lover,” etc.).

When you create or edit an artwork’s provenance, you’ll modify/add to the provenanceEvents array and the socialNetwork structure accordingly.


## Adding/Editing Artwork Data

1.  **Add a New Artwork**
    
    -   **In `gallery.json`**: Append a new object to the JSON array with the `id`, `title`, `image_url`, and `excerpt`.
    -   **Create `<artwork-id>.json`**:
        -   Copy an existing details JSON as a template.
        -   Update `artworkData`, `placeData`, `provenanceEvents`, and `socialNetwork` entries with the new artwork’s info.
    -   **Add images**:
        -   Place the main image in `assets/` (naming it `<artwork-id>.jpg` or similar).
        -   Any event-specific images follow the `<artwork-id>-<event-id>.jpg` format.
    -   **Link the new details** in `detail.js` or wherever your code routes to the specific JSON file. Usually, your code handles `id` matching automatically if the naming is consistent.
2.  **Edit an Existing Artwork**
    
    -   **Update existing entries** in `gallery.json` if the short info changes (title, excerpt, etc.).
    -   **In `<artwork-id>.json`**: Add or change events (`provenanceEvents`), revise `placeData`, or modify the `socialNetwork`.
    -   **Replace or add images** in the `assets/` folder if needed.
3.  **Validate JSON**
    
    -   Always ensure your JSON structure remains valid (matching braces, colons, commas).
    -   Many code editors have built-in JSON validation or you can use any online JSON validator.


## Adding/Editing Artwork Data

1.  **Add a New Artwork**
    
    -   **In `gallery.json`**: Append a new object to the array with the `id`, `title`, `image_url`, and `excerpt`.
    -   **Create `<artwork-id>.json`** (or similarly named file in the `data/` folder):
        -   Copy an existing file as a template.
        -   Update all relevant fields under `artworkData`, `placeData`, `provenanceEvents`, and `socialNetwork`.
    -   **Add images** to `assets/`:
        -   Main image: `<artwork-id>.jpg`.
        -   Event-specific images: `<artwork-id>-<event-id>.jpg`.
    -   **Link or fetch**: Ensure that your new details JSON is referenced properly in the code (usually via `id` matching in `detail.js` or routing logic).
2.  **Edit an Existing Artwork**
    
    -   **In `gallery.json`**: Update the relevant JSON object if the short info changes.
    -   **In `<artwork-id>.json`**: Add/edit `provenanceEvents`, modify `placeData`, or update the `socialNetwork`.
    -   **Replace or add images** in `assets/` if needed.
3.  **Validate JSON**
    
    -   Make sure your JSON syntax is correct.
    -   Many code editors have built-in JSON validation. You can also use an online JSON validator if unsure.


## Contributing Guidelines

### Making Changes via GitHub Web Interface

1.  **Navigate to the file you want to edit**  
    In the GitHub repository, click on the file within the folder (e.g., `gallery.json`, or `<artwork-id>.json` in the `data` folder).
2.  **Click the pencil (edit) icon**  
    GitHub will open its built-in editor for that file.
3.  **Make your edits**  
    Make sure to follow the existing structure and syntax.
    -   For JSON files, add new entries carefully (pay attention to brackets `[] {}`, commas, and quotation marks).
    -   For `.md` or `.js` files, stay consistent with the project style.
4.  **Scroll down to the Commit section**
    -   Write a short summary of your changes in the **Commit message** field.
    -   Optionally add a more detailed description below.
5.  **Choose where to commit**
    -   You can commit directly to the `main` (or `master`) branch if you have permission, or create a new branch for your edits (recommended for larger changes).
6.  **Click “Commit changes”**  
    Your edits will be saved in the repository.
    -   If you created a new branch, you can open a Pull Request for review.

That’s it! Your changes will now be reflected in the repo. If you run into any issues or see errors in the JSON structure, GitHub will often highlight them. If so, correct them and commit again.

