# Graphify and Gemini setup

Graphify does not require an API key. Code extraction is deterministic, and a
documentation corpus can fall back to host-agent semantic extraction. A Gemini
key is optional but avoids delegated extraction for documentation-heavy starter
repositories.

## Installed backend

Graphify's Gemini extra is installed in its isolated `uv` tool environment.

## Private key location

Store the key outside this repository at:

```text
$HOME/.config/graphify/gemini.env
```

The file contains one line:

```sh
export GEMINI_API_KEY='PASTE_THE_KEY_HERE'
```

Restrict it with:

```sh
chmod 600 "$HOME/.config/graphify/gemini.env"
```

Before any Graphify key check or command, load it in the same shell:

```sh
if [ -f "$HOME/.config/graphify/gemini.env" ]; then
  set -a
  . "$HOME/.config/graphify/gemini.env"
  set +a
fi
```

Separate tool calls may not share exported variables, so later Graphify/Python
commands that use Gemini must load the file again. Never print the variable or
the file. If the file is absent, continue with Graphify's host-agent fallback.
