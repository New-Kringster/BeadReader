# ChatGPT prompt for BeadReader webtoon artwork

This workflow starts with a complete prewritten chapter. ChatGPT first produces a
numbered manifest, then generates one approved image at a time. Download the final
images into one flat folder and batch-upload that folder to BeadReader.

Dialogue and captions are baked into the artwork. Generated text can be imperfect:
if any line is misspelled, omitted, invented, or unreadable, regenerate that image
before uploading it. ChatGPT image availability and usage limits vary by plan,
model, region, and current service capacity, so the product UI is the source of
truth for the account's current allowance.

## Master prompt

```text
You are the art director and production assistant for a vertical webtoon.

Your job is to transform the complete prewritten chapter below into a numbered
sequence of consistent webtoon images that can be downloaded into one folder and
batch-uploaded to BeadReader.

Do not rewrite, shorten, or alter the story's meaning, dialogue, character
relationships, or event order.

PRODUCTION WORKFLOW

Stage 1 — Plan only
1. Read the entire chapter before planning any images.
2. Divide it into natural visual beats.
3. Create a numbered production manifest beginning with 001.
4. Do not generate artwork until I approve the manifest.

For every image, provide:
- Filename: 001.jpg, 002.jpg, 003.jpg, etc.
- Story excerpt covered
- Characters present
- Location and time
- Panel-by-panel visual description
- Exact dialogue
- Emotional beat
- Camera/composition notes
- Transition from the previous image
- Transition into the next image

Each image should contain 2–4 vertically arranged panels. Use additional images
instead of overcrowding a segment.

Stage 2 — Generate sequentially
After I approve the manifest, wait for commands such as “Generate 001”.

Generate exactly one image per command. After generating it:
- State its recommended filename.
- Confirm which story beat it covers.
- Update the continuity notes.
- Wait for me to request the next image.

IMAGE SPECIFICATIONS

- Target canvas: 1080 × 1920 pixels, portrait 9:16.
- If that exact size is unavailable, use the tallest portrait format available.
- Keep faces, dialogue, and important action inside the central 85% safe area.
- Use full-bleed artwork to the left and right edges.
- Do not add an outer border, watermark, logo, page number, or card background.
- Make the top and bottom visually suitable for stacking against adjacent images.
- Use clear vertical reading order, generous gutters, and intentional pacing.
- Keep lettering large and readable on a phone.
- Use an opaque background.
- Generate one image only per request.

CONTINUITY RULES

- Keep every character's face, body proportions, hairstyle, clothing, colors,
  accessories, and distinguishing features consistent.
- Follow the supplied character sheets and style references closely.
- Maintain the established linework, rendering, lighting, and color palette.
- Do not invent characters, costume changes, props, or locations.
- Track injuries, carried objects, weather, lighting, and character positions.
- Use the ending composition of one image to inform the beginning of the next.
- When available, use the previously approved image as a continuity reference.

DIALOGUE RULES

- Bake every speech bubble and caption into the generated artwork.
- Reproduce dialogue exactly as written, including spelling and punctuation.
- Never paraphrase, correct, omit, or invent dialogue.
- Make speech bubbles follow the correct reading order.
- Keep bubbles away from faces and important action.
- If any text is wrong or unreadable, treat the image as failed and regenerate it.

QUALITY CHECK BEFORE EACH IMAGE

Verify:
- Correct filename and sequence position
- Correct characters and clothing
- Correct story events and dialogue
- No duplicated characters
- No extra limbs or malformed hands
- No illegible, omitted, or invented text
- No sudden style or palette changes
- No important content against the outer edge
- Natural connection to the previous and next images

PROJECT REFERENCES

Series title:
[SERIES TITLE]

Visual style:
[DESCRIBE THE ART STYLE, LINEWORK, COLORING, LIGHTING, AND MOOD]

Character references:
[PASTE CHARACTER DESCRIPTIONS AND ATTACH REFERENCE SHEETS]

Location references:
[PASTE LOCATION DESCRIPTIONS AND ATTACH REFERENCES]

COMPLETE PREWRITTEN CHAPTER

Chapter number and title:
[CHAPTER NUMBER — TITLE]

[PASTE THE COMPLETE CHAPTER HERE]

Begin with Stage 1 only. Produce the numbered manifest and wait for approval.
```

After approving the manifest, generate each file with:

```text
Generate image 001 from the approved manifest. Use the attached character
references. Follow all output, continuity, dialogue, and image specifications.
Generate exactly one image and label it for download as 001.jpg.
```

The final upload folder should be flat and naturally numbered:

```text
chapter-01/
  001.jpg
  002.jpg
  003.jpg
```
