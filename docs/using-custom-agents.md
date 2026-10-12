# Using VS Code Custom Agents

Notes saved from a GitHub Copilot chat on 2026-10-12, answering: "Am I using the agents correctly, how should I use them? How is it different to just using chat? What more could I do with them, can I use more than one at a time?"

---

Short version: yes, you're using them correctly, and the way you've been using them is the main intended way. Here's the fuller picture.

## What a custom agent actually is

An `.agent.md` file (like the Hebrew Font Researcher at `.github/agents/hebrew-font-researcher.agent.md` in the Bellis-Digi workspace root) is a saved chat configuration: a system prompt plus a tool allow-list plus metadata. Nothing more exotic than that. When you pick it from the agent dropdown, chat starts with those instructions already loaded and those tool restrictions enforced.

So the difference from "just chat" is:

| Plain chat (Agent/Ask mode) | Custom agent |
|---|---|
| General-purpose instructions | Your task-specific instructions, every time |
| All tools available | Only the tools you listed (`web, read, search, execute`) |
| You re-explain constraints each session | Constraints are baked in (five-minute limit, licence rules, "don't upload handwriting") |
| Behaviour drifts with how you phrase things | Consistent behaviour across sessions |

The researcher agent is a good example: the licence-evidence table, the `date +%s`-only terminal rule, and the "ask before another batch" ending are things you'd otherwise have to retype or hope the model remembers.

## The two ways to use an agent

1. **Pick it as the active agent** (dropdown in the chat input). The whole conversation runs under its rules. This is what you did for the font research.
2. **Have another agent call it as a subagent.** The `agents:` field in frontmatter controls which agents a given agent may delegate to. Your researcher has `agents: []`, so it can't delegate, and nothing lists it as callable either.

The REA security review was an instance of the second mode almost working: the chat was running as "Security and Bug Reviewer" and tried to spin up specialist sub-reviews, but no subagent tool was available in that session, so the review was done directly. Delegation depends on the host exposing a `runSubagent` tool, which varies by mode and settings.

## "Can I use more than one at a time?"

Three different answers depending on what you mean:

- **Several agents in one conversation, sequentially:** switch the dropdown mid-conversation. Context carries over; the new agent's instructions take effect from that point. This is how a reviewer agent could pick up where a builder agent left off.
- **Several agents in parallel:** open multiple chat sessions (the `+` / new chat, or split the chat view). Each runs independently; they don't share context. Useful for e.g. font research in one tab while a code review runs in another.
- **One agent orchestrating others:** list the callable agents in `agents:` on the orchestrator, and it can invoke them as subagents (parallel calls are possible when the host supports it). Each subagent gets a fresh context, does its job, and returns a result. Note the built-in `Explore` agent is exactly this kind of worker.

## What more you could do

- **A reviewer agent for your own repos.** The built-in "Security and Bug Reviewer" worked well on REA. A workspace copy could add your conventions (e.g. "Voyle: always check Supabase RLS policies and the lockdown path").
- **A font-build agent paired with the researcher.** The research agent is read-only by design; a separate "Ksav Builder" agent with `edit` and `execute` could own the build command, `NODE_PATH`, and the "one stroke at a time" vector-cleanup rules so you don't re-explain them.
- **Split read-only vs write agents deliberately.** The researcher's `tools:` list without `edit` is a real safety boundary, not just documentation. Keep research/review agents unable to edit, and give write power only to agents whose scope is narrow.
- **Use `argument-hint` and `description` well.** The description is what the model reads when deciding whether to auto-invoke an agent as a subagent, so make it say *when* to use it, as yours does.
- **Add handoffs.** Agents can declare suggested follow-up agents, so after a research batch the UI offers "Switch to Ksav Builder" with context intact.
- **Pair with `.instructions.md`.** Instructions files apply automatically by file glob (e.g. `applyTo: "ksav-proof/**"`), regardless of agent. Use those for *always-true* facts about a folder, and agents for *roles*.

## Things to watch

- Agent files only load from `.github/agents/` in the workspace root or your user prompts folder, which is why the researcher lives at the Bellis-Digi root rather than inside `ksav-proof`.
- An agent's instructions are strong but not absolute; a hard rule like "only run `date +%s`" is more reliable than a soft preference.
- Subagents don't see your conversation; whatever they need must be in the request you (or the parent agent) give them.

A possible next step is to sketch the frontmatter for a builder agent and a reviewer agent that reference each other, to see how the `agents:` and handoff fields fit together.
