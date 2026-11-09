# Regenerates src/game/questions.js from questions.txt
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
txt = open(os.path.join(root, 'questions.txt')).read()
open(os.path.join(root, 'src/game/questions.js'), 'w').write("// Built-in copy of questions.txt (used if the text file can't be fetched, e.g. opened from disk).\n// Edit questions.txt — the game prefers it when hosted. Regenerate with: python3 tools/build_questions.py\nexport const BUILTIN = " + json.dumps(txt) + ";\n")
