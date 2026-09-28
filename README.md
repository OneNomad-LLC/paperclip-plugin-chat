# Chat

Talk to any agent in Paperclip directly, without opening a task. Pick an agent, send a message, and the
reply appears as the agent writes it. Conversations remember context, so follow-ups keep building on what the agent already
knows.

## Install

```bash
paperclipai plugin install @onenomad/paperclip-plugin-chat
```

## What it does

- Adds a **Chat** page to the sidebar, alongside your projects and tasks.
- Start a new conversation with any agent in the company (defaults to the CEO, or whoever is at the top
  of the org chart if there's no CEO).
- Each conversation keeps one agent session, so the agent remembers earlier messages in that thread.
- Replies appear as the agent writes them, with a short "Working: Terminal, Read…" line while it's
  using tools.
- Rename or delete conversations from the sidebar list.

## Every message is a real agent run

Sending a message wakes the agent the same way assigning it a task would. It's a real, billed run, and
the agent can act on what you ask, not just answer questions: it can create issues, delegate to other
agents, or do anything else it's normally allowed to do. There's no sandboxed "just chatting" mode.

The composer says this plainly under the send button. If you're not sure what a message will cost or
do, ask the agent before you send something that commits it to work.

**How replies show up.** The page follows the agent's run through Paperclip's own run API with your session, so text and tool activity appear as the agent works. The reply is saved to the conversation when the run ends. Leaving the page doesn't stop the run: open the conversation again and the finished reply is there.

## How the agent remembers the conversation

Paperclip doesn't resume an agent's session between chat runs, so every message you send includes the whole conversation so far. The agent always sees the entire chat. Very long chats drop their oldest messages from what's sent (the full history stays saved), and the agent is told when that happens.

## Where history lives

Conversations and messages are stored in this plugin's own state, scoped per company. They aren't
Paperclip issues or comments, so they won't show up in task search or activity feeds. Deleting a
conversation removes it for good.

## Chat vs. issue threads

Issue threads are for work that's tracked: a ticket, a discussion tied to a deliverable, something with
a status. Chat is for everything else, quick questions, thinking out loud with an agent, or asking it to
do something small without the overhead of creating and closing a task. They complement each other; Chat
doesn't replace issues, and an agent you're chatting with can still create an issue if the conversation
turns into real work.
