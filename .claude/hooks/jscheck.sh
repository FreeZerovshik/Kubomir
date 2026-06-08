#!/usr/bin/env bash
# PostToolUse-хук Кубомира: после Write/Edit проверяет синтаксис JS через `node --check`.
# Нет шага сборки → синтаксическая ошибка иначе молча ломает игру. Падаем с кодом 2
# (stderr уходит обратно Claude как фидбек), если файл из Minecraft/js/*.js не парсится.
input=$(cat)
f=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write((j.tool_input&&j.tool_input.file_path)||"")}catch(e){}})')
case "$f" in
  */Minecraft/js/*.js)
    if ! out=$(node --check "$f" 2>&1); then
      printf '❌ Синтаксическая ошибка JS в %s:\n%s\n' "$f" "$out" >&2
      exit 2
    fi
    ;;
esac
exit 0
