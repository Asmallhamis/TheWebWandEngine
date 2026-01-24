# Wand evaluation tree
Computes wand evaluations for Noita.
# Install
In order to install you must [unpack data](https://noita.wiki.gg/wiki/Modding#Extracting_data_files) then specify the data path with `--data_path` or add it to your `user_config.lua`.
# Usage
It can be used standalone as a command line program or use one of the graphical frontends [wand-py](https://github.com/NathanSnail/wand-py.git), [nofi](https://github.com/scrying-circle/nofi.git).
You can see help instructions with `--help`, run with `luajit main.lua --help` or `./wand_eval` for partial autocomplete.
# Sample output
```
Wand
└Cast #1 Delay: 218f, ΔMana: 165 @ 1
 └Tau
  ├Blood to Power
  │└Blood to Power
  │ └Critical on bloody enemies
  │  └Alpha
  │   └Tau
  │    ├Divide by 10
  │    │└Divide by 10 ] 10
  │    │ └Divide by 4 ] 100
  │    │  └Divide by 2 ] 400
  │    │   └Divide by 2                  ┐
  │    │    └Spell duplication           │ 800
  │    │     ├Blood to Power             │
  │    │     └Critical on bloody enemies ┘
  │    └Divide by 4
  │     └Blood ] 4
  └Critical on bloody enemies
   └Spark bolt
┌────────────────────────────┬──────┐
│ Divide by 2                │ 1200 │
│ Blood to Power             │ 802  │
│ Critical on bloody enemies │ 802  │
│ Spell duplication          │ 800  │
│ Divide by 4                │ 101  │
│ Divide by 10               │ 11   │
│ Blood                      │ 4    │
│ Tau                        │ 2    │
│ Spark bolt                 │ 1    │
│ Alpha                      │ 1    │
└────────────────────────────┴──────┘
```
Highlighting available if you run it in a terminal.
# Autocomplete
You can get autocomplete for the various flags and arguments by running `source ./src/cmp.sh` which will add the completion script to your shell.
