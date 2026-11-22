with open('portal_leaderboard.js', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
for i, l in enumerate(lines):
    print(f'{i+1}: {l}')
