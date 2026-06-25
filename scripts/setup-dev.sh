#!/usr/bin/env bash
# setup-dev.sh — rode uma vez após clonar o repo.
# Cria symlink entre ~/.claude/projects/.../memory/ e .claude/memory/ do repo,
# para que a memória do agente seja lida/gravada diretamente no versionamento.
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_MEMORY="$REPO_ROOT/.claude/memory"

# Claude Code usa o path absoluto do projeto com / → - como nome da pasta
CLAUDE_PROJECT_KEY=$(echo "$REPO_ROOT" | sed 's|/|-|g' | sed 's|^-||')
CLAUDE_MEMORY_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_KEY/memory"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  🔗 Sinérgica OS — setup-dev                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Repo:   $REPO_ROOT"
echo "Target: $REPO_MEMORY"
echo "Link:   $CLAUDE_MEMORY_DIR"
echo ""

# Garantir que o diretório pai existe
mkdir -p "$(dirname "$CLAUDE_MEMORY_DIR")"

# Se já existe como diretório real (não symlink), mover conteúdo para o repo
if [ -d "$CLAUDE_MEMORY_DIR" ] && [ ! -L "$CLAUDE_MEMORY_DIR" ]; then
  echo "⚠️  Diretório local encontrado — movendo conteúdo para o repo antes de criar symlink..."
  cp -n "$CLAUDE_MEMORY_DIR"/*.md "$REPO_MEMORY/" 2>/dev/null || true
  rm -rf "$CLAUDE_MEMORY_DIR"
fi

# Remover symlink antigo se existir
[ -L "$CLAUDE_MEMORY_DIR" ] && rm "$CLAUDE_MEMORY_DIR"

# Criar symlink
ln -s "$REPO_MEMORY" "$CLAUDE_MEMORY_DIR"

echo "✅ Symlink criado com sucesso!"
echo ""
echo "A partir de agora:"
echo "  • Claude Code grava memória diretamente em .claude/memory/ do repo"
echo "  • git pull aqui atualiza a memória de todos automaticamente"
echo "  • Commite .claude/memory/ normalmente quando quiser propagar correções"
echo ""
