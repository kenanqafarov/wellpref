with open('portal_leaderboard.js', 'r', encoding='utf-8') as f:
    leaderboard_js = f.read()

with open('portal_comparison.js', 'r', encoding='utf-8') as f:
    comparison_js = f.read()

print('=== PORTAL_LEADERBOARD.JS ===')
print(leaderboard_js[:2500])
print('\n=== PORTAL_COMPARISON.JS ===')
print(comparison_js[:2500])
