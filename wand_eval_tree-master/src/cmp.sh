#!/bin/bash
_wand_eval_completions() {
	local words
	words="${COMP_WORDS[@]}"  # all the words
	luajit ./src/cmp.lua $COMP_WORDS $words
	# local completions=$(luajit ./cmp.lua $words)
}

complete -F _wand_eval_completions wand_eval
