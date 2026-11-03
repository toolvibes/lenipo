/** Commands and subcommands, for help and shell completion (D-CLI-06). */
export const COMMANDS: Record<string, string[]> = {
  login: [],
  logout: [],
  profile: ['list', 'use'],
  whoami: [],
  issue: ['list', 'view', 'create', 'edit', 'move', 'comment', 'assign'],
  board: ['list', 'view'],
  sprint: ['list'],
  page: ['get', 'push', 'pull', 'push-dir'],
  agent: [
    'init',
    'next',
    'ask',
    'status',
    'team',
    'claim',
    'release',
    'handover',
    'blocked',
    'inbox',
    'watch',
    'review-request',
    'reviews',
    'review',
    'usage',
  ],
  mcp: [],
  admin: ['users', 'import', 'backup', 'archive', 'restore'],
  completion: ['bash', 'zsh', 'fish'],
  help: [],
};

/** A completion script for the shell; install with e.g. `tl completion zsh > ~/.zfunc/_tl`. */
export function completion(shell: string): string {
  const top = Object.keys(COMMANDS).join(' ');
  if (shell === 'bash') {
    const cases = Object.entries(COMMANDS)
      .filter(([, subs]) => subs.length > 0)
      .map(
        ([command, subs]) =>
          `    ${command}) COMPREPLY=( $(compgen -W "${subs.join(' ')}" -- "$cur") ) ;;`,
      )
      .join('\n');
    return `# bash completion for lenipo and tl
_tl() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "${top}" -- "$cur") )
    return
  fi
  case "\${COMP_WORDS[1]}" in
${cases}
  esac
}
complete -F _tl lenipo tl
`;
  }
  if (shell === 'zsh') {
    const cases = Object.entries(COMMANDS)
      .filter(([, subs]) => subs.length > 0)
      .map(([command, subs]) => `    ${command}) compadd ${subs.join(' ')} ;;`)
      .join('\n');
    return `#compdef lenipo tl
_tl() {
  if (( CURRENT == 2 )); then
    compadd ${top}
    return
  fi
  case $words[2] in
${cases}
  esac
}
compdef _tl lenipo tl
`;
  }
  if (shell === 'fish') {
    const lines = [`complete -c tl -f -n __fish_use_subcommand -a "${top}"`];
    for (const [command, subs] of Object.entries(COMMANDS)) {
      if (subs.length === 0) continue;
      lines.push(
        `complete -c tl -f -n "__fish_seen_subcommand_from ${command}" -a "${subs.join(' ')}"`,
      );
    }
    return `${[...lines, ...lines.map((line) => line.replace('-c tl ', '-c lenipo '))].join('\n')}\n`;
  }
  throw new Error('Shell: bash, zsh or fish');
}
