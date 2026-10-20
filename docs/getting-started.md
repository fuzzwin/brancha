# Start here: Branchi for everyday projects

Branchi is a memory and a visual map for a project. It helps you answer: **What was I trying to do? What did I decide? What have I saved? What should I do next?**

You do not need to think in diagrams. Start with a goal and a few useful updates; Branchi turns the saved records into dashboards, maps and a handover you can return to.

## When it is most useful

Branchi is a good fit for projects that take more than one conversation, involve several alternative directions or are interrupted by other work. It can help you keep related work together across supported AI tools. For a quick question you will never return to, a normal chat may be enough.

## Examples you can try

### A room makeover

Keep your budget, must-haves, measurements, options and the reason you chose an option together. Your next step might be measuring the desk space.

Try this in an AI chat:

> Help me plan a small room makeover. Keep my budget and must-haves visible. Separate decisions from ideas I am still considering.

### Job applications

Make one project per application, or a shared search project. Link document versions, match confirmed experience to requirements and record what you still need to check.

Try this in an AI chat:

> Organise this job application around the role requirements. Record which documents I prepared and what still needs checking.

### Learning photography

Keep questions, useful explanations and practice exercises. Record which exercises you actually tried, then leave the next exercise in your handover.

Try this in an AI chat:

> Help me learn photography in small steps. Record what I have practised and suggest one next exercise.

### A DIY build or prototype

Keep design alternatives, file links and dependencies. Distinguish a proposed design, a prepared file, something you made and a result you actually tested.

Try this in an AI chat:

> Keep a record of this build. Separate proposed ideas, things I made and things I actually tested.

### Researching a purchase

Save your requirements and source links, compare options and record why you chose one. Recheck changing facts such as prices before buying.

Try this in an AI chat:

> Compare these options against my requirements. Keep the source links and explain why I chose the final option.

### A creative or small business project

Keep the outline, drafts, feedback and ideas for later. Link decisions to the sources or observations behind them.

Try this in an AI chat:

> Keep the main direction clear. Save interesting offshoots for later and record the next useful step.

These examples are starting points, not promises that Branchi will carry out the work. To save the conversation into Branchi, the chat must have a supported Branchi connection or capture integration. Without one, you can add a short summary manually in Edit records.

## Pick a setup that suits you

| Your situation | Easiest starting point | What it needs |
| --- | --- | --- |
| Branchi already runs on your computer | Open Home, choose a project and follow its next action | The local companion running; no new installation |
| You want to try the organiser first | Browser with manual records | One-time local setup with Node.js; no AI account or Obsidian required |
| You already work in a supported local AI tool | Add its tested Branchi connection or capture integration | One-time integration setup and permission for each included chat |
| You like linked notes and visual maps | Open the same project folder in Obsidian | Obsidian plus the local companion; optional interactive plugin |
| You want the private ChatGPT connection | Use an existing connected Branchi Connect service | Separate service/account setup; more involved than the local browser |

A browser here is a window onto the program running on your own computer. The default address is **http://127.0.0.1:51207/**. It works while the companion is running; it is not a public website or a way to connect from another computer.

### If it is already installed

1. Open your existing local workspace or Obsidian Home. Your configured address or folder may differ from the defaults.
2. Choose **Start here** for this introduction, then select one project.
3. Read the next action. Use **Edit records** in the local browser to create a project or add a task, decision or source.
4. Before stopping, save one specific next action so returning is easy.

### Fresh setup: simplest manual version

This GitHub project still needs a one-time setup. It is not a one-click desktop installer. If you are uncomfortable with a terminal, ask someone to do these steps once; everyday use happens in the browser.

**Ask a helper or a local coding assistant:**

> Set up Branchi from https://github.com/fuzzwin/branchi on this computer for manual use in the local browser. Use a separate folder. Disable automatic chat capture and AI mapping for the first trial. Preserve any existing Branchi configuration and projects. Show me how to open it, start it next time and export a backup.

**For the person setting it up:**

