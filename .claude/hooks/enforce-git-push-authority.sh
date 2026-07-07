#!/bin/bash
# enforce-git-push-authority.sh
# PreToolUse hook: requires explicit user confirmation for "git push" commands in Bash tool.
# Histórico: virou "deny" incondicional numa sessão anterior porque um agente ficava fazendo
# push a cada commit sem perguntar (ver .claude/memory/feedback-devops-branch-pr.md). O problema
# real não era push em si — era push automático sem checagem humana. "ask" resolve isso: nunca
# push silencioso, sempre passa pelo prompt de permissão do Claude Code antes de executar.
# Uses node (not jq) for JSON parsing — works on Windows/Git Bash
# FAIL-CLOSED: if parsing fails, blocks the command (exit 2)

INPUT=$(cat)

# Extract command from JSON using node (available on all TRIVIAIOX systems)
COMMAND=$(echo "$INPUT" | node -e "
  let d='';
  process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    try{console.log(JSON.parse(d).tool_input.command||'')}
    catch(e){process.exit(1)}
  });
" 2>/dev/null)

# Fail-closed: if node parsing failed, block the command
if [ $? -ne 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Hook failed to parse input — blocking for safety. Contact @devops."}}'
  exit 0
fi

# git push (push, push --force, push origin, etc.) sempre exige confirmação explícita do
# usuário — "ask" força o prompt de permissão do Claude Code em vez de negar ou permitir
# silenciosamente. Push --force pra main/master continua coberto pela proteção de branch do
# GitHub e pela instrução geral do agente de nunca forçar push sem pedido explícito.
if echo "$COMMAND" | grep -qiE '\bgit\s+push\b'; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"git push sempre exige confirmação explícita do usuário nesta sessão (nunca automático)."}}'
  exit 0
fi

# Allow all other commands
exit 0
