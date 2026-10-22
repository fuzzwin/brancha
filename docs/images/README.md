# Branchi example images

For the 0.21 development release, see [new image provenance](release-0.21-images.md).
The screenshots described below are the retained 0.18 examples for comparison.

These are real screenshots of the published Branchi browser interface, taken on 21 October 2026. They use a separate fictional workspace, not a real user vault or live project. The app source used was commit `d8b3d2f60bda89f49706dcc92412dc5bf7d079e6`.

## What is in the example

The sample project is **Branchi — fictional example**: a made-up plan for a friendly project companion. It has 13 authored records and 11 connections. Goals, decisions, feedback, evidence notes, acceptance, progress counts and timeline entries are all fictional. There are no captured conversations, private files, account details or real user project names. The sample data is [examples/branchi-demo.json](../../examples/branchi-demo.json).

- **branchi-overview.jpg:** next action and progress cards on the project dashboard.
- **branchi-map.jpg:** the full-page mindmap with Work in motion collapsed for readability.
- **branchi-decision.jpg:** the setup decision, its fictional evidence note, reasoning, alternatives and next action.

## Reproduce the example

Copy the fictional JSON into a new, separate folder as `brancha.json`; never replace an existing workspace with it. From the Branchi checkout, start the browser server against that new folder:

```sh
node companion/server.mjs PATH_TO_NEW_DEMO_FOLDER 51421
```

Use a shell without a `BRANCHA_CONFIG` override. Open `http://127.0.0.1:51421/` and choose the fictional project. This server-only command does not start chat capture, AI mapping or the cloud bridge.

For the images, open the dashboard, then its Full-page map, then the setup decision and Open record & evidence. These are unretouched interface screenshots at the browser's normal viewport. JPEG is used to keep the README download small. They illustrate navigation and recorded state; they are not evidence of completed user work or usability testing.

## Branchi logo

[branchi-logo.png](branchi-logo.png) is an AI-generated wordmark created with the built-in image-generation tool, using a supplied lettering and leafy-branch reference. It is separate from the interface screenshots above. The final prompt is saved in [branchi-logo-prompt.txt](branchi-logo-prompt.txt).