1. Install **Node.js 22 or later** from [nodejs.org](https://nodejs.org/).
2. Download Branchi using GitHub's **Code → Download ZIP**, extract it and open a terminal in the extracted folder. Git is optional when using the ZIP.
3. On a fresh installation, run:

```sh
npm run setup -- --no-codex --no-ai
npm start
```

4. Leave that terminal open. Open **http://127.0.0.1:51207/** in the browser. Choose **Edit records** to create a project; the default editor address is **http://127.0.0.1:51207/editor**.
5. Next time, open a terminal in the same extracted folder, run `npm start`, and open the same browser address. Stop that manual instance with **Ctrl+C** in its terminal.

No `npm install`, AI account or model API key is needed for this manual trial. The setup flags above apply only to a fresh configuration: setup preserves an existing configuration and does not use these flags to switch off its running integrations. Ask the helper to inspect an existing setup instead of replacing it.

The current local setup also generates note files. You can ignore them during a browser-only trial. Current source versions that offer an Obsidian / localhost / both choice can select **localhost**; the commands above do not depend on that newer option being available.

### Add Obsidian when you want a notebook view

Obsidian is optional for reading and writing through the local browser. A **vault** means the folder where Obsidian keeps notes.

Open your configured Branchi folder using Obsidian's **Open folder as vault**. A fresh default is `Documents/Branchi`. Open **Generated → START HERE**. Keep personal writing in **Notes**; **Generated** pages are refreshed from the project record.

For clickable dashboards, ask your helper to run `npm run obsidian-interactive`, then enable **Branchi Interactive** in Obsidian's Community plugins. Some setup versions already install its files. Keep the local companion running to refresh generated pages. [Obsidian setup details](obsidian-interactive.md).

### Add connected AI capture when the manual trial makes sense

A supported AI connection lets you ask Branchi to resume a project or save a checkpoint. Automatic local capture needs a supported integration and explicit inclusion of the exact chat. Creating a project, installing a skill or saying the word Branchi in an unconnected chat does not connect it.

Ask your helper to test one saved update and confirm that it appears in the correct project. Optional AI mapping can then suggest tasks, decisions and branches from saved work. It needs supported signed-in AI access and uses that account's limits. [Connection choices](portable-setup.md) · [Automatic mapping](automatic-mapping.md).

## Your first five minutes

1. In **Edit records**, choose **New project**. Try **Plan my room makeover**.
2. Write the goal: **Make the room easier to work in while keeping my existing desk and staying within my budget.** Add a few observable outcomes.
3. Add a task such as **Measure the desk space**, and a decision such as **Keep the existing desk**. Link a source if it supports your decision.
4. Return to the project dashboard or map. Explore the saved items and their connections.
5. Set the next action to **Measure the wall beside the desk**. Read the handover before your next work session.

You can do this entirely by hand. AI connections add convenience after setup; the basic organiser is useful on its own.

## Useful prompts for a connected AI tool

- **Start:** “Use Branchi to create a project called [name]. Keep this original goal: [goal]. These are the outcomes I want: [outcomes].”
- **Resume:** “Resume [name] with Branchi. Tell me the goal, the latest saved decisions and one useful next step.”
- **Save:** “Save a checkpoint for [name]: what changed, what I decided, supporting sources and the next action. Keep untested results labelled as untested.”
- **Explore:** “Save this alternative as a branch for later. Keep the current plan as the main direction.”
- **Switch:** “Checkpoint the useful work in [first project], then resume [second project].”

These require Branchi to be connected in that chat. Otherwise use the same wording to draft a summary, then add the result by hand.

## A few words explained

| Word | Plain meaning |
| --- | --- |
| Project | One goal and the work related to it |
| Branch | An alternative direction or idea for later |
| Checkpoint | A saved update about progress and what comes next |
| Evidence | A source or result supporting a claim |
| Dependency | Something that needs to happen before another step |
| Handover / resume brief | A short summary to help you continue |
| Companion | The local program that keeps the app and generated pages up to date |
| Vault | Your folder of notes and project records |

## Keeping your work useful

Keep one clear next action, record why you made important decisions, and attach useful sources. A saved AI report does not establish that its claim is correct or that work is complete. Branchi stores references to linked files; it does not automatically back up those files.

Back up your project record and personal notes before moving computers. The editor offers **Backup** for the project JSON and **Obsidian export** for generated notes. Keep any linked files separately. Browser-only snapshots, a local vault and the optional cloud connector are separate records; they do not provide automatic two-way synchronisation. [Moving computers](another-computer.md).
